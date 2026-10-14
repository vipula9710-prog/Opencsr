"use client";

import { useActionState, useEffect, useRef } from "react";
import { submitEnquiryAction } from "@/app/(site)/actions";
import type { ActionState } from "@/components/ui/form";

export function ContactForm({ categories, token, preview }: { categories: string[]; token: string; preview?: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(submitEnquiryAction, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state.nonce, state.ok]);
  const err = (k: string) => state.fieldErrors?.[k]?.[0];
  if (state.ok) {
    return (
      <div role="status" className="site-card p-6 text-left">
        <h3 className="text-xl">Thank you — your message has been received.</h3>
        <p className="mt-2">We have stored your enquiry and will respond as soon as possible.</p>
      </div>
    );
  }
  const field = (name: string, label: string, input: React.ReactNode) => (
    <div className="space-y-1 text-left">
      <label htmlFor={`cf-${name}`} className="block text-sm font-semibold">{label}</label>
      {input}
      {err(name) ? <p id={`cf-${name}-err`} className="text-sm font-medium" style={{ color: "var(--c-danger)" }}>{err(name)}</p> : null}
    </div>
  );
  return (
    <form ref={ref} action={preview ? undefined : action} onSubmit={preview ? (e) => e.preventDefault() : undefined} className="site-card space-y-4 p-6" noValidate>
      {state.error ? <p role="alert" className="text-left text-sm font-medium" style={{ color: "var(--c-danger)" }}>{state.error}</p> : null}
      <input type="hidden" name="formToken" value={token} />
      <div aria-hidden className="absolute left-[-9999px]" >
        <label htmlFor="cf-website">Leave this field empty</label>
        <input id="cf-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="grid gap-4 @2xl:grid-cols-2">
        {field("name", "Name *", <input id="cf-name" name="name" className="site-input" required autoComplete="name" aria-invalid={!!err("name")} />)}
        {field("email", "Email *", <input id="cf-email" name="email" type="email" className="site-input" required autoComplete="email" aria-invalid={!!err("email")} />)}
        {field("phone", "Phone (optional)", <input id="cf-phone" name="phone" type="tel" className="site-input" autoComplete="tel" />)}
        {field("organisationName", "Organisation (optional)", <input id="cf-organisationName" name="organisationName" className="site-input" autoComplete="organization" />)}
      </div>
      {field(
        "category",
        "Enquiry type *",
        <select id="cf-category" name="category" className="site-input" required defaultValue="" aria-invalid={!!err("category")}>
          <option value="" disabled>Choose…</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>,
      )}
      {field("message", "Message *", <textarea id="cf-message" name="message" rows={5} className="site-input" required aria-invalid={!!err("message")} />)}
      <div className="flex items-start gap-2 text-left">
        <input id="cf-consent" name="consent" type="checkbox" className="mt-1 h-4 w-4" required aria-invalid={!!err("consent")} />
        <label htmlFor="cf-consent" className="text-sm">I agree that my details may be stored so that the organisation can respond to this enquiry. See the <a href="/privacy" className="site-link underline">privacy policy</a>.</label>
      </div>
      {err("consent") ? <p className="text-left text-sm font-medium" style={{ color: "var(--c-danger)" }}>{err("consent")}</p> : null}
      <button type="submit" disabled={pending || preview} className="site-btn site-btn-primary">{pending ? "Sending…" : "Send message"}</button>
      {preview ? <p className="text-left text-xs" style={{ color: "var(--c-muted)" }}>Form submission is disabled in preview.</p> : null}
    </form>
  );
}
