import { ActionForm, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/ui/form";
import { toDateInput } from "@/lib/utils";
import { saveProgrammeAction } from "./actions";

type Programme = { id: string; name: string; slug: string; description: string | null; focusAreaId: string | null; status: string; startDate: Date | null; endDate: Date | null };

export function ProgrammeForm({ programme, focusAreas }: { programme?: Programme; focusAreas: { id: string; name: string }[] }) {
  return (
    <ActionForm action={saveProgrammeAction} className="space-y-4">
      {programme ? <input type="hidden" name="id" value={programme.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Name" name="name" defaultValue={programme?.name} required />
        <TextField label="Slug" name="slug" defaultValue={programme?.slug} hint="Leave empty to generate from the name" />
      </div>
      <TextAreaField label="Description" name="description" defaultValue={programme?.description ?? ""} rows={4} />
      <div className="grid gap-4 sm:grid-cols-4">
        <SelectField label="Focus area" name="focusAreaId" defaultValue={programme?.focusAreaId ?? ""} placeholder="None" options={focusAreas.map((f) => ({ value: f.id, label: f.name }))} />
        <SelectField label="Status" name="status" defaultValue={programme?.status ?? "ACTIVE"} options={[{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }, { value: "ARCHIVED", label: "Archived" }]} />
        <TextField label="Start date" name="startDate" type="date" defaultValue={toDateInput(programme?.startDate)} />
        <TextField label="End date" name="endDate" type="date" defaultValue={toDateInput(programme?.endDate)} />
      </div>
      <SubmitButton>{programme ? "Save changes" : "Create programme"}</SubmitButton>
    </ActionForm>
  );
}
