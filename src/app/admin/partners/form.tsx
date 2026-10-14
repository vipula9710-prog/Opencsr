import { ActionForm, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/ui/form";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { humanize, toDateInput } from "@/lib/utils";
import { PARTNER_TYPES } from "@/server/services/partners";
import { savePartnerAction } from "./actions";

type DDField = { key: string; label: string; type: string; required: boolean; helpText: string | null };
type Partner = {
  id: string; name: string; type: string; email: string | null; phone: string | null; website: string | null; address: string | null; city: string | null; state: string | null; country: string | null;
  registrationNumber: string | null; registrationDetails: string | null; nextReviewDate: Date | null; notes: string | null; dueDiligence: Record<string, string>;
};

export function PartnerForm({ partner, fields, canSeeConfidential }: { partner?: Partner; fields: DDField[]; canSeeConfidential: boolean }) {
  return (
    <ActionForm action={savePartnerAction} className="space-y-6">
      {partner ? <input type="hidden" name="id" value={partner.id} /> : null}
      <Card>
        <CardHeader title="Organisation profile" />
        <CardBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Name" name="name" defaultValue={partner?.name} required />
            <SelectField label="Organisation type" name="type" defaultValue={partner?.type ?? "NGO"} options={PARTNER_TYPES.map((t) => ({ value: t, label: humanize(t) }))} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField label="Website" name="website" type="url" defaultValue={partner?.website ?? ""} placeholder="https://" />
            {canSeeConfidential ? <TextField label="Email" name="email" type="email" defaultValue={partner?.email ?? ""} /> : null}
            {canSeeConfidential ? <TextField label="Phone" name="phone" defaultValue={partner?.phone ?? ""} /> : null}
          </div>
          <TextAreaField label="Address" name="address" defaultValue={partner?.address ?? ""} rows={2} />
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField label="City" name="city" defaultValue={partner?.city ?? ""} />
            <TextField label="State / region" name="state" defaultValue={partner?.state ?? ""} />
            <TextField label="Country" name="country" defaultValue={partner?.country ?? ""} />
          </div>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Registration & due diligence" description="Information supplied by the partner. Recording it does not mean it has been verified." />
        <CardBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Registration number" name="registrationNumber" defaultValue={partner?.registrationNumber ?? ""} />
            <TextField label="Next review date" name="nextReviewDate" type="date" defaultValue={toDateInput(partner?.nextReviewDate)} />
          </div>
          {canSeeConfidential ? (
            <>
              <TextAreaField label="Registration details" name="registrationDetails" defaultValue={partner?.registrationDetails ?? ""} rows={3} />
              {fields.length ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {fields.map((f) =>
                    f.type === "BOOLEAN" ? (
                      <SelectField key={f.key} label={f.label} name={`dd.${f.key}`} hint={f.helpText ?? undefined} required={f.required} defaultValue={partner?.dueDiligence[f.key] ?? ""} placeholder="Not answered" options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} />
                    ) : (
                      <TextField key={f.key} label={f.label} name={`dd.${f.key}`} hint={f.helpText ?? undefined} required={f.required} type={f.type === "DATE" ? "date" : f.type === "NUMBER" ? "number" : "text"} defaultValue={partner?.dueDiligence[f.key] ?? ""} />
                    ),
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-600">No custom due-diligence fields are configured. Administrators can add them in Organisation Settings.</p>
              )}
              <TextAreaField label="Internal notes" name="notes" defaultValue={partner?.notes ?? ""} rows={3} />
            </>
          ) : (
            <p className="text-sm text-gray-600">Contact details, due-diligence answers and notes are restricted to authorised users.</p>
          )}
        </CardBody>
      </Card>
      <SubmitButton>{partner ? "Save partner" : "Create partner"}</SubmitButton>
    </ActionForm>
  );
}
