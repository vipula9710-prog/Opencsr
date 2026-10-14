import { Prisma, type Report } from "@prisma/client";
import { z } from "zod";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { prisma } from "../db";
import { actorOf, assertCan, can, ensureOwned, type OrgContext } from "../context";
import { audit } from "../audit";
import { NotFoundError, ValidationError } from "../errors";
import { parseInput } from "../validation";
import { sanitizeRichText } from "../sanitize";
import { invalidateSite } from "../cache";
import { zOptDate, zOptId, zOptText, zText } from "@/lib/zod-helpers";
import { percentOf, sumMoney, formatMoney } from "@/lib/money";
import { stripHtml } from "@/lib/utils";
import { fyLabel, fyRange } from "./organisations";
import { indicatorProgress } from "./impact";
import { approvalRules } from "./website";
import { notifyPermission } from "./notifications";

export const REPORT_TYPES = ["CSR_ANNUAL", "PROJECT", "IMPACT", "BUDGET_SUMMARY"] as const;
export const REPORT_TYPE_LABELS: Record<(typeof REPORT_TYPES)[number], string> = {
  CSR_ANNUAL: "Annual CSR report",
  PROJECT: "Project report",
  IMPACT: "Impact report",
  BUDGET_SUMMARY: "Budget summary",
};

const reportSchema = z.object({
  title: zText(200),
  type: z.enum(REPORT_TYPES),
  summary: zOptText(30000),
  fyStartYear: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().min(2000).max(2100).nullable()).optional(),
  periodStart: zOptDate,
  periodEnd: zOptDate,
  projectId: zOptId,
  programmeId: zOptId,
});

export type ReportData = {
  generatedAt: string;
  organisation: { name: string; currency: string; locale: string };
  period: { label: string; start: string | null; end: string | null };
  projects: { title: string; status: string; location: string | null; startDate: string | null; endDate: string | null; partner: string | null }[];
  finance: null | {
    allocated: string;
    committed: string;
    utilised: string;
    disbursed: string;
    utilisationPct: number;
    byProject: { title: string; allocated: string; committed: string; utilised: string }[];
  };
  impact: {
    name: string;
    unit: string;
    baseline: string | null;
    target: string | null;
    measurements: { periodStart: string; periodEnd: string; value: string; verification: string }[];
    latestVerifiedValue: string | null;
  }[];
  milestones: { project: string; title: string; status: string; dueDate: string | null }[];
};

function resolvePeriod(ctx: OrgContext, r: Pick<Report, "fyStartYear" | "periodStart" | "periodEnd">) {
  if (r.periodStart && r.periodEnd) return { start: r.periodStart, end: r.periodEnd, label: `${r.periodStart.toISOString().slice(0, 10)} to ${r.periodEnd.toISOString().slice(0, 10)}` };
  if (r.fyStartYear) {
    const { start, end } = fyRange(r.fyStartYear, ctx.organisation.financialYearStartMonth);
    return { start, end, label: `Financial year ${fyLabel(r.fyStartYear, ctx.organisation.financialYearStartMonth)}` };
  }
  return { start: null, end: null, label: "All time" };
}

