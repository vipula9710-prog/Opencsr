"use server";

import { act, str } from "@/server/page";
import type { ActionState } from "@/server/action";
import { cancelApproval, decideApproval } from "@/server/services/approvals";

export async function decideAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const decision = str(fd, "decision") === "APPROVED" ? "APPROVED" : "REJECTED";
  return act((ctx) => decideApproval(ctx, str(fd, "id"), decision, str(fd, "note") || null), decision === "APPROVED" ? "Approved and applied" : "Rejected");
}

export async function cancelAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return act((ctx) => cancelApproval(ctx, str(fd, "id")), "Request cancelled");
}
