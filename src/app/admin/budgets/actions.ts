"use server";

import { redirect } from "next/navigation";
import { act, str } from "@/server/page";
import type { ActionState } from "@/server/action";
import { formDataToObject } from "@/lib/zod-helpers";
import { createBudgetPlan, deleteAllocation, saveAllocation, saveDisbursement, saveExpenditure, setBudgetPlanStatus, updateBudgetPlan } from "@/server/services/finance";
import { ValidationError } from "@/server/errors";

export async function createPlanAction(_: ActionState, fd: FormData): Promise<ActionState> {
  let id = "";
  const res = await act(async (ctx) => {
    id = (await createBudgetPlan(ctx, formDataToObject(fd))).id;
  });
  if (res.ok) redirect(`/admin/budgets/${id}`);
  return res;
}

export async function updatePlanAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return act((ctx) => updateBudgetPlan(ctx, str(fd, "id"), formDataToObject(fd)), "Plan updated");
}

export async function planStatusAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const status = str(fd, "status");
  return act((ctx) => {
    if (!["DRAFT", "SUBMITTED", "APPROVED", "CLOSED"].includes(status)) throw new ValidationError("Invalid status");
    return setBudgetPlanStatus(ctx, str(fd, "id"), status as "DRAFT");
  }, "Plan status updated");
}

export async function allocationAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return act(async (ctx) => {
    const target = str(fd, "target");
    const data = { ...formDataToObject(fd), projectId: target.startsWith("project:") ? target.slice(8) : "", programmeId: target.startsWith("programme:") ? target.slice(10) : "" };
    const r = await saveAllocation(ctx, str(fd, "planId"), str(fd, "id") || null, data);
    if (r.pending) throw new ValidationError("This plan is approved, so your change was sent for approval.");
  }, "Allocation saved");
}

export async function deleteAllocationAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return act((ctx) => deleteAllocation(ctx, str(fd, "planId"), str(fd, "id")), "Allocation removed");
}

export async function expenditureAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return act((ctx) => saveExpenditure(ctx, str(fd, "planId"), str(fd, "id") || null, formDataToObject(fd)), "Expenditure saved");
}

export async function disbursementAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return act((ctx) => saveDisbursement(ctx, str(fd, "planId"), str(fd, "id") || null, formDataToObject(fd)), "Disbursement saved");
}
