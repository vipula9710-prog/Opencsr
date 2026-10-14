import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { actorOf, assertCan, can, ensureOwned, type OrgContext } from "../context";
import { audit, diff } from "../audit";
import { NotFoundError, ValidationError } from "../errors";
import { parseInput } from "../validation";
import { zCheckbox, zDate, zDecimal, zOptDecimal, zOptId, zOptText, zText } from "@/lib/zod-helpers";
import { toCsv } from "@/lib/csv";
import { invalidateSite } from "../cache";
import { approvalRules } from "./website";
import { notifyPermission } from "./notifications";

const indicatorSchema = z.object({
  name: zText(200),
  description: zOptText(2000),
  unit: zText(60),
  definition: zOptText(2000),
  baseline: zOptDecimal,
  target: zOptDecimal,
  direction: z.enum(["INCREASE", "DECREASE"]),
  isBeneficiaryMetric: zCheckbox,
  dataSource: zOptText(500),
  frequency: zOptText(80),
  responsibleId: zOptId,
  programmeId: zOptId,
  projectId: zOptId,
  isPublic: zCheckbox,
  notes: zOptText(4000),
});

export async function listIndicators(ctx: OrgContext, filters: { projectId?: string; programmeId?: string; q?: string } = {}) {
  assertCan(ctx, "impact.read");
  const indicators = await prisma.impactIndicator.findMany({
    where: {
      organisationId: ctx.organisationId,
      archivedAt: null,
      ...(filters.projectId ? { projectId: filters.projectId } : {}),
      ...(filters.programmeId ? { programmeId: filters.programmeId } : {}),
      ...(filters.q ? { name: { contains: filters.q, mode: "insensitive" } } : {}),
    },
    orderBy: { name: "asc" },
    include: {
      project: { select: { id: true, title: true } },
      programme: { select: { id: true, name: true } },
      responsible: { select: { name: true } },
      measurements: { orderBy: { periodEnd: "desc" } },
    },
  });
  return indicators.map((i) => ({ ...i, progress: indicatorProgress(i) }));
}

type IndicatorLike = {
  baseline: Prisma.Decimal | null;
  target: Prisma.Decimal | null;
  direction: "INCREASE" | "DECREASE";
  measurements: { value: Prisma.Decimal; verificationStatus: string; periodEnd: Date }[];
};

/**
 * Progress toward target based on the latest measurement. Reports separately
 * whether the latest value has been verified — entered figures are never
 * treated as verified results.
 */
export function indicatorProgress(i: IndicatorLike) {
  const latest = [...i.measurements].sort((a, b) => b.periodEnd.getTime() - a.periodEnd.getTime())[0];
  const latestVerified = [...i.measurements].filter((m) => m.verificationStatus === "VERIFIED").sort((a, b) => b.periodEnd.getTime() - a.periodEnd.getTime())[0];
  const baseline = i.baseline ? Number(i.baseline) : 0;
  const target = i.target !== null ? Number(i.target) : null;
  const pct = (value: number | null) => {
    if (value === null || target === null || target === baseline) return null;
    const raw = ((value - baseline) / (target - baseline)) * 100;
    return Math.max(0, Math.round(raw * 10) / 10);
  };
  return {
    latestValue: latest ? latest.value.toString() : null,
    latestVerified: latest?.verificationStatus === "VERIFIED",
    latestStatus: latest?.verificationStatus ?? null,
    latestPeriodEnd: latest?.periodEnd ?? null,
    progressPct: pct(latest ? Number(latest.value) : null),
    verifiedValue: latestVerified ? latestVerified.value.toString() : null,
    verifiedProgressPct: pct(latestVerified ? Number(latestVerified.value) : null),
  };
}

export async function getIndicator(ctx: OrgContext, id: string) {
  assertCan(ctx, "impact.read");
  const i = await prisma.impactIndicator.findFirst({
    where: { id, organisationId: ctx.organisationId },
    include: {
      project: { select: { id: true, title: true } },
      programme: { select: { id: true, name: true } },
      responsible: { select: { id: true, name: true } },
      measurements: {
        orderBy: { periodEnd: "asc" },
        include: {
          recordedBy: { select: { name: true } },
          verifiedBy: { select: { name: true } },
          evidenceDocument: { select: { id: true, title: true, visibility: true } },
        },
      },
    },
  });
  if (!i) throw new NotFoundError("Indicator");
  return { ...i, progress: indicatorProgress(i) };
}

