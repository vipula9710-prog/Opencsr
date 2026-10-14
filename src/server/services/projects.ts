import { Prisma, type ProjectStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { actorOf, assertCan, can, ensureOwned, type OrgContext } from "../context";
import { audit, diff } from "../audit";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../errors";
import { parseInput } from "../validation";
import { sanitizeRichText } from "../sanitize";
import { invalidateSite } from "../cache";
import { zCheckbox, zOptDate, zOptId, zOptText, zSlug, zText } from "@/lib/zod-helpers";
import { slugify } from "@/lib/utils";
import { toCsv } from "@/lib/csv";
import { sumMoney } from "@/lib/money";
import { enumOrUndefined, paged, skipTake, sortBy, type ListQuery } from "./common";
import { notify } from "./notifications";
import { approvalRules } from "./website";

export const PROJECT_STATUSES = ["DRAFT", "PLANNED", "ACTIVE", "ON_HOLD", "COMPLETED", "ARCHIVED"] as const;

// ---------------------------------------------------------------------------
// Programmes
// ---------------------------------------------------------------------------

const programmeSchema = z.object({
  name: zText(160),
  slug: zSlug.optional().or(z.literal("")),
  description: zOptText(4000),
  focusAreaId: zOptId,
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).default("ACTIVE"),
  startDate: zOptDate,
  endDate: zOptDate,
});

export async function listProgrammes(ctx: OrgContext, opts: { includeArchived?: boolean } = {}) {
  assertCan(ctx, "programme.read");
  return prisma.programme.findMany({
    where: { organisationId: ctx.organisationId, ...(opts.includeArchived ? {} : { status: { not: "ARCHIVED" } }) },
    orderBy: { name: "asc" },
    include: { focusArea: { select: { name: true } }, _count: { select: { projects: true } } },
  });
}

export async function getProgramme(ctx: OrgContext, id: string) {
  assertCan(ctx, "programme.read");
  const p = await prisma.programme.findFirst({
    where: { id, organisationId: ctx.organisationId },
    include: {
      focusArea: true,
      projects: { where: { archivedAt: null }, orderBy: { title: "asc" }, select: { id: true, title: true, status: true, startDate: true, endDate: true } },
      impactIndicators: { where: { archivedAt: null }, select: { id: true, name: true, unit: true, target: true } },
    },
  });
  if (!p) throw new NotFoundError("Programme");
  return p;
}

async function validateRefs(ctx: OrgContext, refs: { focusAreaId?: string | null; programmeId?: string | null; partnerId?: string | null; ownerId?: string | null }) {
  const org = ctx.organisationId;
  if (refs.focusAreaId && !(await prisma.focusArea.findFirst({ where: { id: refs.focusAreaId, organisationId: org } })))
    throw new ValidationError("Invalid focus area", { focusAreaId: ["Not found"] });
  if (refs.programmeId && !(await prisma.programme.findFirst({ where: { id: refs.programmeId, organisationId: org } })))
    throw new ValidationError("Invalid programme", { programmeId: ["Not found"] });
  if (refs.partnerId && !(await prisma.partnerOrganisation.findFirst({ where: { id: refs.partnerId, organisationId: org } })))
    throw new ValidationError("Invalid partner", { partnerId: ["Not found"] });
  if (refs.ownerId && !(await prisma.membership.findFirst({ where: { userId: refs.ownerId, organisationId: org } })))
    throw new ValidationError("The project owner must be a member of this organisation", { ownerId: ["Not a member"] });
}

