"use client";

import { useActionState, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { buttonClass, type ButtonSize, type ButtonVariant } from "./button";
import type { ActionState } from "./form";

/**
 * A small form that runs a server action after an optional confirmation.
 * Hidden inputs carry identifiers; the server re-validates everything.
 */
export function ActionButton({
  action,
  fields = {},
  children,
  confirm,
  variant = "outline",
  size = "sm",
  className,
  redirectTo,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  fields?: Record<string, string>;
  children: ReactNode;
  confirm?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  redirectTo?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const router = useRouter();
  useEffect(() => {
    if (state.ok) {
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.nonce]);
  return (
    <form
      action={formAction}
      className="inline"
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button type="submit" disabled={pending} className={buttonClass(variant, size, className)}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        {children}
      </button>
      {state.error ? (
        <span role="alert" className="ml-2 text-xs font-medium text-red-700">
          {state.error}
        </span>
      ) : null}
      {state.ok && state.message ? (
        <span role="status" className="ml-2 text-xs font-medium text-green-700">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
