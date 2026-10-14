"use server";

import { act, str } from "@/server/page";
import type { ActionState } from "@/server/action";
import { formDataToObject } from "@/lib/zod-helpers";
import { addMember, createResetLinkForMember, removeMember, updateMember } from "@/server/services/users";
import { getEnv } from "@/server/env";

export async function addMemberAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const res = await act(async (ctx) => {
    const r = await addMember(ctx, formDataToObject(fd), getEnv().APP_URL);
    return { resetLink: r.resetLink };
  });
  if (res.ok) {
    const link = (res.data as { resetLink: string | null } | undefined)?.resetLink;
    res.message = link ? `Member added. Share this one-time link so they can set a password (valid 72 hours): ${link}` : "Member added. They can sign in with the temporary password you set.";
  }
  return res;
}

export async function updateMemberAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return act((ctx) => updateMember(ctx, str(fd, "id"), { role: str(fd, "role"), isActive: str(fd, "isActive") === "true" }), "Member updated");
}

export async function removeMemberAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return act((ctx) => removeMember(ctx, str(fd, "id")), "Member removed");
}

export async function resetLinkAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const res = await act((ctx) => createResetLinkForMember(ctx, str(fd, "userId"), getEnv().APP_URL));
  if (res.ok) res.message = `One-time reset link (valid 24 hours): ${res.data as string}`;
  return res;
}
