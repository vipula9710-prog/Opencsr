import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { actorOf, assertCan, can, ensureOwned, type OrgContext } from "../context";
import { audit, diff } from "../audit";
import { ForbiddenError, NotFoundError, ValidationError } from "../errors";
import { parseInput } from "../validation";
import { zOptDate, zOptId, zOptText, zText } from "@/lib/zod-helpers";
import { enumOrUndefined, paged, skipTake, type ListQuery } from "./common";
import { uploadMedia } from "./media";
import { invalidateSite } from "../cache";
import { notifyPermission } from "./notifications";

export const DOCUMENT_CATEGORIES = ["POLICY", "PROJECT_REPORT", "IMPACT_REPORT", "BUDGET", "AGREEMENT", "DUE_DILIGENCE", "EVIDENCE", "OTHER"] as const;
export const DOCUMENT_VISIBILITY = ["PUBLIC", "INTERNAL", "CONFIDENTIAL"] as const;

const docSchema = z.object({
  title: zText(200),
  description: zOptText(2000),
  category: z.enum(DOCUMENT_CATEGORIES),
  visibility: z.enum(DOCUMENT_VISIBILITY),
  projectId: zOptId,
  partnerId: zOptId,
  financialYear: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().min(2000).max(2100).nullable()).optional(),
  periodStart: zOptDate,
  periodEnd: zOptDate,
});

function visibilityFilter(ctx: OrgContext): Prisma.DocumentWhereInput {
  return can(ctx, "document.confidential") ? {} : { visibility: { not: "CONFIDENTIAL" } };
}

export type DocumentFilters = ListQuery & { category?: string; visibility?: string; projectId?: string; partnerId?: string };

export async function listDocuments(ctx: OrgContext, q: DocumentFilters) {
  assertCan(ctx, "document.read");
  const category = enumOrUndefined(q.category, DOCUMENT_CATEGORIES);
  const visibility = enumOrUndefined(q.visibility, DOCUMENT_VISIBILITY);
  const where: Prisma.DocumentWhereInput = {
    organisationId: ctx.organisationId,
    archivedAt: q.status === "archived" ? { not: null } : null,
    ...visibilityFilter(ctx),
    ...(category ? { category } : {}),
    ...(visibility ? { AND: [{ visibility }] } : {}),
    ...(q.projectId ? { projectId: q.projectId } : {}),
    ...(q.partnerId ? { partnerId: q.partnerId } : {}),
    ...(q.q ? { title: { contains: q.q, mode: "insensitive" } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.document.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      ...skipTake(q),
      include: {
        project: { select: { id: true, title: true } },
        partner: { select: { id: true, name: true } },
        currentVersion: { include: { mediaAsset: { select: { id: true, filename: true, size: true, mimeType: true } } } },
      },
    }),
    prisma.document.count({ where }),
  ]);
  return paged(items, total, q);
}

export async function getDocument(ctx: OrgContext, id: string) {
  assertCan(ctx, "document.read");
  const doc = await prisma.document.findFirst({
    where: { id, organisationId: ctx.organisationId },
    include: {
      project: { select: { id: true, title: true } },
      partner: { select: { id: true, name: true } },
      versions: { orderBy: { version: "desc" }, include: { mediaAsset: { select: { id: true, filename: true, size: true, mimeType: true } }, uploadedBy: { select: { name: true } } } },
    },
  });
  if (!doc) throw new NotFoundError("Document");
  if (doc.visibility === "CONFIDENTIAL" && !can(ctx, "document.confidential")) throw new NotFoundError("Document");
  const history = await prisma.auditLog.findMany({ where: { organisationId: ctx.organisationId, entityType: "Document", entityId: id }, orderBy: { createdAt: "desc" }, take: 50, include: { actor: { select: { name: true } } } });
  return { ...doc, history };
}

async function validateDocRefs(ctx: OrgContext, data: { projectId?: string | null; partnerId?: string | null }) {
  if (data.projectId) ensureOwned(ctx, await prisma.project.findUnique({ where: { id: data.projectId } }), "Project");
  if (data.partnerId) ensureOwned(ctx, await prisma.partnerOrganisation.findUnique({ where: { id: data.partnerId } }), "Partner");
}

function assertVisibilityAllowed(ctx: OrgContext, visibility: string) {
  if (visibility === "CONFIDENTIAL" && !can(ctx, "document.confidential")) throw new ForbiddenError("You cannot create confidential documents");
}

/** Creates a document with its first file version. Files are always stored privately. */
export async function createDocument(ctx: OrgContext, input: unknown, file: { filename: string; data: Buffer }) {
  assertCan(ctx, "document.write");
  const data = parseInput(docSchema, input);
  assertVisibilityAllowed(ctx, data.visibility);
  await validateDocRefs(ctx, data);
  const asset = await uploadMedia(ctx, { filename: file.filename, data: file.data, visibility: "PRIVATE", title: data.title }, { permission: "document.write" });
  return prisma.$transaction(async (tx) => {
    const doc = await tx.document.create({ data: { ...data, organisationId: ctx.organisationId } });
    const v = await tx.documentVersion.create({ data: { organisationId: ctx.organisationId, documentId: doc.id, version: 1, mediaAssetId: asset.id, uploadedById: ctx.user.id } });
    await tx.document.update({ where: { id: doc.id }, data: { currentVersionId: v.id } });
    if (data.partnerId) {
      const partner = await tx.partnerOrganisation.findUnique({ where: { id: data.partnerId } });
      if (partner && ["NOT_STARTED", "INFORMATION_SUPPLIED"].includes(partner.verificationStatus) && data.category === "DUE_DILIGENCE") {
        await tx.partnerOrganisation.update({ where: { id: partner.id }, data: { verificationStatus: "DOCUMENTS_UPLOADED" } });
      }
    }
    await audit(actorOf(ctx), { action: "document.create", entityType: "Document", entityId: doc.id, summary: `Uploaded document ${doc.title} (${doc.visibility.toLowerCase()})` }, tx);
    return doc;
  });
}

