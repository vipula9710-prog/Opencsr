"use server";

import { redirect } from "next/navigation";
import { act, str } from "@/server/page";
import type { ActionState } from "@/server/action";
import { formDataToObject } from "@/lib/zod-helpers";
import { approveReport, publishReport, rejectReport, returnReportToDraft, saveReport, submitReport, unpublishReport } from "@/server/services/reports";

export async function saveReportAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = str(fd, "id") || null;
  let newId = "";
  const res = await act(async (ctx) => {
    newId = (await saveReport(ctx, id, formDataToObject(fd))).id;
  }, "Report saved");
  if (res.ok && !id) redirect(`/admin/reports/${newId}`);
  return res;
}

export async function reportWorkflowAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = str(fd, "id");
  const step = str(fd, "step");
  return act(async (ctx) => {
    switch (step) {
      case "submit":
        return submitReport(ctx, id);
      case "approve":
        return approveReport(ctx, id, false);
      case "reject":
        return rejectReport(ctx, id, str(fd, "note") || null);
      case "publish":
        return publishReport(ctx, id);
      case "unpublish":
        return unpublishReport(ctx, id);
      case "reopen":
        return returnReportToDraft(ctx, id);
    }
  }, "Report updated");
}
