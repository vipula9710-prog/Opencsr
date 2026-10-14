import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { actorOf, assertCan, can, ensureOwned, type OrgContext } from "../context";
import { audit, diff } from "../audit";
import { NotFoundError, ValidationError } from "../errors";
import { parseInput } from "../validation";
import { zCheckbox, zOptDate, zOptEmail, zOptId, zOptMoney, zOptText, zOptUrl, zText } from "@/lib/zod-helpers";
import { toCsv } from "@/lib/csv";
import { enumOrUndefined, paged, skipTake, sortBy, type ListQuery } from "./common";

export const PARTNER_TYPES = [
  "NGO", "TRUST", "SOCIETY", "NOT_FOR_PROFIT_COMPANY", "GOVERNMENT_BODY", "COMMUNITY_GROUP", "ACADEMIC_INSTITUTION", "SOCIAL_ENTERPRISE", "VENDOR", "OTHER",
] as const;

export const VERIFICATION_STATUSES = [
  "NOT_STARTED", "INFORMATION_SUPPLIED", "DOCUMENTS_UPLOADED", "PENDING_REVIEW", "VERIFIED", "REJECTED", "EXPIRED",
] as const;

export const VERIFICATION_HELP: Record<(typeof VERIFICATION_STATUSES)[number], string> = {
  NOT_STARTED: "No due-diligence information has been collected yet.",
  INFORMATION_SUPPLIED: "The partner has supplied information. It has not been checked.",
  DOCUMENTS_UPLOADED: "Supporting documents are on file. They have not been reviewed.",
  PENDING_REVIEW: "Waiting for an authorised reviewer to check the information and documents.",
  VERIFIED: "An authorised reviewer recorded that internal due-diligence checks were completed. This is an internal record, not a legal certification.",
  REJECTED: "The reviewer did not accept the information supplied.",
  EXPIRED: "The previous review has lapsed and must be repeated.",
};

const partnerSchema = z.object({
  name: zText(200),
  type: z.enum(PARTNER_TYPES),
  email: zOptEmail,
  phone: zOptText(60),
  website: zOptUrl,
  address: zOptText(500),
  city: zOptText(100),
  state: zOptText(100),
  country: zOptText(100),
  registrationNumber: zOptText(120),
  registrationDetails: zOptText(2000),
  nextReviewDate: zOptDate,
  notes: zOptText(10000),
  dueDiligence: z.record(z.string().max(2000)).optional(),
});

export type PartnerFilters = ListQuery & { type?: string; verification?: string; archived?: string };

export async function listPartners(ctx: OrgContext, q: PartnerFilters) {
  assertCan(ctx, "partner.read");
  const type = enumOrUndefined(q.type, PARTNER_TYPES);
  const verification = enumOrUndefined(q.verification, VERIFICATION_STATUSES);
  const where: Prisma.PartnerOrganisationWhereInput = {
    organisationId: ctx.organisationId,
    archivedAt: q.archived === "1" ? { not: null } : null,
    ...(type ? { type } : {}),
    ...(verification ? { verificationStatus: verification } : {}),
    ...(q.q ? { OR: [{ name: { contains: q.q, mode: "insensitive" } }, { city: { contains: q.q, mode: "insensitive" } }, { registrationNumber: { contains: q.q, mode: "insensitive" } }] } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.partnerOrganisation.findMany({
      where,
      orderBy: sortBy(q, ["name", "type", "verificationStatus", "nextReviewDate", "updatedAt"] as const, "name"),
      ...skipTake(q),
      select: {
        id: true, name: true, type: true, city: true, state: true, verificationStatus: true, nextReviewDate: true, updatedAt: true,
        _count: { select: { projects: true } },
      },
    }),
    prisma.partnerOrganisation.count({ where }),
  ]);
  return paged(items, total, { ...q, dir: q.sort ? q.dir : "asc" });
}

