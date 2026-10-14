"use server";

import { act, str } from "@/server/page";
import type { ActionState } from "@/server/action";
import { formDataToObject } from "@/lib/zod-helpers";
import { deleteDueDiligenceField, saveDueDiligenceField, setDemoMode, updateApprovalRules, updateBranding, updateOrganisationSettings } from "@/server/services/organisations";
import { updateDomain } from "@/server/services/website";

export async function settingsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return act((ctx) => updateOrganisationSettings(ctx, formDataToObject(fd)), "Settings saved");
}
export async function brandingAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return act((ctx) => updateBranding(ctx, { logoId: str(fd, "logoId") || null, faviconId: str(fd, "faviconId") || null }), "Branding saved");
}
export async function approvalRulesAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return act((ctx) => updateApprovalRules(ctx, formDataToObject(fd)), "Approval rules saved");
}
export async function demoModeAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return act((ctx) => setDemoMode(ctx, str(fd, "enabled") === "1"), "Demo mode updated");
}
export async function domainAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return act((ctx) => updateDomain(ctx, str(fd, "domain") || null), "Domain saved");
}
export async function ddFieldAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return act((ctx) => saveDueDiligenceField(ctx, str(fd, "id") || null, formDataToObject(fd)), "Field saved");
}
export async function deleteDdFieldAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return act((ctx) => deleteDueDiligenceField(ctx, str(fd, "id")), "Field deleted");
}