export async function addDocumentVersion(ctx: OrgContext, id: string, file: { filename: string; data: Buffer }, notes?: string | null) {
  assertCan(ctx, "document.write");
  const doc = ensureOwned(ctx, await prisma.document.findUnique({ where: { id } }), "Document");
  assertVisibilityAllowed(ctx, doc.visibility);
  const asset = await uploadMedia(ctx, { filename: file.filename, data: file.data, visibility: "PRIVATE", title: doc.title }, { permission: "document.write" });
  await prisma.$transaction(async (tx) => {
    const last = await tx.documentVersion.findFirst({ where: { documentId: id }, orderBy: { version: "desc" } });
    const v = await tx.documentVersion.create({ data: { organisationId: ctx.organisationId, documentId: id, version: (last?.version ?? 0) + 1, mediaAssetId: asset.id, uploadedById: ctx.user.id, notes: notes?.slice(0, 1000) } });
    // A new file needs a fresh review.
    await tx.document.update({ where: { id }, data: { currentVersionId: v.id, status: doc.status === "APPROVED" ? "DRAFT" : doc.status } });
    await audit(actorOf(ctx), { action: "document.version", entityType: "Document", entityId: id, summary: `Uploaded version ${v.version} of ${doc.title}` }, tx);
  });
  if (doc.visibility === "PUBLIC") invalidateSite(ctx.organisationId);
}

export async function updateDocument(ctx: OrgContext, id: string, input: unknown) {
  assertCan(ctx, "document.write");
  const before = ensureOwned(ctx, await prisma.document.findUnique({ where: { id } }), "Document");
  assertVisibilityAllowed(ctx, before.visibility);
  const data = parseInput(docSchema, input);
  assertVisibilityAllowed(ctx, data.visibility);
  await validateDocRefs(ctx, data);
  const doc = await prisma.document.update({ where: { id }, data });
  await audit(actorOf(ctx), { action: "document.update", entityType: "Document", entityId: id, summary: `Updated document ${doc.title}`, metadata: diff(before, data) });
  if (before.visibility === "PUBLIC" || doc.visibility === "PUBLIC") invalidateSite(ctx.organisationId);
  return doc;
}

export async function setDocumentStatus(ctx: OrgContext, id: string, status: "DRAFT" | "IN_REVIEW" | "APPROVED" | "REJECTED") {
  const doc = ensureOwned(ctx, await prisma.document.findUnique({ where: { id } }), "Document");
  assertCan(ctx, status === "APPROVED" || status === "REJECTED" ? "report.approve" : "document.write");
  assertVisibilityAllowed(ctx, doc.visibility);
  await prisma.document.update({ where: { id }, data: { status } });
  await audit(actorOf(ctx), { action: "document.status", entityType: "Document", entityId: id, summary: `Document ${doc.title}: ${doc.status} → ${status}` });
  if (status === "IN_REVIEW") {
    await notifyPermission(ctx.organisationId, "report.approve", { type: "document.review", title: `Document awaiting review: ${doc.title}`, link: `/admin/documents/${id}` }, ctx.user.id);
  }
  if (doc.visibility === "PUBLIC") invalidateSite(ctx.organisationId);
}

export async function setDocumentArchived(ctx: OrgContext, id: string, archived: boolean) {
  assertCan(ctx, "document.write");
  const doc = ensureOwned(ctx, await prisma.document.findUnique({ where: { id } }), "Document");
  assertVisibilityAllowed(ctx, doc.visibility);
  await prisma.document.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
  await audit(actorOf(ctx), { action: archived ? "document.archive" : "document.restore", entityType: "Document", entityId: id, summary: `${archived ? "Archived" : "Restored"} ${doc.title}` });
  invalidateSite(ctx.organisationId);
}

export async function documentOptions(ctx: OrgContext) {
  if (!can(ctx, "document.read")) return [];
  return prisma.document.findMany({ where: { organisationId: ctx.organisationId, archivedAt: null, ...visibilityFilter(ctx) }, orderBy: { updatedAt: "desc" }, take: 300, select: { id: true, title: true } });
}

/** Public access: only approved, public, non-archived documents. */
export async function getPublicDocumentFile(organisationId: string, documentId: string) {
  const doc = await prisma.document.findFirst({
    where: { id: documentId, organisationId, visibility: "PUBLIC", status: "APPROVED", archivedAt: null },
    include: { currentVersion: { include: { mediaAsset: true } } },
  });
  if (!doc?.currentVersion) throw new ValidationError("Document not available");
  return { doc, asset: doc.currentVersion.mediaAsset };
}
