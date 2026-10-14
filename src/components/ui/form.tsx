"use client";

import { createContext, useActionState, useContext, useEffect, useId, useRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonClass, type ButtonVariant, type ButtonSize } from "./button";

export type ActionState = {
  ok?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  data?: unknown;
  nonce?: number;
};

type FormAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

const FormContext = createContext<ActionState>({});

export function useFieldError(name: string): string | undefined {
  return useContext(FormContext).fieldErrors?.[name]?.[0];
}

/**
 * Form bound to a server action. Shows a success or error banner based on the
 * action's result — success is only shown when the server confirms it.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess,
  refreshOnSuccess = true,
  onSuccess,
  showSuccess = true,
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  refreshOnSuccess?: boolean;
  onSuccess?: (state: ActionState) => void;
  showSuccess?: boolean;
}) {
  const [state, formAction] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (state.ok) {
      if (resetOnSuccess) formRef.current?.reset();
      if (refreshOnSuccess) router.refresh();
      onSuccess?.(state);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.nonce]);
  return (
    <FormContext.Provider value={state}>
      <form ref={formRef} action={formAction} className={className} noValidate>
        <FormMessages state={state} showSuccess={showSuccess} />
        {children}
      </form>
    </FormContext.Provider>
  );
}

export function FormMessages({ state, showSuccess = true }: { state: ActionState; showSuccess?: boolean }) {
  if (state.error) {
    return (
      <div role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <div>
          <p>{state.error}</p>
          {state.fieldErrors?._form ? <p>{state.fieldErrors._form.join(" ")}</p> : null}
        </div>
      </div>
    );
  }
  if (state.ok && state.message && showSuccess) {
    return (
      <div role="status" className="mb-4 flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p>{state.message}</p>
      </div>
    );
  }
  return null;
}

export function SubmitButton({ children, variant = "primary", size = "md", className, pendingLabel, name, value }: { children: ReactNode; variant?: ButtonVariant; size?: ButtonSize; className?: string; pendingLabel?: string; name?: string; value?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name={name} value={value} disabled={pending} aria-busy={pending} className={buttonClass(variant, size, className)}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}

const inputClass =
  "block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20 disabled:bg-gray-50 aria-[invalid=true]:border-red-500";

export function Field({ label, name, hint, children, required, className }: { label: string; name: string; hint?: ReactNode; children: (props: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => ReactNode; required?: boolean; className?: string }) {
  const id = useId();
  const error = useFieldError(name);
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("space-y-1", className)}>
      <label htmlFor={id} className="block text-sm font-medium text-gray-800">
        {label}
        {required ? <span className="text-red-600" aria-hidden> *</span> : null}
      </label>
      {children({ id, "aria-invalid": Boolean(error), "aria-describedby": describedBy })}
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-gray-500">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type Common = { label: string; name: string; hint?: ReactNode; className?: string };

export function TextField({ label, name, hint, className, required, ...props }: Common & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field label={label} name={name} hint={hint} required={required} className={className}>
      {(a) => <input {...a} name={name} required={required} className={inputClass} {...props} />}
    </Field>
  );
}

export function TextAreaField({ label, name, hint, className, required, rows = 4, ...props }: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Field label={label} name={name} hint={hint} required={required} className={className}>
      {(a) => <textarea {...a} name={name} rows={rows} required={required} className={inputClass} {...props} />}
    </Field>
  );
}

export function SelectField({ label, name, hint, className, required, options, placeholder, ...props }: Common & SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[]; placeholder?: string }) {
  return (
    <Field label={label} name={name} hint={hint} required={required} className={className}>
      {(a) => (
        <select {...a} name={name} required={required} className={inputClass} {...props}>
          {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

export function CheckboxField({ label, name, hint, defaultChecked, className, value }: { label: string; name: string; hint?: ReactNode; defaultChecked?: boolean; className?: string; value?: string }) {
  const id = useId();
  return (
    <div className={cn("flex items-start gap-2", className)}>
      <input id={id} type="checkbox" name={name} value={value} defaultChecked={defaultChecked} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-600" />
      <div>
        <label htmlFor={id} className="text-sm font-medium text-gray-800">
          {label}
        </label>
        {hint ? <p className="text-xs text-gray-500">{hint}</p> : null}
      </div>
    </div>
  );
}

export { inputClass };
