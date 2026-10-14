import { beforeAll, describe, expect, it } from "vitest";
import type { OrgContext } from "@/server/context";
import { createProject } from "@/server/services/projects";
import { applyAllocation, createBudgetPlan, getBudgetPlan, saveDisbursement, saveExpenditure } from "@/server/services/finance";
import { addMeasurement, getIndicator, saveIndicator, verifyMeasurement } from "@/server/services/impact";
import { publicIndicators } from "@/server/services/public-site";
import { makeOrg, member } from "../helpers";

let ctx: OrgContext;
let p1: string;
let p2: string;
let planId: string;

beforeAll(async () => {
  ctx = (await makeOrg()).ctx;
  p1 = (await createProject(ctx, { title: "P1" })).id;
  p2 = (await createProject(ctx, { title: "P2" })).id;
  planId = (await createBudgetPlan(ctx, { title: "Plan", fyStartYear: 2025, totalAmount: "1000.00" })).id;
});

describe("budget calculations", () => {
  it("prevents allocations beyond the plan total", async () => {
    await applyAllocation(ctx, { planId, allocationId: null, projectId: p1, amount: "600.00" });
    await expect(applyAllocation(ctx, { planId, allocationId: null, projectId: p2, amount: "400.01" })).rejects.toMatchObject({ code: "VALIDATION" });
    await applyAllocation(ctx, { planId, allocationId: null, projectId: p2, amount: "400.00" });
  });

  it("prevents duplicate allocations for one project", async () => {
    await expect(applyAllocation(ctx, { planId, allocationId: null, projectId: p1, amount: "0.00" })).rejects.toBeTruthy();
  });

  it("prevents spending beyond an allocation", async () => {
    await saveExpenditure(ctx, planId, null, { projectId: p1, description: "A", amount: "500.00", status: "COMMITTED", date: "2025-05-01" });
    await expect(saveExpenditure(ctx, planId, null, { projectId: p1, description: "B", amount: "100.01", status: "INCURRED", date: "2025-05-01" })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("distinguishes committed, utilised and disbursed without double counting", async () => {
    const plan0 = await getBudgetPlan(ctx, planId);
    const exp = plan0.expenditures[0]!;
    // Converting a commitment into incurred spending moves it — it is not counted twice.
    await saveExpenditure(ctx, planId, exp.id, { projectId: p1, description: "A", amount: "500.00", status: "INCURRED", date: "2025-05-01" });
    await saveDisbursement(ctx, planId, null, { projectId: p1, amount: "300.00", status: "DISBURSED", date: "2025-05-02" });
    const plan = await getBudgetPlan(ctx, planId);
    expect(plan.totals).toMatchObject({ total: "1000.00", allocated: "1000.00", unallocated: "0.00", committed: "0.00", utilised: "500.00", disbursed: "300.00", remaining: "500.00", utilisationPct: 50 });
    const row = plan.byProject.find((r) => r.project.id === p1)!;
    expect(row).toMatchObject({ allocated: "600.00", utilised: "500.00", remaining: "100.00" });
  });

  it("uses exact decimal arithmetic", async () => {
    const pid = (await createProject(ctx, { title: "Decimals" })).id;
    const plan = await createBudgetPlan(ctx, { title: "Dec", fyStartYear: 2026, totalAmount: "0.30" });
    await applyAllocation(ctx, { planId: plan.id, allocationId: null, projectId: pid, amount: "0.30" });
    await saveExpenditure(ctx, plan.id, null, { projectId: pid, description: "a", amount: "0.10", status: "INCURRED", date: "2026-05-01" });
    await saveExpenditure(ctx, plan.id, null, { projectId: pid, description: "b", amount: "0.20", status: "INCURRED", date: "2026-05-01" });
    expect((await getBudgetPlan(ctx, plan.id)).totals.remaining).toBe("0.00");
  });
});

describe("impact measurements", () => {
  it("records values as unverified and never self-verifies", async () => {
    const pm = await member(ctx.organisationId, "PROJECT_MANAGER");
    const reviewer = await member(ctx.organisationId, "REVIEWER");
    const ind = await saveIndicator(pm, null, { name: "Children reached", unit: "children", baseline: "0", target: "100", direction: "INCREASE", isPublic: "on" });
    const m = await addMeasurement(pm, ind.id, { periodStart: "2025-04-01", periodEnd: "2025-06-30", value: "40" });
    expect(m.verificationStatus).toBe("UNVERIFIED");
    await expect(verifyMeasurement(pm, m.id, "VERIFIED")).rejects.toMatchObject({ code: "FORBIDDEN" });

    let detail = await getIndicator(ctx, ind.id);
    expect(detail.progress).toMatchObject({ latestValue: "40", latestVerified: false, verifiedValue: null, progressPct: 40 });
    expect((await publicIndicators(ctx.organisationId)).some((i) => i.id === ind.id)).toBe(false);

    await verifyMeasurement(reviewer, m.id, "VERIFIED");
    detail = await getIndicator(ctx, ind.id);
    expect(detail.progress.verifiedValue).toBe("40");
    expect((await publicIndicators(ctx.organisationId)).find((i) => i.id === ind.id)?.value).toBe("40");
  });

  it("rejects an invalid measurement period", async () => {
    const ind = await saveIndicator(ctx, null, { name: "X", unit: "u", direction: "INCREASE" });
    await expect(addMeasurement(ctx, ind.id, { periodStart: "2025-06-01", periodEnd: "2025-05-01", value: "1" })).rejects.toMatchObject({ code: "VALIDATION" });
  });
});
