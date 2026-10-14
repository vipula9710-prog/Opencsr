"use server";

import { redirect } from "next/navigation";
import { act, str } from "@/server/page";
import type { ActionState } from "@/server/action";
import { formDataToObject } from "@/lib/zod-helpers";
import { addMeasurement, archiveIndicator, deleteMeasurement, saveIndicator, submitMeasurementForReview, verifyMeasurement } from "@/server/services/impact";

export async function saveIndicatorAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = str(fd, "id") || null;
  let newId = "";
  const res = await act(async (ctx) => {
    newId = (await saveIndicator(ctx, id, formDataToObject(fd))).id;
  }, "Indicator saved");
  if (res.ok && !id) redirect(`/admin/impact/${newId}`);
  return res;
}

export async function archiveIndicatorAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return act((ctx) => archiveIndicator(ctx, str(fd, "id")), "Indicator archived");
}

export async function addMeasurementAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return act((ctx) => addMeasurement(ctx, str(fd, "indicatorId"), formDataToObject(fd)), "Measurement recorded as unverified");
}

export async function submitMeasurementAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return act((ctx) => submitMeasurementForReview(ctx, str(fd, "id")), "Sent for verification");
}

export async function verifyMeasurementAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const decision = str(fd, "decision") === "REJECTED" ? "REJECTED" : "VERIFIED";
  return act((ctx) => verifyMeasurement(ctx, str(fd, "id"), decision, str(fd, "note") || null), decision === "VERIFIED" ? "Measurement verified" : "Measurement rejected");
}

export async function deleteMeasurementAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return act((ctx) => deleteMeasurement(ctx, str(fd, "id")), "Measurement deleted");
}
