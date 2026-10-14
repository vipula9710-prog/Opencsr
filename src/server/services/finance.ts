import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { actorOf, assertCan, can, ensureOwned, type OrgContext } from "../context";
import { audit, diff } from "../audit";
import { ConflictError, NotFoundError, ValidationError } from "../errors";
import { parseInput } from "../validation";
import { zDate, zMoney, zOptId, zOptText, zText } from "@/lib/zod-helpers";
import { compareMoney, fromMinor, percentOf, subtractMoney, sumMoney, toMinor } from "@/lib/money";
import { toCsv } from "@/lib/csv";
import { approvalRules } from "./website";
import { fyLabel } from "./organisations";

// Definitions (shown in the UI and docs):
//  • Allocated  – money assigned to a programme or project from an annual plan.
//  • Committed  – expenditure promised (e.g. purchase order, signed grant) but not yet incurred.
//  • Utilised   – expenditure actually incurred (status INCURRED).
//  • Disbursed  – funds transferred to an implementing partner (a cash-flow view;
//                 it is not added to utilisation, avoiding double counting).
//  • Remaining  – Allocated − Committed − Utilised.

type Tx = Prisma.TransactionClient;

/** Normalise a Decimal/number/string to a fixed two-decimal string. */
const money2 = (v: { toString(): string } | string | number | null | undefined) => fromMinor(toMinor(v ?? 0));

