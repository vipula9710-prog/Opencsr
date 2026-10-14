import "server-only";
import { unstable_rethrow } from "next/navigation";
import { AppError } from "./errors";
import { logger } from "./logger";

export type ActionState = {
  ok?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  data?: unknown;
  /** Increments on every submission so clients can react to repeated results. */
  nonce?: number;
};

/**
 * Wraps a server-action body: converts application errors into a serialisable
 * state for forms, logs unexpected errors and hides their details.
 */
export async function runAction(fn: () => Promise<unknown>, successMessage?: string): Promise<ActionState> {
  try {
    const data = await fn();
    return { ok: true, message: successMessage, data: data ?? undefined, nonce: Date.now() };
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof AppError) {
      return { ok: false, error: err.message, fieldErrors: err.fieldErrors, nonce: Date.now() };
    }
    logger.error("server action failed", { err });
    return { ok: false, error: "Something went wrong. The change was not saved.", nonce: Date.now() };
  }
}