/** Builds report data from stored records only. Nothing is estimated or invented. */
export async function generateReportData(ctx: OrgContext, report: Report): Promise<ReportData> {
  const org = ctx.organisationId;
  const period = resolvePeriod(ctx, report);
  const projectWhere: Prisma.ProjectWhereInput = {
    organisationId: org,
    status: { not: "ARCHIVED" },
    ...(report.projectId ? { id: report.projectId } : {}),
    ...(report.programmeId ? { programmeId: report.programmeId } : {}),
  };
  const projects = await prisma.project.findMany({ where: projectWhere, orderBy: { title: "asc" }, include: { partner: { select: { name: true } } } });
  const projectIds = projects.map((p) => p.id);

  let finance: ReportData["finance"] = null;
  const includeFinance = (report.type === "BUDGET_SUMMARY" || report.type === "CSR_ANNUAL" || report.type === "PROJECT") && can(ctx, "finance.read");
  if (includeFinance) {
    const planFilter: Prisma.BudgetPlanWhereInput = report.fyStartYear ? { fyStartYear: report.fyStartYear } : {};
    const plans = await prisma.budgetPlan.findMany({ where: { organisationId: org, ...planFilter }, select: { id: true } });
    const planIds = plans.map((p) => p.id);
    const [allocations, expenditures, disbursements] = await Promise.all([
      prisma.budgetAllocation.findMany({ where: { organisationId: org, budgetPlanId: { in: planIds }, ...(report.projectId || report.programmeId ? { projectId: { in: projectIds } } : {}) }, include: { project: { select: { title: true } }, programme: { select: { name: true } } } }),
      prisma.expenditure.findMany({ where: { organisationId: org, budgetPlanId: { in: planIds }, projectId: { in: projectIds }, status: { not: "CANCELLED" } } }),
      prisma.disbursement.findMany({ where: { organisationId: org, budgetPlanId: { in: planIds }, projectId: { in: projectIds }, status: "DISBURSED" } }),
    ]);
    const allocated = sumMoney(allocations.map((a) => a.amount));
    const utilised = sumMoney(expenditures.filter((e) => e.status === "INCURRED").map((e) => e.amount));
    finance = {
      allocated,
      committed: sumMoney(expenditures.filter((e) => e.status === "COMMITTED").map((e) => e.amount)),
      utilised,
      disbursed: sumMoney(disbursements.map((d) => d.amount)),
      utilisationPct: percentOf(utilised, allocated),
      byProject: allocations
        .filter((a) => a.projectId)
        .map((a) => ({
          title: a.project?.title ?? "",
          allocated: a.amount.toString(),
          committed: sumMoney(expenditures.filter((e) => e.projectId === a.projectId && e.status === "COMMITTED").map((e) => e.amount)),
          utilised: sumMoney(expenditures.filter((e) => e.projectId === a.projectId && e.status === "INCURRED").map((e) => e.amount)),
        })),
    };
  }

  const indicators =
    report.type === "BUDGET_SUMMARY" || !can(ctx, "impact.read")
      ? []
      : await prisma.impactIndicator.findMany({
          where: {
            organisationId: org,
            archivedAt: null,
            ...(report.projectId ? { projectId: report.projectId } : report.programmeId ? { OR: [{ programmeId: report.programmeId }, { projectId: { in: projectIds } }] } : {}),
          },
          include: {
            measurements: {
              where: period.start && period.end ? { periodEnd: { gte: period.start, lte: period.end } } : {},
              orderBy: { periodEnd: "asc" },
            },
          },
          orderBy: { name: "asc" },
        });

  const milestones =
    report.type === "PROJECT" || report.type === "CSR_ANNUAL"
      ? await prisma.milestone.findMany({ where: { organisationId: org, projectId: { in: projectIds } }, orderBy: { dueDate: "asc" }, include: { project: { select: { title: true } } } })
      : [];

  return {
    generatedAt: new Date().toISOString(),
    organisation: { name: ctx.organisation.name, currency: ctx.organisation.currency, locale: ctx.organisation.locale },
    period: { label: period.label, start: period.start?.toISOString() ?? null, end: period.end?.toISOString() ?? null },
    projects: projects.map((p) => ({
      title: p.title,
      status: p.status,
      location: p.location,
      startDate: p.startDate?.toISOString() ?? null,
      endDate: p.endDate?.toISOString() ?? null,
      partner: p.partner?.name ?? null,
    })),
    finance,
    impact: indicators.map((i) => ({
      name: i.name,
      unit: i.unit,
      baseline: i.baseline?.toString() ?? null,
      target: i.target?.toString() ?? null,
      measurements: i.measurements.map((m) => ({ periodStart: m.periodStart.toISOString(), periodEnd: m.periodEnd.toISOString(), value: m.value.toString(), verification: m.verificationStatus })),
      latestVerifiedValue: indicatorProgress(i).verifiedValue,
    })),
    milestones: milestones.map((m) => ({ project: m.project.title, title: m.title, status: m.status, dueDate: m.dueDate?.toISOString() ?? null })),
  };
}

export async function listReports(ctx: OrgContext) {
  assertCan(ctx, "report.read");
  return prisma.report.findMany({
    where: { organisationId: ctx.organisationId },
    orderBy: { updatedAt: "desc" },
    include: { project: { select: { title: true } }, programme: { select: { name: true } } },
  });
}

