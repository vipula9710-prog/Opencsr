"use server";

import { redirect } from "next/navigation";
import { runAction, type ActionState } from "@/server/action";
import { clientIp, createSession, destroySession, getSessionUser } from "@/server/auth/session";
import { authenticate, completePasswordReset, requestPasswordReset } from "@/server/services/users";
import { runInitialSetup } from "@/server/services/organisations";
import { formDataToObject } from "@/lib/zod-helpers";
import { getEnv } from "@/server/env";

function safeNext(value: FormDataEntryValue | null) {
  const v = typeof value === "string" ? value : "";
  return v.startsWith("/admin") && !v.startsWith("//") ? v : "/admin";
}

export async function loginAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const ip = await clientIp();
  const result = await runAction(async () => {
    const user = await authenticate(formDataToObject(fd), ip);
    await createSession(user.id);
  });
  if (result.ok) redirect(safeNext(fd.get("next")));
  return result;
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export async function setupAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const result = await runAction(async () => {
    const { user } = await runInitialSetup(formDataToObject(fd));
    await createSession(user.id);
  });
  if (result.ok) redirect("/admin?welcome=1");
  return result;
}

export async function forgotPasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    await requestPasswordReset(formDataToObject(fd), await clientIp(), getEnv().APP_URL);
  }, "If an account exists for that address and email is configured, a reset link has been sent. Otherwise, ask your administrator for a reset link.");
}

export async function resetPasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const result = await runAction(() => completePasswordReset(formDataToObject(fd)));
  if (result.ok) {
    if (await getSessionUser()) await destroySession();
    redirect("/login?reset=1");
  }
  return result;
}