export async function getPartner(ctx: OrgContext, id: string) {
  assertCan(ctx, "partner.read");
  const confidential = can(ctx, "partner.confidential");
  const partner = await prisma.partnerOrganisation.findFirst({
    where: { id, organisationId: ctx.organisationId },
    include: {
      verifiedBy: { select: { name: true } },
      contacts: confidential ? { orderBy: [{ isPrimary: "desc" }, { name: "asc" }] } : false,
      projects: { select: { id: true, title: true, status: true } },
      agreements: { orderBy: { startDate: "desc" }, include: { project: { select: { id: true, title: true } } } },
      tasks: { where: { status: { notIn: ["DONE", "CANCELLED"] } }, include: { assignee: { select: { name: true } } }, orderBy: { dueDate: "asc" } },
      documents: {
        where: { archivedAt: null, ...(can(ctx, "document.confidential") ? {} : { visibility: { not: "CONFIDENTIAL" } }) },
        include: { currentVersion: { include: { mediaAsset: { select: { id: true, filename: true } } } } },
      },
    },
  });
  if (!partner) throw new NotFoundError("Partner");
  const disbursements = can(ctx, "finance.read")
    ? await prisma.disbursement.findMany({ where: { organisationId: ctx.organisationId, partnerId: id }, orderBy: { date: "desc" }, include: { project: { select: { title: true } } } })
    : [];
  return {
    ...partner,
    // Personal and confidential information is restricted.
    contacts: confidential ? partner.contacts : [],
    email: confidential ? partner.email : null,
    phone: confidential ? partner.phone : null,
    notes: confidential ? partner.notes : null,
    dueDiligence: confidential ? (partner.dueDiligence as Record<string, string>) : {},
    registrationDetails: confidential ? partner.registrationDetails : null,
    canSeeConfidential: confidential,
    disbursements,
  };
}

async function validateDueDiligence(ctx: OrgContext, values: Record<string, string> | undefined) {
  if (!values) return undefined;
  const fields = await prisma.dueDiligenceField.findMany({ where: { organisationId: ctx.organisationId } });
  const out: Record<string, string> = {};
  const errors: Record<string, string[]> = {};
  for (const f of fields) {
    const v = (values[f.key] ?? "").trim();
    if (!v) {
      if (f.required) errors[`dd.${f.key}`] = ["Required"];
      continue;
    }
    if (f.type === "NUMBER" && !/^-?\d+(\.\d+)?$/.test(v)) errors[`dd.${f.key}`] = ["Enter a number"];
    if (f.type === "DATE" && Number.isNaN(Date.parse(v))) errors[`dd.${f.key}`] = ["Enter a date"];
    if (f.type === "BOOLEAN" && !["yes", "no", "on", "true", "false"].includes(v)) errors[`dd.${f.key}`] = ["Choose yes or no"];
    out[f.key] = f.type === "BOOLEAN" ? (["yes", "on", "true"].includes(v) ? "yes" : "no") : v;
  }
  if (Object.keys(errors).length) throw new ValidationError("Please complete the due-diligence fields", errors);
  return out;
}

/** Derive an honest status from the information present (never "VERIFIED"). */
function derivedStatus(current: string, hasInfo: boolean): Prisma.PartnerOrganisationUpdateInput["verificationStatus"] | undefined {
  if (current === "NOT_STARTED" && hasInfo) return "INFORMATION_SUPPLIED";
  return undefined;
}

export async function savePartner(ctx: OrgContext, id: string | null, input: unknown) {
  assertCan(ctx, "partner.write");
  const data = parseInput(partnerSchema, input);
  const confidential = can(ctx, "partner.confidential");
  const dd = confidential ? await validateDueDiligence(ctx, data.dueDiligence) : undefined;
  const { dueDiligence: _dd, ...base } = data;
  // Users without confidential access cannot modify confidential fields.
  const values: Record<string, unknown> = confidential ? { ...base, ...(dd ? { dueDiligence: dd } : {}) } : { ...base, email: undefined, phone: undefined, notes: undefined, registrationDetails: undefined };
  const hasInfo = Boolean(data.registrationNumber || (dd && Object.keys(dd).length));
  if (id) {
    const before = ensureOwned(ctx, await prisma.partnerOrganisation.findUnique({ where: { id } }), "Partner");
    const status = derivedStatus(before.verificationStatus, hasInfo);
    const p = await prisma.partnerOrganisation.update({ where: { id: before.id }, data: { ...values, ...(status ? { verificationStatus: status } : {}) } as Prisma.PartnerOrganisationUpdateInput });
    await audit(actorOf(ctx), { action: "partner.update", entityType: "PartnerOrganisation", entityId: p.id, summary: `Updated partner ${p.name}`, metadata: diff(before, base) });
    return p;
  }
  const p = await prisma.partnerOrganisation.create({
    data: { ...(values as Prisma.PartnerOrganisationUncheckedCreateInput), organisationId: ctx.organisationId, verificationStatus: hasInfo ? "INFORMATION_SUPPLIED" : "NOT_STARTED" },
  });
  await audit(actorOf(ctx), { action: "partner.create", entityType: "PartnerOrganisation", entityId: p.id, summary: `Created partner ${p.name}` });
  return p;
}

