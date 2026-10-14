import { requireOrgContext } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { CURRENCIES, listDueDiligenceFields } from "@/server/services/organisations";
import { emailEnabled } from "@/server/mail";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ActionForm, CheckboxField, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/ui/form";
import { ActionButton } from "@/components/ui/confirm-button";
import { MediaField } from "@/components/admin/media-picker";
import { humanize } from "@/lib/utils";
import { approvalRulesAction, brandingAction, ddFieldAction, deleteDdFieldAction, demoModeAction, domainAction, settingsAction } from "./actions";

export const metadata = { title: "Organisation Settings" };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default async function SettingsPage() {
  const ctx = await requireOrgContext("org.settings.manage");
  const org = await prisma.organisation.findUniqueOrThrow({ where: { id: ctx.organisationId }, include: { logo: true, favicon: true, websiteSettings: { select: { domain: true } } } });
  const fields = await listDueDiligenceFields(ctx);
  const rules = (org.approvalRules ?? {}) as Record<string, boolean>;
  const img = (m: { id: string; filename: string; altText: string | null } | null) => (m ? { id: m.id, url: `/media/${m.id}/${encodeURIComponent(m.filename)}`, alt: m.altText } : null);
  return (
    <div>
      <PageHeader title="Organisation Settings" breadcrumbs={[{ label: "Dashboard", href: "/admin" }, { label: "Settings" }]} />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader title="Organisation profile" />
            <CardBody>
              <ActionForm action={settingsAction} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField label="Name" name="name" defaultValue={org.name} required />
                  <TextField label="Slug" name="slug" defaultValue={org.slug} required />
                </div>
                <TextField label="Tagline" name="tagline" defaultValue={org.tagline ?? ""} />
                <TextAreaField label="Description" name="description" defaultValue={org.description ?? ""} rows={3} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField label="Public email" name="email" type="email" defaultValue={org.email ?? ""} />
                  <TextField label="Phone" name="phone" defaultValue={org.phone ?? ""} />
                </div>
                <TextAreaField label="Address" name="address" defaultValue={org.address ?? ""} rows={2} />
                <TextField label="Website" name="websiteUrl" type="url" defaultValue={org.websiteUrl ?? ""} />
                <div className="grid gap-4 sm:grid-cols-4">
                  <SelectField label="Currency" name="currency" defaultValue={org.currency} options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
                  <SelectField label="Financial year starts" name="financialYearStartMonth" defaultValue={String(org.financialYearStartMonth)} options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))} />
                  <TextField label="Time zone" name="timezone" defaultValue={org.timezone} />
                  <TextField label="Locale" name="locale" defaultValue={org.locale} />
                </div>
                <TextAreaField label="Enquiry categories" name="enquiryCategories" defaultValue={org.enquiryCategories.join("\n")} rows={4} hint="One per line. Shown in the website contact form." />
                <SubmitButton>Save profile</SubmitButton>
              </ActionForm>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Due-diligence fields" description="Custom questions recorded for each partner organisation." />
            <CardBody className="space-y-4">
              {fields.length ? (
                <ul className="divide-y divide-gray-100">
                  {fields.map((f) => (
                    <li key={f.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                      <span><strong>{f.label}</strong> <span className="text-xs text-gray-500">({humanize(f.type)}{f.required ? ", required" : ""}) · key: {f.key}</span></span>
                      <ActionButton action={deleteDdFieldAction} fields={{ id: f.id }} variant="ghost" confirm="Delete this field? Existing answers stay stored but are hidden.">Delete</ActionButton>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-gray-600">No fields configured.</p>}
              <ActionForm action={ddFieldAction} className="grid gap-3 border-t border-gray-100 pt-4 sm:grid-cols-2" resetOnSuccess>
                <TextField label="Label" name="label" required placeholder="e.g. Tax exemption certificate number" />
                <SelectField label="Type" name="type" defaultValue="TEXT" options={["TEXT", "NUMBER", "DATE", "BOOLEAN"].map((t) => ({ value: t, label: humanize(t) }))} />
                <TextField label="Help text" name="helpText" />
                <TextField label="Order" name="sortOrder" type="number" defaultValue={fields.length} />
                <CheckboxField label="Required" name="required" />
                <div><SubmitButton size="sm">Add field</SubmitButton></div>
              </ActionForm>
            </CardBody>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Logo & favicon" description="Used in the dashboard. Website branding is set in the Website Builder." />
            <CardBody>
              <ActionForm action={brandingAction} className="space-y-4">
                <MediaField name="logoId" label="Logo" initial={img(org.logo)} />
                <MediaField name="faviconId" label="Favicon" initial={img(org.favicon)} />
                <SubmitButton size="sm">Save branding</SubmitButton>
              </ActionForm>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Approval steps" description="When enabled, members without review permission must request approval." />
            <CardBody>
              <ActionForm action={approvalRulesAction} className="space-y-3">
                <CheckboxField label="Website publishing" name="websitePublish" defaultChecked={rules.websitePublish} />
                <CheckboxField label="Publishing reports on the website" name="reportPublish" defaultChecked={rules.reportPublish} />
                <CheckboxField label="Changes to approved budgets" name="budgetChanges" defaultChecked={rules.budgetChanges} />
                <CheckboxField label="Project status changes" name="projectStatus" defaultChecked={rules.projectStatus} />
                <CheckboxField label="Impact measurement verification" name="impactVerification" defaultChecked={rules.impactVerification} />
                <SubmitButton size="sm">Save approval rules</SubmitButton>
              </ActionForm>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Website domain" description="Serve this organisation's public site on its own host name (point DNS to this server)." />
            <CardBody>
              <ActionForm action={domainAction} className="space-y-3">
                <TextField label="Host name" name="domain" defaultValue={org.websiteSettings?.domain ?? ""} placeholder="csr.example.org" />
                <SubmitButton size="sm">Save domain</SubmitButton>
              </ActionForm>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Demo mode" description="Shows a “DEMO ENVIRONMENT — fictional data” banner on the dashboard and website." />
            <CardBody className="space-y-3 text-sm">
              <p>Demo banner is currently <strong>{org.isDemo || org.demoBannerEnabled ? "on" : "off"}</strong>.</p>
              {org.isDemo || org.demoBannerEnabled ? (
                <ActionButton action={demoModeAction} fields={{ enabled: "0" }} size="md" confirm="Only disable demo mode after replacing or removing all fictional demo records. Continue?">Disable demo mode</ActionButton>
              ) : (
                <ActionButton action={demoModeAction} fields={{ enabled: "1" }} size="md">Enable demo banner</ActionButton>
              )}
              <p className="text-xs text-gray-500">To delete an entire demo organisation, a platform administrator can run <code>npm run demo:remove</code> or use Platform → Organisations.</p>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Email" />
            <CardBody className="text-sm text-gray-700">
              {emailEnabled() ? "SMTP email is configured for this installation." : "Email is not configured. Enquiries and notifications are still stored and shown in the dashboard. Configure SMTP_* environment variables to enable email."}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