async function validateIndicatorRefs(ctx: OrgContext, d: { projectId?: string | null; programmeId?: string | null; responsibleId?: string | null }) {
  if (d.projectId) ensureOwned(ctx, await prisma.project.findUnique({ where: { id: d.projectId } }), "Project");
  if (d.programmeId) ensureOwned(ctx, await prisma.programme.findUnique({ where: { id: d.programmeId } }), "Programme");
  if (d.responsibleId && !(await prisma.membership.findFirst({ where: { userId: d.responsibleId, organisationId: ctx.organisationId } })))
    throw new ValidationError("Responsible person must be a member", { responsibleId: ["Not a member"] });
}

export async function saveIndicator(ctx: OrgContext, id: string | null, input: unknown) {
  assertCan(ctx, "impact.write");
  const data = parseInput(indicatorSchema, input);
  await validateIndicatorRefs(ctx, data);
  if (id) {
    const before = ensureOwned(ctx, await prisma.impactIndicator.findUnique({ where: { id } }), "Indicator");
    const updated = await prisma.impactIndicator.update({ where: { id }, data });
    await audit(actorOf(ctx), { action: "impact.indicator.update", entityType: "ImpactIndicator", entityId: id, summary: `Updated indicator ${updated.name}`, metadata: diff(before, data) });
    if (before.isPublic || updated.isPublic) invalidateSite(ctx.organisationId);
    return updated;
  }
  const created = await prisma.impactIndicator.create({ data: { ...data, organisationId: ctx.organisationId } });
  await audit(actorOf(ctx), { action: "impact.indicator.create", entityType: "ImpactIndicator", entityId: created.id, summary: `Created indicator ${created.name}` });
  return created;
}

export async function archiveIndicator(ctx: OrgContext, id: string) {
  assertCan(ctx, "impact.write");
  const i = ensureOwned(ctx, await prisma.impactIndicator.findUnique({ where: { id } }), "Indicator");
  await prisma.impactIndicator.update({ where: { id }, data: { archivedAt: new Date() } });
  await audit(actorOf(ctx), { action: "impact.indicator.archive", entityType: "ImpactIndicator", entityId: id, summary: `Archived indicator ${i.name}` });
  invalidateSite(ctx.organisationId);
}

const measurementSchema = z
  .object({
    periodStart: zDate,
    periodEnd: zDate,
    value: zDecimal,
    dataSource: zOptText(500),
    notes: zOptText(2000),
    evidenceDocumentId: zOptId,
  })
  .refine((v) => v.periodEnd >= v.periodStart, { message: "Period end must be on or after the start", path: ["periodEnd"] });

export async function addMeasurement(ctx: OrgContext, indicatorId: string, input: unknown) {
  assertCan(ctx, "impact.write");
  const indicator = ensureOwned(ctx, await prisma.impactIndicator.findUnique({ where: { id: indicatorId } }), "Indicator");
  const data = parseInput(measurementSchema, input);
  if (data.evidenceDocumentId) ensureOwned(ctx, await prisma.document.findUnique({ where: { id: data.evidenceDocumentId } }), "Evidence document");
  const m = await prisma.impactMeasurement.create({
    data: { ...data, organisationId: ctx.organisationId, indicatorId, recordedById: ctx.user.id, verificationStatus: "UNVERIFIED" },
  });
  await audit(actorOf(ctx), {
    action: "impact.measurement.create",
    entityType: "ImpactIndicator",
    entityId: indicatorId,
    summary: `Recorded ${data.value} ${indicator.unit} for ${indicator.name} (unverified)`,
    metadata: { measurementId: m.id },
  });
  return m;
}