const verificationSchema = z.object({
  status: z.enum(VERIFICATION_STATUSES),
  notes: zOptText(4000),
  nextReviewDate: zOptDate,
});

/** Record a due-diligence review outcome. Only users with partner.verify can mark VERIFIED/REJECTED. */
export async function updateVerification(ctx: OrgContext, id: string, input: unknown) {
  const data = parseInput(verificationSchema, input);
  const reviewOutcome = ["VERIFIED", "REJECTED", "EXPIRED"].includes(data.status);
  assertCan(ctx, reviewOutcome ? "partner.verify" : "partner.write");
  const before = ensureOwned(ctx, await prisma.partnerOrganisation.findUnique({ where: { id } }), "Partner");
  if (data.status === "VERIFIED") {
    const docs = await prisma.document.count({ where: { organisationId: ctx.organisationId, partnerId: id, archivedAt: null } });
    if (docs === 0) throw new ValidationError("Upload at least one supporting due-diligence document before recording verification");
  }
  const p = await prisma.partnerOrganisation.update({
    where: { id },
    data: {
      verificationStatus: data.status,
      verificationNotes: data.notes,
      nextReviewDate: data.nextReviewDate,
      ...(reviewOutcome ? { lastReviewedAt: new Date(), verifiedById: ctx.user.id, verifiedAt: data.status === "VERIFIED" ? new Date() : null } : {}),
    },
  });
  await audit(actorOf(ctx), {
    action: "partner.verification",
    entityType: "PartnerOrganisation",
    entityId: id,
    summary: `Verification status of ${p.name}: ${before.verificationStatus} → ${data.status}`,
    metadata: { notes: data.notes },
  });
  return p;
}

export async function setPartnerArchived(ctx: OrgContext, id: string, archived: boolean) {
  assertCan(ctx, "partner.write");
  const p = ensureOwned(ctx, await prisma.partnerOrganisation.findUnique({ where: { id } }), "Partner");
  await prisma.partnerOrganisation.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
  await audit(actorOf(ctx), { action: archived ? "partner.archive" : "partner.restore", entityType: "PartnerOrganisation", entityId: id, summary: `${archived ? "Archived" : "Restored"} partner ${p.name}` });
}

const contactSchema = z.object({
  name: zText(160),
  designation: zOptText(120),
  email: zOptEmail,
  phone: zOptText(60),
  isPrimary: zCheckbox,
});

export async function saveContact(ctx: OrgContext, partnerId: string, contactId: string | null, input: unknown) {
  assertCan(ctx, "partner.write", "partner.confidential");
  ensureOwned(ctx, await prisma.partnerOrganisation.findUnique({ where: { id: partnerId } }), "Partner");
  const data = parseInput(contactSchema, input);
  return prisma.$transaction(async (tx) => {
    if (data.isPrimary) await tx.partnerContact.updateMany({ where: { partnerId }, data: { isPrimary: false } });
    if (contactId) {
      const c = await tx.partnerContact.findFirst({ where: { id: contactId, partnerId, organisationId: ctx.organisationId } });
      if (!c) throw new NotFoundError("Contact");
      return tx.partnerContact.update({ where: { id: c.id }, data });
    }
    const c = await tx.partnerContact.create({ data: { ...data, partnerId, organisationId: ctx.organisationId } });
    await audit(actorOf(ctx), { action: "partner.contact.create", entityType: "PartnerOrganisation", entityId: partnerId, summary: `Added contact ${c.name}` }, tx);
    return c;
  });
}

