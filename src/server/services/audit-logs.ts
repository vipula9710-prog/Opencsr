import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { assertCan, type OrgContext } from "../context";
import { paged, skipTake, type ListQuery } from "./common";
import { toCsv } from "@/lib/csv";

export type AuditFilters = ListQuery & { entityType?: string; actorId?: string; action?: string };

export async function listAuditLogs(ctx: OrgContext, q: AuditFilters) {
  assertCan(ctx, "audit.read");
  const where: Prisma.AuditLogWhereInput = {
    organisationId: ctx.organisationId,
    ...(q.entityType ? { entityType: q.entityType } : {}),
    ...(q.actorId ? { actorId: q.actorId } : {}),
    ...(q.action ? { action: { startsWith: q.action } } : {}),
    ...(q.q ? { summary: { contains: q.q, mode: "insensitive" } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, ...skipTake(q), include: { actor: { select: { name: true, email: true } } } }),
    prisma.auditLog.count({ where }),
  ]);
  return paged(items, total, q);
}

export async function auditEntityTypes(ctx: OrgContext) {
  assertCan(ctx, "audit.read");
  const rows = await prisma.auditLog.groupBy({ by: ["entityType"], where: { organisationId: ctx.organisationId }, orderBy: { entityType: "asc" } });
  return rows.map((r) => r.entityType);
}

export async function exportAuditCsv(ctx: OrgContext) {
  assertCan(ctx, "audit.read");
  const rows = await prisma.auditLog.findMany({ where: { organisationId: ctx.organisationId }, orderBy: { createdAt: "desc" }, take: 50000, include: { actor: { select: { email: true } } } });
  return toCsv(["Time", "Actor", "Action", "Entity type", "Entity ID", "Summary", "IP"], rows.map((r) => [r.createdAt, r.actor?.email ?? "system", r.action, r.entityType, r.entityId, r.summary, r.ipAddress]));
}

export async function recentActivity(ctx: OrgContext, take = 8) {
  // Shown on the dashboard to anyone who can read audit logs.
  if (!ctx.permissions.has("audit.read")) return [];
  return prisma.auditLog.findMany({
    where: { organisationId: ctx.organisationId, NOT: { action: { startsWith: "auth." } } },
    orderBy: { createdAt: "desc" },
    take,
    include: { actor: { select: { name: true } } },
  });
}
