import { redirect } from "next/navigation";
import { isSetupComplete, CURRENCIES } from "@/server/services/organisations";
import { THEME_TEMPLATES } from "@/lib/theme/templates";
import { ActionForm, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/ui/form";
import { setupAction } from "../actions";

export const metadata = { title: "Set up OpenCSR" };
export const dynamic = "force-dynamic";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default async function SetupPage() {
  if (await isSetupComplete()) redirect("/login");
  return (
    <div className="w-full max-w-3xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
      <h1 className="text-2xl font-semibold text-gray-900">Welcome to OpenCSR</h1>
      <p className="mt-1 text-sm text-gray-600">
        Create your organisation and the first administrator account. Everything here can be changed later from the dashboard — no code changes needed.
      </p>
      <ActionForm action={setupAction} className="mt-6 space-y-8" refreshOnSuccess={false}>
        <fieldset className="space-y-4">
          <legend className="mb-2 text-base font-semibold text-gray-900">1. Your organisation</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Organisation name" name="name" required />
            <TextField label="Short address (slug)" name="slug" hint="Lowercase letters, numbers and hyphens, e.g. my-foundation" required pattern="[a-z0-9-]+" />
          </div>
          <TextField label="Tagline" name="tagline" />
          <TextAreaField label="Short description" name="description" rows={3} />
        </fieldset>
        <fieldset className="space-y-4">
          <legend className="mb-2 text-base font-semibold text-gray-900">2. Contact information</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Public email" name="email" type="email" />
            <TextField label="Phone" name="phone" />
          </div>
          <TextAreaField label="Address" name="address" rows={2} />
          <TextField label="Existing website (optional)" name="websiteUrl" type="url" placeholder="https://" />
        </fieldset>
        <fieldset className="space-y-4">
          <legend className="mb-2 text-base font-semibold text-gray-900">3. Finance & locale</legend>
          <div className="grid gap-4 sm:grid-cols-3">
            <SelectField label="Default currency" name="currency" defaultValue="INR" options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
            <SelectField label="Financial year starts in" name="financialYearStartMonth" defaultValue="4" options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))} />
            <TextField label="Time zone" name="timezone" defaultValue="Asia/Kolkata" />
          </div>
          <input type="hidden" name="locale" value="en-IN" />
        </fieldset>
        <fieldset className="space-y-4">
          <legend className="mb-2 text-base font-semibold text-gray-900">4. Website theme & brand colours</legend>
          <SelectField label="Starting theme" name="templateKey" defaultValue="corporate-green" options={THEME_TEMPLATES.map((t) => ({ value: t.key, label: `${t.name} — ${t.description}` }))} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Primary brand colour (optional)" name="primaryColor" type="color" defaultValue="#176B45" className="[&_input]:h-11 [&_input]:p-1" />
            <TextField label="Accent colour (optional)" name="accentColor" type="color" defaultValue="#C6A15B" className="[&_input]:h-11 [&_input]:p-1" />
          </div>
          <p className="text-xs text-gray-500">You can upload a logo and favicon and fine-tune every colour later in the Website Builder.</p>
        </fieldset>
        <fieldset className="space-y-4">
          <legend className="mb-2 text-base font-semibold text-gray-900">5. First administrator</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Your name" name="adminName" autoComplete="name" required />
            <TextField label="Your email" name="adminEmail" type="email" autoComplete="email" required />
          </div>
          <TextField label="Password" name="adminPassword" type="password" autoComplete="new-password" hint="At least 10 characters, mixing letters with numbers or symbols." required />
        </fieldset>
        <SubmitButton pendingLabel="Creating…">Create organisation</SubmitButton>
      </ActionForm>
    </div>
  );
}