export async function deleteContact(ctx: OrgContext, partnerId: string, contactId: string) {
  assertCan(ctx, "partner.write", "partner.confidential");
  const c = await prisma.partnerContact.findFirst({ where: { id: contactId, partnerId, organisationId: ctx.organisationId } });
  if (!c) throw new NotFoundError("Contact");
  await prisma.partnerContact.delete({ where: { id: c.id } });
  await audit(actorOf(ctx), { action: "partner.contact.delete", entityType: "PartnerOrganisation", entityId: partnerId, summary: `Removed contact ${c.name}` });
}

const agreementSchema = z.object({
  title: zText(200),
  reference: zOptText(120),
  projectId: zOptId,
  startDate: zOptDate,
  endDate: zOptDate,
  amount: zOptMoney,
  status: z.enum(["DRAFT", "ACTIVE", "EXPIRED", "TERMINATED"]),
  documentId: zOptId,
  notes: zOptText(4000),
});

export async function saveAgreement(ctx: OrgContext, partnerId: string, agreementId: string | null, input: unknown) {
  assertCan(ctx, "partner.write");
  ensureOwned(ctx, await prisma.partnerOrganisation.findUnique({ where: { id: partnerId } }), "Partner");
  const data = parseInput(agreementSchema, input);
  if (data.projectId) ensureOwned(ctx, await prisma.project.findUnique({ where: { id: data.projectId } }), "Project");
  if (data.documentId) ensureOwned(ctx, await prisma.document.findUnique({ where: { id: data.documentId } }), "Document");
  if (agreementId) {
    const a = await prisma.partnerAgreement.findFirst({ where: { id: agreementId, partnerId, organisationId: ctx.organisationId } });
    if (!a) throw new NotFoundError("Agreement");
    const updated = await prisma.partnerAgreement.update({ where: { id: a.id }, data });
    await audit(actorOf(ctx), { action: "partner.agreement.update", entityType: "PartnerOrganisation", entityId: partnerId, summary: `Updated agreement ${a.title}`, metadata: diff(a, data) });
    return updated;
  }
  const a = await prisma.partnerAgreement.create({ data: { ...data, partnerId, organisationId: ctx.organisationId } });
  await audit(actorOf(ctx), { action: "partner.agreement.create", entityType: "PartnerOrganisation", entityId: partnerId, summary: `Added agreement ${a.title}` });
  return a;
}

export async function partnerActivity(ctx: OrgContext, id: string) {
  assertCan(ctx, "partner.read");
  ensureOwned(ctx, await prisma.partnerOrganisation.findUnique({ where: { id } }), "Partner");
  return prisma.auditLog.findMany({
    where: { organisationId: ctx.organisationId, entityType: "PartnerOrganisation", entityId: id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { actor: { select: { name: true } } },
  });
}

export async function exportPartnersCsv(ctx: OrgContext) {
  assertCan(ctx, "partner.read");
  const confidential = can(ctx, "partner.confidential");
  const partners = await prisma.partnerOrganisation.findMany({ where: { organisationId: ctx.organisationId }, orderBy: { name: "asc" } });
  await audit(actorOf(ctx), { action: "partner.export", entityType: "PartnerOrganisation", summary: `Exported ${partners.length} partners to CSV` });
  const headers = ["Name", "Type", "City", "State", "Country", "Registration number", "Verification status", "Last reviewed", "Next review", "Archived"];
  if (confidential) headers.push("Email", "Phone");
  return toCsv(
    headers,
    partners.map((p) => {
      const row: unknown[] = [p.name, p.type, p.city, p.state, p.country, p.registrationNumber, p.verificationStatus, p.lastReviewedAt, p.nextReviewDate, p.archivedAt ? "yes" : "no"];
      if (confidential) row.push(p.email, p.phone);
      return row;
    }),
  );
}

export async function partnerOptions(ctx: OrgContext) {
  return prisma.partnerOrganisation.findMany({ where: { organisationId: ctx.organisationId, archivedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } });
}
