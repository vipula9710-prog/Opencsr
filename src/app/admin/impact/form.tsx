import { ActionForm, CheckboxField, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/ui/form";
import { saveIndicatorAction } from "./actions";

type Opt = { id: string; name: string };
type Indicator = {
  id: string; name: string; description: string | null; unit: string; definition: string | null; baseline: { toString(): string } | null; target: { toString(): string } | null;
  direction: string; isBeneficiaryMetric: boolean; dataSource: string | null; frequency: string | null; responsibleId: string | null; programmeId: string | null; projectId: string | null; isPublic: boolean; notes: string | null;
};

export function IndicatorForm({ indicator, projects, programmes, users, defaults }: { indicator?: Indicator; projects: Opt[]; programmes: Opt[]; users: Opt[]; defaults?: { projectId?: string } }) {
  return (
    <ActionForm action={saveIndicatorAction} className="space-y-4">
      {indicator ? <input type="hidden" name="id" value={indicator.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField label="Indicator name" name="name" defaultValue={indicator?.name} required className="sm:col-span-2" />
        <TextField label="Unit of measurement" name="unit" defaultValue={indicator?.unit} required placeholder="e.g. students, trees, %" />
      </div>
      <TextAreaField label="Description" name="description" defaultValue={indicator?.description ?? ""} rows={2} />
      <TextAreaField label="Definition" name="definition" defaultValue={indicator?.definition ?? ""} rows={2} hint="Exactly what is counted, e.g. “Children aged 6–14 attending at least 75% of sessions in the period”." />
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField label="Baseline" name="baseline" inputMode="decimal" defaultValue={indicator?.baseline?.toString() ?? ""} />
        <TextField label="Target" name="target" inputMode="decimal" defaultValue={indicator?.target?.toString() ?? ""} hint="A goal — not a result." />
        <SelectField label="Desired direction" name="direction" defaultValue={indicator?.direction ?? "INCREASE"} options={[{ value: "INCREASE", label: "Increase" }, { value: "DECREASE", label: "Decrease" }]} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField label="Project" name="projectId" defaultValue={indicator?.projectId ?? defaults?.projectId ?? ""} placeholder="None" options={projects.map((p) => ({ value: p.id, label: p.name }))} />
        <SelectField label="Programme" name="programmeId" defaultValue={indicator?.programmeId ?? ""} placeholder="None" options={programmes.map((p) => ({ value: p.id, label: p.name }))} />
        <SelectField label="Responsible person" name="responsibleId" defaultValue={indicator?.responsibleId ?? ""} placeholder="None" options={users.map((p) => ({ value: p.id, label: p.name }))} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Data source" name="dataSource" defaultValue={indicator?.dataSource ?? ""} placeholder="e.g. attendance registers" />
        <TextField label="Measurement frequency" name="frequency" defaultValue={indicator?.frequency ?? ""} placeholder="e.g. quarterly" />
      </div>
      <TextAreaField label="Notes" name="notes" defaultValue={indicator?.notes ?? ""} rows={2} />
      <CheckboxField label="Beneficiary metric" name="isBeneficiaryMetric" defaultChecked={indicator?.isBeneficiaryMetric} hint="Counts people reached. Make sure the definition and measurement period are explicit." />
      <CheckboxField label="May be shown on the public website" name="isPublic" defaultChecked={indicator?.isPublic} hint="Only the latest verified value is ever shown publicly." />
      <SubmitButton>{indicator ? "Save indicator" : "Create indicator"}</SubmitButton>
    </ActionForm>
  );
}