export async function getReport(ctx: OrgContext, id: string) {
  assertCan(ctx, "report.read");
  const report = await prisma.report.findFirst({
    where: { id, organisationId: ctx.organisationId },
    include: { project: { select: { id: true, title: true } }, programme: { select: { id: true, name: true } } },
  });
  if (!report) throw new NotFoundError("Report");
  // Approved/published reports use their frozen snapshot; drafts are generated live.
  const data = report.snapshot ? (report.snapshot as unknown as ReportData) : await generateReportData(ctx, report);
  const history = await prisma.auditLog.findMany({ where: { organisationId: ctx.organisationId, entityType: "Report", entityId: id }, orderBy: { createdAt: "desc" }, take: 50, include: { actor: { select: { name: true } } } });
  return { report, data, history, isSnapshot: Boolean(report.snapshot) };
}

async function validateReportRefs(ctx: OrgContext, d: { projectId?: string | null; programmeId?: string | null; type: string; fyStartYear?: number | null }) {
  if (d.projectId) ensureOwned(ctx, await prisma.project.findUnique({ where: { id: d.projectId } }), "Project");
  if (d.programmeId) ensureOwned(ctx, await prisma.programme.findUnique({ where: { id: d.programmeId } }), "Programme");
  if (d.type === "PROJECT" && !d.projectId) throw new ValidationError("Choose a project for a project report", { projectId: ["Required"] });
  if ((d.type === "CSR_ANNUAL" || d.type === "BUDGET_SUMMARY") && !d.fyStartYear) throw new ValidationError("Choose a financial year", { fyStartYear: ["Required"] });
}

export async function saveReport(ctx: OrgContext, id: string | null, input: unknown) {
  assertCan(ctx, "report.write");
  const data = parseInput(reportSchema, input);
  await validateReportRefs(ctx, data);
  const values = { ...data, summary: data.summary ? sanitizeRichText(data.summary) : null };
  if (id) {
    const before = ensureOwned(ctx, await prisma.report.findUnique({ where: { id } }), "Report");
    if (before.status === "APPROVED" || before.status === "PUBLISHED") throw new ValidationError("Approved reports are locked. Return the report to draft to edit it.");
    const r = await prisma.report.update({ where: { id }, data: values });
    await audit(actorOf(ctx), { action: "report.update", entityType: "Report", entityId: id, summary: `Updated report ${r.title}` });
    return r;
  }
  const r = await prisma.report.create({ data: { ...values, organisationId: ctx.organisationId } });
  await audit(actorOf(ctx), { action: "report.create", entityType: "Report", entityId: r.id, summary: `Created report ${r.title}` });
  return r;
}

export async function submitReport(ctx: OrgContext, id: string) {
  assertCan(ctx, "report.write");
  const r = ensureOwned(ctx, await prisma.report.findUnique({ where: { id } }), "Report");
  if (r.status !== "DRAFT" && r.status !== "REJECTED") throw new ValidationError("Only draft or rejected reports can be submitted");
  await prisma.report.update({ where: { id }, data: { status: "IN_REVIEW" } });
  await audit(actorOf(ctx), { action: "report.submit", entityType: "Report", entityId: id, summary: `Submitted report ${r.title} for review` });
  await notifyPermission(ctx.organisationId, "report.approve", { type: "report.review", title: `Report awaiting review: ${r.title}`, link: `/admin/reports/${id}` }, ctx.user.id);
}

/** Approve a report: freezes its data snapshot. Optionally publishes it on the website. */
export async function approveReport(ctx: OrgContext, id: string, publish = false) {
  assertCan(ctx, "report.approve");
  const r = ensureOwned(ctx, await prisma.report.findUnique({ where: { id } }), "Report");
  if (!["IN_REVIEW", "APPROVED"].includes(r.status)) throw new ValidationError("Only reports in review can be approved");
  const snapshot = r.snapshot ?? ((await generateReportData(ctx, r)) as unknown as Prisma.InputJsonValue);
  await prisma.report.update({
    where: { id },
    data: { status: publish ? "PUBLISHED" : "APPROVED", snapshot: snapshot as Prisma.InputJsonValue, isPublic: publish, publishedAt: publish ? new Date() : null },
  });
  await audit(actorOf(ctx), { action: publish ? "report.publish" : "report.approve", entityType: "Report", entityId: id, summary: `${publish ? "Approved and published" : "Approved"} report ${r.title}` });
  if (publish) invalidateSite(ctx.organisationId);
}