export async function saveProgramme(ctx: OrgContext, id: string | null, input: unknown) {
  assertCan(ctx, "programme.write");
  const data = parseInput(programmeSchema, input);
  await validateRefs(ctx, { focusAreaId: data.focusAreaId });
  const slug = data.slug || slugify(data.name);
  if (data.startDate && data.endDate && data.endDate < data.startDate) throw new ValidationError("End date must be after start date", { endDate: ["Must be after start date"] });
  try {
    if (id) {
      const before = ensureOwned(ctx, await prisma.programme.findUnique({ where: { id } }), "Programme");
      const p = await prisma.programme.update({ where: { id: before.id }, data: { ...data, slug } });
      await audit(actorOf(ctx), { action: "programme.update", entityType: "Programme", entityId: p.id, summary: `Updated programme ${p.name}`, metadata: diff(before, { ...data, slug }) });
      return p;
    }
    const p = await prisma.programme.create({ data: { ...data, slug, organisationId: ctx.organisationId } });
    await audit(actorOf(ctx), { action: "programme.create", entityType: "Programme", entityId: p.id, summary: `Created programme ${p.name}` });
    return p;
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") throw new ConflictError("A programme with this slug exists", { slug: ["Already in use"] });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

const projectSchema = z.object({
  title: zText(200),
  slug: zSlug.optional().or(z.literal("")),
  summary: zOptText(600),
  description: zOptText(50000),
  objectives: zOptText(5000),
  programmeId: zOptId,
  focusAreaId: zOptId,
  partnerId: zOptId,
  ownerId: zOptId,
  location: zOptText(300),
  startDate: zOptDate,
  endDate: zOptDate,
  status: z.enum(PROJECT_STATUSES).optional(),
  risks: zOptText(5000),
  dependencies: zOptText(5000),
  notes: zOptText(10000),
  isPublic: zCheckbox,
  publicSummary: zOptText(1000),
  coverImageId: zOptId,
  memberIds: z.array(z.string().max(60)).max(50).optional(),
});

export type ProjectFilters = ListQuery & { programmeId?: string; focusAreaId?: string; archived?: string };

export async function listProjects(ctx: OrgContext, q: ProjectFilters) {
  assertCan(ctx, "project.read");
  const status = enumOrUndefined(q.status, PROJECT_STATUSES);
  const where: Prisma.ProjectWhereInput = {
    organisationId: ctx.organisationId,
    ...(q.archived === "1" ? { status: "ARCHIVED" } : status ? { status } : { status: { not: "ARCHIVED" } }),
    ...(q.programmeId ? { programmeId: q.programmeId } : {}),
    ...(q.focusAreaId ? { focusAreaId: q.focusAreaId } : {}),
    ...(q.q ? { OR: [{ title: { contains: q.q, mode: "insensitive" } }, { location: { contains: q.q, mode: "insensitive" } }, { summary: { contains: q.q, mode: "insensitive" } }] } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.project.findMany({
      where,
      orderBy: sortBy(q, ["title", "status", "startDate", "endDate", "updatedAt", "createdAt"] as const, "updatedAt"),
      ...skipTake(q),
      include: {
        programme: { select: { id: true, name: true } },
        focusArea: { select: { id: true, name: true } },
        owner: { select: { id: true, name: true } },
        partner: { select: { id: true, name: true } },
      },
    }),
    prisma.project.count({ where }),
  ]);
  return paged(items, total, q);
}

export async function getProject(ctx: OrgContext, id: string) {
  assertCan(ctx, "project.read");
  const project = await prisma.project.findFirst({
    where: { id, organisationId: ctx.organisationId },
    include: {
      programme: true,
      focusArea: true,
      partner: { select: { id: true, name: true, verificationStatus: true } },
      owner: { select: { id: true, name: true, email: true } },
      coverImage: true,
      members: { include: { user: { select: { id: true, name: true } } } },
      milestones: { orderBy: [{ sortOrder: "asc" }, { dueDate: "asc" }] },
      tasks: { orderBy: [{ status: "asc" }, { dueDate: "asc" }], include: { assignee: { select: { id: true, name: true } } } },
      statusChanges: { orderBy: { createdAt: "desc" }, take: 20, include: { changedBy: { select: { name: true } } } },
      media: { include: { mediaAsset: true }, orderBy: { sortOrder: "asc" } },
      impactIndicators: { where: { archivedAt: null }, include: { measurements: { orderBy: { periodEnd: "desc" }, take: 1 } } },
    },
  });
  if (!project) throw new NotFoundError("Project");
  const canSeeConfidential = can(ctx, "document.confidential");
  const documents = can(ctx, "document.read")
    ? await prisma.document.findMany({
        where: { organisationId: ctx.organisationId, projectId: id, archivedAt: null, ...(canSeeConfidential ? {} : { visibility: { not: "CONFIDENTIAL" } }) },
        include: { currentVersion: { include: { mediaAsset: { select: { id: true, filename: true, size: true, mimeType: true } } } } },
        orderBy: { updatedAt: "desc" },
      })
    : [];
  let finance: { allocated: string; committed: string; incurred: string; disbursed: string } | null = null;
  if (can(ctx, "finance.read")) {
    const [alloc, exp, disb] = await Promise.all([
      prisma.budgetAllocation.findMany({ where: { organisationId: ctx.organisationId, projectId: id }, select: { amount: true } }),
      prisma.expenditure.findMany({ where: { organisationId: ctx.organisationId, projectId: id, status: { not: "CANCELLED" } }, select: { amount: true, status: true } }),
      prisma.disbursement.findMany({ where: { organisationId: ctx.organisationId, projectId: id, status: "DISBURSED" }, select: { amount: true } }),
    ]);
    finance = {
      allocated: sumMoney(alloc.map((a) => a.amount)),
      committed: sumMoney(exp.filter((e) => e.status === "COMMITTED").map((e) => e.amount)),
      incurred: sumMoney(exp.filter((e) => e.status === "INCURRED").map((e) => e.amount)),
      disbursed: sumMoney(disb.map((d) => d.amount)),
    };
  }
  // Internal notes are only exposed to users who can edit projects.
  return { ...project, notes: can(ctx, "project.write") ? project.notes : null, documents, finance };
}

function normaliseProject(data: z.infer<typeof projectSchema>) {
  if (data.startDate && data.endDate && data.endDate < data.startDate) throw new ValidationError("End date must be after start date", { endDate: ["Must be after start date"] });
  const { memberIds: _m, ...rest } = data;
  return { ...rest, slug: data.slug || slugify(data.title), description: data.description ? sanitizeRichText(data.description) : null };
}

async function syncMembers(tx: Prisma.TransactionClient, ctx: OrgContext, projectId: string, memberIds: string[] | undefined) {
  if (!memberIds) return;
  const valid = await tx.membership.findMany({ where: { organisationId: ctx.organisationId, userId: { in: memberIds } }, select: { userId: true } });
  const ids = valid.map((v) => v.userId);
  await tx.projectMember.deleteMany({ where: { projectId, userId: { notIn: ids } } });
  for (const userId of ids) {
    await tx.projectMember.upsert({
      where: { projectId_userId: { projectId, userId } },
      create: { organisationId: ctx.organisationId, projectId, userId },
      update: {},
    });
  }
}

async function validateCover(ctx: OrgContext, coverImageId: string | null | undefined) {
  if (!coverImageId) return;
  const asset = await prisma.mediaAsset.findFirst({ where: { id: coverImageId, organisationId: ctx.organisationId, mimeType: { startsWith: "image/" } } });
  if (!asset) throw new ValidationError("Invalid cover image", { coverImageId: ["Choose an image from the media library"] });
}

export async function createProject(ctx: OrgContext, input: unknown) {
  assertCan(ctx, "project.write");
  const data = parseInput(projectSchema, input);
  await validateRefs(ctx, data);
  await validateCover(ctx, data.coverImageId);
  const values = normaliseProject(data);
  const status = values.status ?? "DRAFT";
  try {
    const project = await prisma.$transaction(async (tx) => {
      const p = await tx.project.create({ data: { ...values, status, organisationId: ctx.organisationId } });
      await tx.projectStatusChange.create({ data: { organisationId: ctx.organisationId, projectId: p.id, toStatus: status, changedById: ctx.user.id, note: "Project created" } });
      await syncMembers(tx, ctx, p.id, data.memberIds);
      await audit(actorOf(ctx), { action: "project.create", entityType: "Project", entityId: p.id, summary: `Created project ${p.title}` }, tx);
      return p;
    });
    if (project.ownerId && project.ownerId !== ctx.user.id) {
      await notify(ctx.organisationId, project.ownerId, { type: "project.assigned", title: `You are the owner of “${project.title}”`, link: `/admin/projects/${project.id}` });
    }
    if (project.isPublic) invalidateSite(ctx.organisationId);
    return project;
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") throw new ConflictError("A project with this slug exists", { slug: ["Already in use"] });
    throw err;
  }
}

export async function updateProject(ctx: OrgContext, id: string, input: unknown) {
  assertCan(ctx, "project.write");
  const before = ensureOwned(ctx, await prisma.project.findUnique({ where: { id } }), "Project");
  const data = parseInput(projectSchema, input);
  await validateRefs(ctx, data);
  await validateCover(ctx, data.coverImageId);
  const { status: requestedStatus, ...values } = normaliseProject(data);
  try {
    const project = await prisma.$transaction(async (tx) => {
      const p = await tx.project.update({ where: { id: before.id }, data: values });
      await syncMembers(tx, ctx, p.id, data.memberIds);
      await audit(actorOf(ctx), { action: "project.update", entityType: "Project", entityId: p.id, summary: `Updated project ${p.title}`, metadata: diff(before, values) }, tx);
      return p;
    });
    if (requestedStatus && requestedStatus !== before.status) await changeProjectStatus(ctx, id, requestedStatus, null);
    if (before.isPublic || project.isPublic) invalidateSite(ctx.organisationId);
    if (project.ownerId && project.ownerId !== before.ownerId && project.ownerId !== ctx.user.id) {
      await notify(ctx.organisationId, project.ownerId, { type: "project.assigned", title: `You are now the owner of “${project.title}”`, link: `/admin/projects/${project.id}` });
    }
    return project;
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") throw new ConflictError("A project with this slug exists", { slug: ["Already in use"] });
    throw err;
  }
}

/**
 * Changes a project's status, recording history. When the organisation
 * requires approval for status changes, a request is created instead unless
 * the user can review approvals.
 */
export async function changeProjectStatus(ctx: OrgContext, id: string, status: ProjectStatus, note: string | null, opts: { viaApproval?: boolean } = {}) {
  assertCan(ctx, status === "ARCHIVED" ? "project.archive" : "project.write");
  const project = ensureOwned(ctx, await prisma.project.findUnique({ where: { id } }), "Project");
  if (project.status === status) return { pending: false };
  if (!opts.viaApproval && approvalRules(ctx).projectStatus && !can(ctx, "approval.review")) {
    const { requestApproval } = await import("./approvals");
    await requestApproval(ctx, {
      type: "PROJECT_STATUS",
      entityId: id,
      title: `Change “${project.title}” status: ${project.status} → ${status}`,
      payload: { projectId: id, status, note },
    });
    return { pending: true };
  }
  await prisma.$transaction(async (tx) => {
    await tx.project.update({
      where: { id },
      data: { status, archivedAt: status === "ARCHIVED" ? new Date() : null },
    });
    await tx.projectStatusChange.create({ data: { organisationId: ctx.organisationId, projectId: id, fromStatus: project.status, toStatus: status, note, changedById: ctx.user.id } });
    await audit(actorOf(ctx), { action: "project.status", entityType: "Project", entityId: id, summary: `Status of ${project.title}: ${project.status} → ${status}`, metadata: { from: project.status, to: status, note } }, tx);
  });
  if (project.ownerId && project.ownerId !== ctx.user.id) {
    await notify(ctx.organisationId, project.ownerId, { type: "project.status", title: `“${project.title}” is now ${status.replace("_", " ").toLowerCase()}`, link: `/admin/projects/${id}` });
  }
  if (project.isPublic) invalidateSite(ctx.organisationId);
  return { pending: false };
}

export async function archiveProject(ctx: OrgContext, id: string) {
  return changeProjectStatus(ctx, id, "ARCHIVED", "Archived");
}

export async function restoreProject(ctx: OrgContext, id: string) {
  assertCan(ctx, "project.archive");
  const project = ensureOwned(ctx, await prisma.project.findUnique({ where: { id } }), "Project");
  if (project.status !== "ARCHIVED") return;
  const last = await prisma.projectStatusChange.findFirst({ where: { projectId: id, toStatus: "ARCHIVED" }, orderBy: { createdAt: "desc" } });
  return changeProjectStatus(ctx, id, last?.fromStatus ?? "DRAFT", "Restored from archive", { viaApproval: true });
}

export async function projectHistory(ctx: OrgContext, id: string) {
  assertCan(ctx, "project.read");
  ensureOwned(ctx, await prisma.project.findUnique({ where: { id } }), "Project");
  return prisma.auditLog.findMany({
    where: { organisationId: ctx.organisationId, entityType: "Project", entityId: id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { actor: { select: { name: true } } },
  });
}

export async function attachProjectMedia(ctx: OrgContext, projectId: string, mediaAssetId: string, input: { caption?: string; isPublic?: boolean }) {
  assertCan(ctx, "project.write");
  ensureOwned(ctx, await prisma.project.findUnique({ where: { id: projectId } }), "Project");
  const asset = ensureOwned(ctx, await prisma.mediaAsset.findUnique({ where: { id: mediaAssetId } }), "File");
  if (input.isPublic && asset.visibility !== "PUBLIC") throw new ValidationError("Only public media can be shown on the public website");
  await prisma.projectMedia.upsert({
    where: { projectId_mediaAssetId: { projectId, mediaAssetId } },
    create: { organisationId: ctx.organisationId, projectId, mediaAssetId, caption: input.caption?.slice(0, 300), isPublic: !!input.isPublic },
    update: { caption: input.caption?.slice(0, 300), isPublic: !!input.isPublic },
  });
  await audit(actorOf(ctx), { action: "project.media", entityType: "Project", entityId: projectId, summary: `Attached ${asset.filename}` });
  invalidateSite(ctx.organisationId);
}

export async function detachProjectMedia(ctx: OrgContext, projectId: string, projectMediaId: string) {
  assertCan(ctx, "project.write");
  const pm = ensureOwned(ctx, await prisma.projectMedia.findUnique({ where: { id: projectMediaId } }), "Attachment");
  if (pm.projectId !== projectId) throw new NotFoundError("Attachment");
  await prisma.projectMedia.delete({ where: { id: pm.id } });
  invalidateSite(ctx.organisationId);
}

export async function exportProjectsCsv(ctx: OrgContext) {
  assertCan(ctx, "project.read");
  const projects = await prisma.project.findMany({
    where: { organisationId: ctx.organisationId },
    orderBy: { title: "asc" },
    include: { programme: true, focusArea: true, owner: true, partner: true },
  });
  await audit(actorOf(ctx), { action: "project.export", entityType: "Project", summary: `Exported ${projects.length} projects to CSV` });
  return toCsv(
    ["Title", "Slug", "Status", "Programme", "Focus area", "Partner", "Owner", "Location", "Start date", "End date", "Public", "Summary", "Created", "Updated"],
    projects.map((p) => [
      p.title, p.slug, p.status, p.programme?.name, p.focusArea?.name, p.partner?.name, p.owner?.name, p.location,
      p.startDate?.toISOString().slice(0, 10), p.endDate?.toISOString().slice(0, 10), p.isPublic ? "yes" : "no", p.summary,
      p.createdAt, p.updatedAt,
    ]),
  );
}

export async function projectOptions(ctx: OrgContext) {
  if (!can(ctx, "project.read") && !can(ctx, "finance.read") && !can(ctx, "website.edit")) throw new ForbiddenError();
  return prisma.project.findMany({
    where: { organisationId: ctx.organisationId, status: { not: "ARCHIVED" } },
    orderBy: { title: "asc" },
    select: { id: true, title: true, isPublic: true, partnerId: true, programmeId: true },
  });
}
