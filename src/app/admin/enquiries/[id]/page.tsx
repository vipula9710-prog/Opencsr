import { requireOrgContext } from "@/server/auth/session";
import { load } from "@/server/page";
import { ENQUIRY_STATUSES, getEnquiry } from "@/server/services/enquiries";
import { listAssignableUsers } from "@/server/services/users";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader, DefinitionList } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { ActionForm, SelectField, SubmitButton, TextAreaField } from "@/components/ui/form";
import { formatDateTime, humanize } from "@/lib/utils";
import { updateEnquiryAction } from "../actions";

export default async function EnquiryPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrgContext("enquiry.read");
  const { id } = await params;
  const e = await load(getEnquiry(ctx, id));
  const users = ctx.permissions.has("enquiry.manage") ? await listAssignableUsers(ctx) : [];
  return (
    <div>
      <PageHeader title={<span className="flex items-center gap-3">Enquiry from {e.name} <StatusBadge status={e.status} /></span>} breadcrumbs={[{ label: "Enquiries", href: "/admin/enquiries" }, { label: e.name }]} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title={e.category} description={`Received ${formatDateTime(e.createdAt)}`} />
          <CardBody className="space-y-4">
            <p className="whitespace-pre-line text-sm">{e.message}</p>
            <DefinitionList items={[
              { label: "Email", value: <a className="text-brand-700 hover:underline" href={`mailto:${e.email}`}>{e.email}</a> },
              { label: "Phone", value: e.phone },
              { label: "Organisation", value: e.organisationName },
              { label: "Consent to store details", value: e.consent ? "Given" : "Not given" },
            ]} />
          </CardBody>
        </Card>
        {ctx.permissions.has("enquiry.manage") ? (
          <Card>
            <CardHeader title="Follow-up" />
            <CardBody>
              <ActionForm action={updateEnquiryAction} className="space-y-3">
                <input type="hidden" name="id" value={e.id} />
                <SelectField label="Status" name="status" defaultValue={e.status} options={ENQUIRY_STATUSES.map((s) => ({ value: s, label: humanize(s) }))} />
                <SelectField label="Assigned to" name="assignedToId" defaultValue={e.assignedToId ?? ""} placeholder="Nobody" options={users.map((u) => ({ value: u.id, label: u.name }))} />
                <TextAreaField label="Internal notes" name="internalNotes" defaultValue={e.internalNotes ?? ""} rows={4} />
                <SubmitButton size="sm">Save</SubmitButton>
              </ActionForm>
            </CardBody>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
