import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth/session";
import { isSetupComplete } from "@/server/services/organisations";
import { ActionForm, SubmitButton, TextField } from "@/components/ui/form";
import { loginAction } from "../actions";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (!(await isSetupComplete())) redirect("/setup");
  if (await getSessionUser()) redirect("/admin");
  const sp = await searchParams;
  return (
    <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h1 className="text-xl font-semibold text-gray-900">Sign in</h1>
      <p className="mt-1 text-sm text-gray-600">Use the account your administrator created for you.</p>
      {sp.reset ? <p role="status" className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">Your password was changed. Please sign in.</p> : null}
      <ActionForm action={loginAction} className="mt-5 space-y-4" refreshOnSuccess={false}>
        <input type="hidden" name="next" value={sp.next ?? "/admin"} />
        <TextField label="Email" name="email" type="email" autoComplete="email" required />
        <TextField label="Password" name="password" type="password" autoComplete="current-password" required />
        <SubmitButton className="w-full" pendingLabel="Signing in…">Sign in</SubmitButton>
      </ActionForm>
      <p className="mt-4 text-center text-sm">
        <Link href="/forgot-password" className="text-brand-700 hover:underline">Forgot your password?</Link>
      </p>
    </div>
  );
}
