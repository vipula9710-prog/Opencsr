import "server-only";
import { notFound, redirect } from "next/navigation";
import { AppError } from "./errors";
import { getOrgContext } from "./auth/session";
import { runAction, type ActionState } from "./action";
import { UnauthenticatedError } from "./errors";
import type { OrgContext } from "./context";

/** Await a service call from a page, mapping NotFound → 404 and Forbidden → access-denied page. */
export async function load<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (err) {
    if (err instanceof AppError && err.code === "NOT_FOUND") notFound();
    if (err instanceof AppError && err.code === "FORBIDDEN") redirect("/admin/forbidden");
    throw err;
  }
}

/** Run a server-action body with the verified organisation context. */
export async function act(fn: (ctx: OrgContext) => Promise<unknown>, successMessage?: string): Promise<ActionState> {
  return runAction(async () => {
    const ctx = await getOrgContext();
    if (!ctx) throw new UnauthenticatedError();
    return fn(ctx);
  }, successMessage);
}

export function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;
