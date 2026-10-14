import { requireOrgContext } from "@/server/auth/session";
import { listFocusAreas } from "@/server/services/organisations";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ActionForm, CheckboxField, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/ui/form";
import { ActionButton } from "@/components/ui/confirm-button";
import { Dialog } from "@/components/ui/dialog";
import { SECTION_ICONS } from "@/lib/site/sections";
import { deleteFocusAreaAction, saveFocusAreaAction } from "../actions";

export const metadata = { title: "Focus areas" };

type FA = { id: string; name: string; slug: string; description: string | null; icon: string | null; sortOrder: number; isPublic: boolean };

function FocusAreaForm({ fa }: { fa?: FA }) {
  return (
    <ActionForm action={saveFocusAreaAction} className="space-y-3" resetOnSuccess={!fa}>
      {fa ? <input type="hidden" name="id" value={fa.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Name" name="name" defaultValue={fa?.name} required />
        <TextField label="Slug" name="slug" defaultValue={fa?.slug} hint="Optional" />
      </div>
      <TextAreaField label="Description" name="description" defaultValue={fa?.description ?? ""} rows={2} />
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField label="Icon" name="icon" defaultValue={fa?.icon ?? "leaf"} options={SECTION_ICONS.map((i) => ({ value: i, label: i }))} />
        <TextField label="Sort order" name="sortOrder" type="number" defaultValue={fa?.sortOrder ?? 0} />
      </div>
      <CheckboxField label="Show on public website" name="isPublic" defaultChecked={fa?.isPublic ?? true} />
      <SubmitButton size="sm">{fa ? "Save" : "Add focus area"}</SubmitButton>
    </ActionForm>
  );
}

export default async function FocusAreasPage() {
  const ctx = await requireOrgContext("programme.read");
  const areas = await listFocusAreas(ctx);
  const canWrite = ctx.permissions.has("programme.write");
  return (
    <div>
      <PageHeader title="Focus areas" description="Define your organisation's own CSR focus areas. They are used to categorise programmes and projects and can appear on your website." breadcrumbs={[{ label: "CSR Programmes", href: "/admin/programmes" }, { label: "Focus areas" }]} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title={`Focus areas (${areas.length})`} />
          <CardBody>
            {areas.length === 0 ? <p className="text-sm text-gray-600">No focus areas defined.</p> : (
              <ul className="divide-y divide-gray-100">
                {areas.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                    <div>
                      <p className="font-medium text-gray-900">{a.name} {!a.isPublic ? <span className="text-xs text-gray-500">(hidden from website)</span> : null}</p>
                      <p className="text-sm text-gray-600">{a.description}</p>
                      <p className="text-xs text-gray-500">{a._count.programmes} programmes · {a._count.projects} projects</p>
                    </div>
                    {canWrite ? (
                      <div className="flex gap-2">
                        <Dialog trigger="Edit" title={`Edit ${a.name}`} triggerSize="sm"><FocusAreaForm fa={a} /></Dialog>
                        <ActionButton action={deleteFocusAreaAction} fields={{ id: a.id }} confirm={`Delete focus area “${a.name}”? Projects keep their data but lose this category.`} variant="ghost">Delete</ActionButton>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
        {canWrite ? (
          <Card>
            <CardHeader title="Add focus area" />
            <CardBody><FocusAreaForm /></CardBody>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