async function lockPlan(tx: Tx, organisationId: string, planId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "BudgetPlan" WHERE "id" = ${planId} AND "organisationId" = ${organisationId} FOR UPDATE`;
  if (rows.length === 0) throw new NotFoundError("Budget plan");
  return tx.budgetPlan.findUniqueOrThrow({ where: { id: planId } });
}

// ---------------------------------------------------------------------------
// Budget plans
// ---------------------------------------------------------------------------

const planSchema = z.object({
  title: zText(160),
  fyStartYear: z.coerce.number().int().min(2000).max(2100),
  totalAmount: zMoney,
  notes: zOptText(4000),
});

export async function listBudgetPlans(ctx: OrgContext) {
  assertCan(ctx, "finance.read");
  const plans = await prisma.budgetPlan.findMany({ where: { organisationId: ctx.organisationId }, orderBy: { fyStartYear: "desc" } });
  return Promise.all(plans.map(async (p) => ({ ...p, totalAmount: money2(p.totalAmount), fyLabel: fyLabel(p.fyStartYear, ctx.organisation.financialYearStartMonth), summary: await planTotals(p.id) })));
}

export async function createBudgetPlan(ctx: OrgContext, input: unknown) {
  assertCan(ctx, "finance.write");
  const data = parseInput(planSchema, input);
  try {
    const plan = await prisma.budgetPlan.create({ data: { ...data, organisationId: ctx.organisationId, currency: ctx.organisation.currency } });
    await audit(actorOf(ctx), { action: "budget.plan.create", entityType: "BudgetPlan", entityId: plan.id, summary: `Created budget plan ${plan.title} (${data.totalAmount})` });
    return plan;
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") throw new ConflictError("A budget plan already exists for this financial year", { fyStartYear: ["Already exists"] });
    throw err;
  }
}

export async function updateBudgetPlan(ctx: OrgContext, id: string, input: unknown) {
  assertCan(ctx, "finance.write");
  const data = parseInput(planSchema, input);
  return prisma.$transaction(async (tx) => {
    const plan = await lockPlan(tx, ctx.organisationId, id);
    if (plan.status === "CLOSED") throw new ValidationError("Closed plans cannot be edited");
    if (plan.status === "APPROVED" && !can(ctx, "finance.approve")) throw new ValidationError("Only finance approvers can change an approved plan");
    const allocated = await tx.budgetAllocation.aggregate({ where: { budgetPlanId: id }, _sum: { amount: true } });
    if (compareMoney(allocated._sum.amount ?? 0, data.totalAmount) > 0)
      throw new ValidationError("The total cannot be lower than the amount already allocated", { totalAmount: [`At least ${allocated._sum.amount} is allocated`] });
    const updated = await tx.budgetPlan.update({ where: { id }, data });
    await audit(actorOf(ctx), { action: "budget.plan.update", entityType: "BudgetPlan", entityId: id, summary: `Updated budget plan ${updated.title}`, metadata: diff({ ...plan, totalAmount: plan.totalAmount.toString() }, data) }, tx);
    return updated;
  });
}

export async function setBudgetPlanStatus(ctx: OrgContext, id: string, status: "DRAFT" | "SUBMITTED" | "APPROVED" | "CLOSED") {
  assertCan(ctx, status === "APPROVED" || status === "CLOSED" ? "finance.approve" : "finance.write");
  const plan = ensureOwned(ctx, await prisma.budgetPlan.findUnique({ where: { id } }), "Budget plan");
  await prisma.budgetPlan.update({ where: { id }, data: { status, approvedAt: status === "APPROVED" ? new Date() : plan.approvedAt } });
  await audit(actorOf(ctx), { action: "budget.plan.status", entityType: "BudgetPlan", entityId: id, summary: `Budget plan ${plan.title}: ${plan.status} → ${status}` });
}

async function planTotals(planId: string) {
  const [plan, alloc, committed, incurred, disbursed] = await Promise.all([
    prisma.budgetPlan.findUniqueOrThrow({ where: { id: planId }, select: { totalAmount: true } }),
    prisma.budgetAllocation.aggregate({ where: { budgetPlanId: planId }, _sum: { amount: true } }),
    prisma.expenditure.aggregate({ where: { budgetPlanId: planId, status: "COMMITTED" }, _sum: { amount: true } }),
    prisma.expenditure.aggregate({ where: { budgetPlanId: planId, status: "INCURRED" }, _sum: { amount: true } }),
    prisma.disbursement.aggregate({ where: { budgetPlanId: planId, status: "DISBURSED" }, _sum: { amount: true } }),
  ]);
  const total = plan.totalAmount.toString();
  const allocated = (alloc._sum.amount ?? 0).toString();
  const c = (committed._sum.amount ?? 0).toString();
  const u = (incurred._sum.amount ?? 0).toString();
  return {
    total: sumMoney([total]),
    allocated: sumMoney([allocated]),
    unallocated: subtractMoney(total, allocated),
    committed: sumMoney([c]),
    utilised: sumMoney([u]),
    disbursed: sumMoney([(disbursed._sum.amount ?? 0).toString()]),
    remaining: fromMinor(toMinor(allocated) - toMinor(c) - toMinor(u)),
    utilisationPct: percentOf(u, allocated),
    allocationPct: percentOf(allocated, total),
  };
}

export async function getBudgetPlan(ctx: OrgContext, id: string) {
  assertCan(ctx, "finance.read");
  const plan = await prisma.budgetPlan.findFirst({
    where: { id, organisationId: ctx.organisationId },
    include: {
      allocations: { include: { project: { select: { id: true, title: true, programmeId: true } }, programme: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!plan) throw new NotFoundError("Budget plan");
  const [expenditures, disbursements, totals] = await Promise.all([
    prisma.expenditure.findMany({ where: { budgetPlanId: id, organisationId: ctx.organisationId }, orderBy: { date: "desc" }, include: { project: { select: { id: true, title: true } }, document: { select: { id: true, title: true } } } }),
    prisma.disbursement.findMany({ where: { budgetPlanId: id, organisationId: ctx.organisationId }, orderBy: { date: "desc" }, include: { project: { select: { id: true, title: true } }, partner: { select: { id: true, name: true } } } }),
    planTotals(id),
  ]);
  // Per-project breakdown.
  const byProject = plan.allocations
    .filter((a) => a.project)
    .map((a) => {
      const exps = expenditures.filter((e) => e.projectId === a.projectId);
      const committed = sumMoney(exps.filter((e) => e.status === "COMMITTED").map((e) => e.amount));
      const utilised = sumMoney(exps.filter((e) => e.status === "INCURRED").map((e) => e.amount));
      const disbursed = sumMoney(disbursements.filter((d) => d.projectId === a.projectId && d.status === "DISBURSED").map((d) => d.amount));
      const allocated = money2(a.amount);
      return {
        allocationId: a.id,
        project: a.project!,
        allocated,
        committed,
        utilised,
        disbursed,
        remaining: fromMinor(toMinor(allocated) - toMinor(committed) - toMinor(utilised)),
        utilisationPct: percentOf(utilised, allocated),
      };
    });
  return {
    ...plan,
    totalAmount: money2(plan.totalAmount),
    fyLabel: fyLabel(plan.fyStartYear, ctx.organisation.financialYearStartMonth),
    totals,
    byProject,
    expenditures: expenditures.map((e) => ({ ...e, amount: money2(e.amount) })),
    disbursements: disbursements.map((d) => ({ ...d, amount: money2(d.amount) })),
    allocations: plan.allocations.map((a) => ({ ...a, amount: money2(a.amount) })),
  };
}

// ---------------------------------------------------------------------------
// Allocations
// ---------------------------------------------------------------------------

const allocationSchema = z
  .object({ projectId: zOptId, programmeId: zOptId, amount: zMoney, notes: zOptText(1000) })
  .refine((v) => Boolean(v.projectId) !== Boolean(v.programmeId), { message: "Choose either a project or a programme", path: ["projectId"] });

export type AllocationPayload = { planId: string; allocationId: string | null; projectId?: string | null; programmeId?: string | null; amount: string; notes?: string | null };

/** Create or update an allocation; may create an approval request instead. */
export async function saveAllocation(ctx: OrgContext, planId: string, allocationId: string | null, input: unknown) {
  assertCan(ctx, "finance.write");
  const data = parseInput(allocationSchema, input);
  const plan = ensureOwned(ctx, await prisma.budgetPlan.findUnique({ where: { id: planId } }), "Budget plan");
  if (plan.status === "CLOSED") throw new ValidationError("Closed plans cannot be changed");
  const payload: AllocationPayload = { planId, allocationId, ...data };
  if (plan.status === "APPROVED" && approvalRules(ctx).budgetChanges && !can(ctx, "finance.approve")) {
    const { requestApproval } = await import("./approvals");
    await requestApproval(ctx, { type: "BUDGET_ALLOCATION", entityId: planId, title: `Budget allocation change in ${plan.title}: ${data.amount}`, payload });
    return { pending: true as const };
  }
  const allocation = await applyAllocation(ctx, payload);
  return { pending: false as const, allocation };
}

export async function applyAllocation(ctx: OrgContext, p: AllocationPayload) {
  assertCan(ctx, "finance.write");
  return prisma.$transaction(async (tx) => {
    const plan = await lockPlan(tx, ctx.organisationId, p.planId);
    if (p.projectId) ensureOwned(ctx, await tx.project.findUnique({ where: { id: p.projectId } }), "Project");
    if (p.programmeId) ensureOwned(ctx, await tx.programme.findUnique({ where: { id: p.programmeId } }), "Programme");
    const others = await tx.budgetAllocation.aggregate({
      where: { budgetPlanId: plan.id, ...(p.allocationId ? { id: { not: p.allocationId } } : {}) },
      _sum: { amount: true },
    });
    const newTotal = fromMinor(toMinor(others._sum.amount ?? 0) + toMinor(p.amount));
    if (compareMoney(newTotal, plan.totalAmount) > 0) {
      throw new ValidationError(`Allocations would exceed the plan total of ${plan.totalAmount}`, {
        amount: [`Only ${subtractMoney(plan.totalAmount, others._sum.amount ?? 0)} remains unallocated`],
      });
    }
    if (p.allocationId) {
      const existing = await tx.budgetAllocation.findFirst({ where: { id: p.allocationId, budgetPlanId: plan.id, organisationId: ctx.organisationId } });
      if (!existing) throw new NotFoundError("Allocation");
      if (existing.projectId) {
        const spent = await tx.expenditure.aggregate({ where: { budgetPlanId: plan.id, projectId: existing.projectId, status: { not: "CANCELLED" } }, _sum: { amount: true } });
        if (compareMoney(spent._sum.amount ?? 0, p.amount) > 0)
          throw new ValidationError("The allocation cannot be lower than committed and utilised expenditure", { amount: [`At least ${spent._sum.amount} is already committed or utilised`] });
      }
      const updated = await tx.budgetAllocation.update({ where: { id: existing.id }, data: { amount: p.amount, notes: p.notes ?? null } });
      await audit(actorOf(ctx), { action: "budget.allocation.update", entityType: "BudgetPlan", entityId: plan.id, summary: `Allocation changed ${existing.amount} → ${p.amount}`, metadata: { allocationId: existing.id, from: existing.amount.toString(), to: p.amount } }, tx);
      return updated;
    }
    try {
      const created = await tx.budgetAllocation.create({
        data: { organisationId: ctx.organisationId, budgetPlanId: plan.id, projectId: p.projectId ?? null, programmeId: p.programmeId ?? null, amount: p.amount, notes: p.notes ?? null },
      });
      await audit(actorOf(ctx), { action: "budget.allocation.create", entityType: "BudgetPlan", entityId: plan.id, summary: `Allocated ${p.amount}`, metadata: { allocationId: created.id, projectId: p.projectId, programmeId: p.programmeId } }, tx);
      return created;
    } catch (err) {
      if ((err as { code?: string }).code === "P2002") throw new ConflictError("This project already has an allocation in this plan — edit it instead", { projectId: ["Already allocated"] });
      throw err;
    }
  });
}

export async function deleteAllocation(ctx: OrgContext, planId: string, allocationId: string) {
  assertCan(ctx, "finance.write");
  await prisma.$transaction(async (tx) => {
    const plan = await lockPlan(tx, ctx.organisationId, planId);
    if (plan.status !== "DRAFT" && plan.status !== "SUBMITTED") throw new ValidationError("Allocations can only be removed from draft plans");
    const a = await tx.budgetAllocation.findFirst({ where: { id: allocationId, budgetPlanId: planId, organisationId: ctx.organisationId } });
    if (!a) throw new NotFoundError("Allocation");
    if (a.projectId) {
      const spent = await tx.expenditure.count({ where: { budgetPlanId: planId, projectId: a.projectId, status: { not: "CANCELLED" } } });
      if (spent) throw new ValidationError("This allocation has expenditure recorded against it");
    }
    await tx.budgetAllocation.delete({ where: { id: a.id } });
    await audit(actorOf(ctx), { action: "budget.allocation.delete", entityType: "BudgetPlan", entityId: planId, summary: `Removed allocation of ${a.amount}` }, tx);
  });
}

// ---------------------------------------------------------------------------
// Expenditure
// ---------------------------------------------------------------------------

const expenditureSchema = z.object({
  projectId: z.string().min(1, "Required").max(60),
  description: zText(300),
  category: zOptText(80),
  payee: zOptText(200),
  amount: zMoney.refine((v) => toMinor(v) > 0n, "Must be greater than zero"),
  status: z.enum(["COMMITTED", "INCURRED", "CANCELLED"]),
  date: zDate,
  paymentReference: zOptText(120),
  documentId: zOptId,
  notes: zOptText(2000),
});

async function assertWithinAllocation(tx: Tx, planId: string, projectId: string, excludeId: string | null, addAmount: string) {
  const allocation = await tx.budgetAllocation.findUnique({ where: { budgetPlanId_projectId: { budgetPlanId: planId, projectId } } });
  if (!allocation) throw new ValidationError("This project has no allocation in this budget plan. Allocate funds first.", { projectId: ["No allocation"] });
  const spent = await tx.expenditure.aggregate({
    where: { budgetPlanId: planId, projectId, status: { not: "CANCELLED" }, ...(excludeId ? { id: { not: excludeId } } : {}) },
    _sum: { amount: true },
  });
  const total = fromMinor(toMinor(spent._sum.amount ?? 0) + toMinor(addAmount));
  if (compareMoney(total, allocation.amount) > 0) {
    throw new ValidationError("This would exceed the project's allocation", {
      amount: [`Remaining allocation is ${subtractMoney(allocation.amount, spent._sum.amount ?? 0)}`],
    });
  }
  return allocation;
}

export async function saveExpenditure(ctx: OrgContext, planId: string, expenditureId: string | null, input: unknown) {
  assertCan(ctx, "finance.write");
  const data = parseInput(expenditureSchema, input);
  if (data.documentId) ensureOwned(ctx, await prisma.document.findUnique({ where: { id: data.documentId } }), "Document");
  return prisma.$transaction(async (tx) => {
    const plan = await lockPlan(tx, ctx.organisationId, planId);
    if (plan.status === "CLOSED") throw new ValidationError("Closed plans cannot be changed");
    ensureOwned(ctx, await tx.project.findUnique({ where: { id: data.projectId } }), "Project");
    const allocation = data.status === "CANCELLED" ? null : await assertWithinAllocation(tx, planId, data.projectId, expenditureId, data.amount);
    if (expenditureId) {
      const before = await tx.expenditure.findFirst({ where: { id: expenditureId, budgetPlanId: planId, organisationId: ctx.organisationId } });
      if (!before) throw new NotFoundError("Expenditure");
      const updated = await tx.expenditure.update({ where: { id: before.id }, data: { ...data, allocationId: allocation?.id ?? before.allocationId } });
      await audit(actorOf(ctx), { action: "budget.expenditure.update", entityType: "BudgetPlan", entityId: planId, summary: `Updated expenditure “${data.description}”`, metadata: { expenditureId: before.id, changes: diff({ ...before, amount: before.amount.toString() }, data) } }, tx);
      return updated;
    }
    const created = await tx.expenditure.create({ data: { ...data, organisationId: ctx.organisationId, budgetPlanId: planId, allocationId: allocation?.id ?? null } });
    await audit(actorOf(ctx), { action: "budget.expenditure.create", entityType: "BudgetPlan", entityId: planId, summary: `Recorded ${data.status.toLowerCase()} expenditure of ${data.amount}: ${data.description}`, metadata: { expenditureId: created.id } }, tx);
    return created;
  });
}

// ---------------------------------------------------------------------------
// Disbursements
// ---------------------------------------------------------------------------

const disbursementSchema = z.object({
  projectId: z.string().min(1, "Required").max(60),
  partnerId: zOptId,
  amount: zMoney.refine((v) => toMinor(v) > 0n, "Must be greater than zero"),
  status: z.enum(["SCHEDULED", "DISBURSED", "CANCELLED"]),
  date: zDate,
  paymentReference: zOptText(120),
  documentId: zOptId,
  notes: zOptText(2000),
});

export async function saveDisbursement(ctx: OrgContext, planId: string, disbursementId: string | null, input: unknown) {
  assertCan(ctx, "finance.write");
  const data = parseInput(disbursementSchema, input);
  if (data.partnerId) ensureOwned(ctx, await prisma.partnerOrganisation.findUnique({ where: { id: data.partnerId } }), "Partner");
  if (data.documentId) ensureOwned(ctx, await prisma.document.findUnique({ where: { id: data.documentId } }), "Document");
  return prisma.$transaction(async (tx) => {
    const plan = await lockPlan(tx, ctx.organisationId, planId);
    if (plan.status === "CLOSED") throw new ValidationError("Closed plans cannot be changed");
    ensureOwned(ctx, await tx.project.findUnique({ where: { id: data.projectId } }), "Project");
    if (data.status !== "CANCELLED") {
      const allocation = await tx.budgetAllocation.findUnique({ where: { budgetPlanId_projectId: { budgetPlanId: planId, projectId: data.projectId } } });
      if (!allocation) throw new ValidationError("This project has no allocation in this plan", { projectId: ["No allocation"] });
      const existing = await tx.disbursement.aggregate({
        where: { budgetPlanId: planId, projectId: data.projectId, status: { not: "CANCELLED" }, ...(disbursementId ? { id: { not: disbursementId } } : {}) },
        _sum: { amount: true },
      });
      if (compareMoney(fromMinor(toMinor(existing._sum.amount ?? 0) + toMinor(data.amount)), allocation.amount) > 0)
        throw new ValidationError("Disbursements would exceed the project's allocation", { amount: [`At most ${subtractMoney(allocation.amount, existing._sum.amount ?? 0)} can still be disbursed`] });
    }
    if (disbursementId) {
      const before = await tx.disbursement.findFirst({ where: { id: disbursementId, budgetPlanId: planId, organisationId: ctx.organisationId } });
      if (!before) throw new NotFoundError("Disbursement");
      const updated = await tx.disbursement.update({ where: { id: before.id }, data });
      await audit(actorOf(ctx), { action: "budget.disbursement.update", entityType: "BudgetPlan", entityId: planId, summary: `Updated disbursement of ${data.amount}`, metadata: { disbursementId: before.id, changes: diff({ ...before, amount: before.amount.toString() }, data) } }, tx);
      return updated;
    }
    const created = await tx.disbursement.create({ data: { ...data, organisationId: ctx.organisationId, budgetPlanId: planId } });
    await audit(actorOf(ctx), { action: "budget.disbursement.create", entityType: "BudgetPlan", entityId: planId, summary: `Recorded ${data.status.toLowerCase()} disbursement of ${data.amount}`, metadata: { disbursementId: created.id } }, tx);
    return created;
  });
}

// ---------------------------------------------------------------------------
// Overview, history and export
// ---------------------------------------------------------------------------

export async function financeOverview(ctx: OrgContext, fyStartYear: number) {
  if (!can(ctx, "finance.read")) return null;
  const plan = await prisma.budgetPlan.findUnique({ where: { organisationId_fyStartYear: { organisationId: ctx.organisationId, fyStartYear } } });
  if (!plan) return null;
  return { plan: { id: plan.id, title: plan.title, fyLabel: fyLabel(plan.fyStartYear, ctx.organisation.financialYearStartMonth) }, totals: await planTotals(plan.id) };
}

export async function financeHistory(ctx: OrgContext, planId: string) {
  assertCan(ctx, "finance.read");
  ensureOwned(ctx, await prisma.budgetPlan.findUnique({ where: { id: planId } }), "Budget plan");
  return prisma.auditLog.findMany({
    where: { organisationId: ctx.organisationId, entityType: "BudgetPlan", entityId: planId },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { actor: { select: { name: true } } },
  });
}

export async function exportBudgetCsv(ctx: OrgContext, planId: string) {
  const plan = await getBudgetPlan(ctx, planId);
  await audit(actorOf(ctx), { action: "budget.export", entityType: "BudgetPlan", entityId: planId, summary: `Exported budget plan ${plan.title}` });
  const rows: unknown[][] = [];
  for (const a of plan.allocations) rows.push(["Allocation", a.project?.title ?? a.programme?.name, a.amount, "", "", a.notes ?? ""]);
  for (const e of plan.expenditures) rows.push(["Expenditure", e.project.title, e.amount, e.status, e.date.toISOString().slice(0, 10), e.description, e.paymentReference ?? ""]);
  for (const d of plan.disbursements) rows.push(["Disbursement", d.project.title, d.amount, d.status, d.date.toISOString().slice(0, 10), d.partner?.name ?? "", d.paymentReference ?? ""]);
  return toCsv(["Record type", "Project / programme", `Amount (${plan.currency})`, "Status", "Date", "Description / partner", "Payment reference"], rows);
}