/** Send a measurement for review. */
export async function submitMeasurementForReview(ctx: OrgContext, measurementId: string) {
  assertCan(ctx, "impact.write");
  const m = ensureOwned(ctx, await prisma.impactMeasurement.findUnique({ where: { id: measurementId }, include: { indicator: true } }), "Measurement");
  await prisma.impactMeasurement.update({ where: { id: m.id }, data: { verificationStatus: "UNDER_REVIEW" } });
  if (approvalRules(ctx).impactVerification) {
    const { requestApproval } = await import("./approvals");
    await requestApproval(ctx, { type: "IMPACT_MEASUREMENT", entityId: m.id, title: `Verify ${m.indicator.name}: ${m.value} ${m.indicator.unit}`, payload: { measurementId: m.id } });
  } else {
    await notifyPermission(ctx.organisationId, "impact.verify", { type: "impact.review", title: `Measurement awaiting verification: ${m.indicator.name}`, link: `/admin/impact/${m.indicatorId}` }, ctx.user.id);
  }
  await audit(actorOf(ctx), { action: "impact.measurement.submit", entityType: "ImpactIndicator", entityId: m.indicatorId, summary: `Submitted measurement for verification` });
}

export async function verifyMeasurement(ctx: OrgContext, measurementId: string, decision: "VERIFIED" | "REJECTED", note?: string | null) {
  assertCan(ctx, "impact.verify");
  const m = ensureOwned(ctx, await prisma.impactMeasurement.findUnique({ where: { id: measurementId }, include: { indicator: true } }), "Measurement");
  if (m.recordedById === ctx.user.id && ctx.role !== "ORG_ADMIN" && ctx.role !== "PLATFORM_ADMIN")
    throw new ValidationError("A measurement must be verified by someone other than the person who recorded it");
  await prisma.impactMeasurement.update({
    where: { id: m.id },
    data: { verificationStatus: decision, verifiedById: ctx.user.id, verifiedAt: new Date(), notes: note ? `${m.notes ? `${m.notes}\n` : ""}Review: ${note}` : m.notes },
  });
  await audit(actorOf(ctx), {
    action: "impact.measurement.verify",
    entityType: "ImpactIndicator",
    entityId: m.indicatorId,
    summary: `${decision === "VERIFIED" ? "Verified" : "Rejected"} measurement ${m.value} ${m.indicator.unit} for ${m.indicator.name}`,
    metadata: { measurementId: m.id, note },
  });
  if (m.indicator.isPublic) invalidateSite(ctx.organisationId);
}

export async function deleteMeasurement(ctx: OrgContext, measurementId: string) {
  assertCan(ctx, "impact.write");
  const m = ensureOwned(ctx, await prisma.impactMeasurement.findUnique({ where: { id: measurementId } }), "Measurement");
  if (m.verificationStatus === "VERIFIED" && !can(ctx, "impact.verify")) throw new ValidationError("Verified measurements can only be removed by a reviewer");
  await prisma.impactMeasurement.delete({ where: { id: m.id } });
  await audit(actorOf(ctx), { action: "impact.measurement.delete", entityType: "ImpactIndicator", entityId: m.indicatorId, summary: `Deleted measurement ${m.value}` });
}

export async function exportImpactCsv(ctx: OrgContext) {
  const indicators = await listIndicators(ctx);
  await audit(actorOf(ctx), { action: "impact.export", entityType: "ImpactIndicator", summary: "Exported impact data" });
  const rows: unknown[][] = [];
  for (const i of indicators) {
    for (const m of i.measurements) {
      rows.push([i.name, i.unit, i.project?.title ?? "", i.programme?.name ?? "", i.baseline?.toString() ?? "", i.target?.toString() ?? "", m.periodStart.toISOString().slice(0, 10), m.periodEnd.toISOString().slice(0, 10), m.value.toString(), m.verificationStatus, m.dataSource ?? i.dataSource ?? ""]);
    }
    if (i.measurements.length === 0) rows.push([i.name, i.unit, i.project?.title ?? "", i.programme?.name ?? "", i.baseline?.toString() ?? "", i.target?.toString() ?? "", "", "", "", "NO MEASUREMENTS", i.dataSource ?? ""]);
  }
  return toCsv(["Indicator", "Unit", "Project", "Programme", "Baseline", "Target", "Period start", "Period end", "Actual value", "Verification", "Data source"], rows);
}