export async function rejectReport(ctx: OrgContext, id: string, note?: string | null) {
  assertCan(ctx, "report.approve");
  const r = ensureOwned(ctx, await prisma.report.findUnique({ where: { id } }), "Report");
  if (r.status !== "IN_REVIEW") throw new ValidationError("Only reports in review can be rejected");
  await prisma.report.update({ where: { id }, data: { status: "REJECTED" } });
  await audit(actorOf(ctx), { action: "report.reject", entityType: "Report", entityId: id, summary: `Rejected report ${r.title}`, metadata: { note } });
}

/** Publish an approved report on the public website (may require approval). */
export async function publishReport(ctx: OrgContext, id: string) {
  const r = ensureOwned(ctx, await prisma.report.findUnique({ where: { id } }), "Report");
  if (r.status !== "APPROVED") throw new ValidationError("Approve the report before publishing it");
  if (approvalRules(ctx).reportPublish && !can(ctx, "approval.review")) {
    assertCan(ctx, "report.write");
    const { requestApproval } = await import("./approvals");
    await requestApproval(ctx, { type: "REPORT_PUBLISH", entityId: id, title: `Publish report: ${r.title}`, payload: { reportId: id, publish: true } });
    return { pending: true };
  }
  assertCan(ctx, "report.approve");
  await approveReport(ctx, id, true);
  return { pending: false };
}

export async function unpublishReport(ctx: OrgContext, id: string) {
  assertCan(ctx, "report.approve");
  const r = ensureOwned(ctx, await prisma.report.findUnique({ where: { id } }), "Report");
  await prisma.report.update({ where: { id }, data: { status: "APPROVED", isPublic: false } });
  await audit(actorOf(ctx), { action: "report.unpublish", entityType: "Report", entityId: id, summary: `Unpublished report ${r.title}` });
  invalidateSite(ctx.organisationId);
}

export async function returnReportToDraft(ctx: OrgContext, id: string) {
  assertCan(ctx, "report.approve");
  const r = ensureOwned(ctx, await prisma.report.findUnique({ where: { id } }), "Report");
  await prisma.report.update({ where: { id }, data: { status: "DRAFT", snapshot: Prisma.DbNull, isPublic: false, publishedAt: null } });
  await audit(actorOf(ctx), { action: "report.reopen", entityType: "Report", entityId: id, summary: `Returned report ${r.title} to draft` });
  invalidateSite(ctx.organisationId);
}

// ---------------------------------------------------------------------------
// PDF generation (pdf-lib, standard fonts — no external services)
// ---------------------------------------------------------------------------

function pdfSafe(text: string) {
  // Standard PDF fonts only support WinAnsi characters.
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/₹/g, "INR ")
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, "?");
}

class PdfWriter {
  page!: PDFPage;
  y = 0;
  constructor(private doc: PDFDocument, private font: PDFFont, private bold: PDFFont, private footer: string) {
    this.addPage();
  }
  addPage() {
    this.page = this.doc.addPage([595.28, 841.89]);
    this.y = 800;
    this.page.drawText(pdfSafe(this.footer), { x: 40, y: 24, size: 8, font: this.font, color: rgb(0.4, 0.4, 0.4) });
  }
  ensure(space: number) {
    if (this.y - space < 50) this.addPage();
  }
  text(value: string, opts: { size?: number; bold?: boolean; indent?: number; color?: [number, number, number] } = {}) {
    const size = opts.size ?? 10;
    const font = opts.bold ? this.bold : this.font;
    const maxWidth = 515 - (opts.indent ?? 0);
    for (const paragraph of pdfSafe(value).split("\n")) {
      const words = paragraph.split(/\s+/);
      let line = "";
      const flush = () => {
        this.ensure(size + 4);
        this.page.drawText(line, { x: 40 + (opts.indent ?? 0), y: this.y, size, font, color: rgb(...(opts.color ?? [0.1, 0.1, 0.1])) });
        this.y -= size + 4;
        line = "";
      };
      for (const w of words) {
        const candidate = line ? `${line} ${w}` : w;
        if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
          flush();
          line = w;
        } else line = candidate;
      }
      if (line) flush();
    }
  }
  gap(n = 8) {
    this.y -= n;
  }
  row(cells: string[], widths: number[], bold = false) {
    this.ensure(16);
    let x = 40;
    cells.forEach((c, i) => {
      const font = bold ? this.bold : this.font;
      let t = pdfSafe(c);
      while (t.length > 1 && font.widthOfTextAtSize(t, 9) > widths[i]! - 6) t = t.slice(0, -2) + ".";
      this.page.drawText(t, { x, y: this.y, size: 9, font });
      x += widths[i]!;
    });
    this.y -= 14;
  }
}

