import Link from "next/link";
import { ActionForm, SubmitButton, TextField } from "@/components/ui/form";
import { forgotPasswordAction } from "../actions";

export const metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h1 className="text-xl font-semibold text-gray-900">Reset your password</h1>
      <p className="mt-1 text-sm text-gray-600">We will email a reset link if email delivery is configured for this installation.</p>
      <ActionForm action={forgotPasswordAction} className="mt-5 space-y-4" resetOnSuccess refreshOnSuccess={false}>
        <TextField label="Email" name="email" type="email" autoComplete="email" required />
        <SubmitButton className="w-full">Send reset link</SubmitButton>
      </ActionForm>
      <p className="mt-4 text-center text-sm"><Link href="/login" className="text-brand-700 hover:underline">Back to sign in</Link></p>
    </div>
  );
}
