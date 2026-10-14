import { ActionForm, SubmitButton, TextField } from "@/components/ui/form";
import { resetPasswordAction } from "../actions";

export const metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h1 className="text-xl font-semibold text-gray-900">Choose a new password</h1>
      {!token ? (
        <p className="mt-3 text-sm text-red-700">This link is missing its token. Request a new reset link.</p>
      ) : (
        <ActionForm action={resetPasswordAction} className="mt-5 space-y-4" refreshOnSuccess={false}>
          <input type="hidden" name="token" value={token} />
          <TextField label="New password" name="password" type="password" autoComplete="new-password" hint="At least 10 characters, mixing letters with numbers or symbols." required />
          <SubmitButton className="w-full">Save password</SubmitButton>
        </ActionForm>
      )}
    </div>
  );
}