export async function renderReportPdf(ctx: OrgContext | null, report: Report, data: ReportData): Promise<Uint8Array> {
  void ctx;
  const doc = await PDFDocument.create();
  doc.setTitle(report.title);
  doc.setProducer("OpenCSR");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const w = new PdfWriter(doc, font, bold, `${data.organisation.name} - ${report.title} - generated ${data.generatedAt.slice(0, 10)} with OpenCSR`);
  const money = (v: string) => formatMoney(v, data.organisation.currency, "en-GB");

  w.text(data.organisation.name, { size: 11, color: [0.3, 0.3, 0.3] });
  w.text(report.title, { size: 20, bold: true });
  w.text(`${REPORT_TYPE_LABELS[report.type]} - ${data.period.label}`, { size: 11 });
  w.text(`Status: ${report.status}${report.snapshot ? " (figures frozen at approval)" : " (draft - figures generated from current records)"}`, { size: 9, color: [0.4, 0.4, 0.4] });
  w.gap(12);
  if (report.summary) {
    w.text("Summary", { size: 13, bold: true });
    w.text(stripHtml(report.summary));
    w.gap(10);
  }
  if (data.projects.length) {
    w.text(`Projects (${data.projects.length})`, { size: 13, bold: true });
    w.row(["Project", "Status", "Location", "Partner"], [200, 80, 120, 115], true);
    for (const p of data.projects) w.row([p.title, p.status, p.location ?? "-", p.partner ?? "-"], [200, 80, 120, 115]);
    w.gap(10);
  }
  if (data.finance) {
    const f = data.finance;
    w.text("Budget and expenditure", { size: 13, bold: true });
    w.text(`Allocated: ${money(f.allocated)}   Committed: ${money(f.committed)}   Utilised: ${money(f.utilised)}   Disbursed to partners: ${money(f.disbursed)}   Utilisation: ${f.utilisationPct}%`);
    w.text("Disbursed amounts are transfers to partners and are not added to utilisation.", { size: 8, color: [0.4, 0.4, 0.4] });
    if (f.byProject.length) {
      w.gap(4);
      w.row(["Project", "Allocated", "Committed", "Utilised"], [215, 100, 100, 100], true);
      for (const r of f.byProject) w.row([r.title, money(r.allocated), money(r.committed), money(r.utilised)], [215, 100, 100, 100]);
    }
    w.gap(10);
  }
  if (data.impact.length) {
    w.text("Impact indicators", { size: 13, bold: true });
    w.text("Targets are goals, not results. Only values marked VERIFIED have been reviewed.", { size: 8, color: [0.4, 0.4, 0.4] });
    for (const i of data.impact) {
      w.gap(4);
      w.text(`${i.name} (${i.unit}) - baseline ${i.baseline ?? "n/a"}, target ${i.target ?? "n/a"}`, { bold: true });
      if (i.measurements.length === 0) w.text("No measurements recorded in this period.", { indent: 10 });
      for (const m of i.measurements) w.text(`${m.periodStart.slice(0, 10)} to ${m.periodEnd.slice(0, 10)}: ${m.value} [${m.verification}]`, { indent: 10 });
    }
    w.gap(10);
  }
  if (data.milestones.length) {
    w.text("Milestones", { size: 13, bold: true });
    w.row(["Project", "Milestone", "Status", "Due"], [150, 215, 80, 70], true);
    for (const m of data.milestones) w.row([m.project, m.title, m.status, m.dueDate?.slice(0, 10) ?? "-"], [150, 215, 80, 70]);
  }
  return doc.save();
}

export async function getPublicReport(organisationId: string, id: string) {
  const report = await prisma.report.findFirst({ where: { id, organisationId, status: "PUBLISHED", isPublic: true } });
  if (!report || !report.snapshot) return null;
  return { report, data: report.snapshot as unknown as ReportData };
}
