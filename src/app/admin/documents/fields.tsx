import { SelectField, TextAreaField, TextField } from "@/components/ui/form";
import { DOCUMENT_CATEGORIES } from "@/server/services/documents";
import { humanize, toDateInput } from "@/lib/utils";

type Opt = { value: string; label: string };
type Doc = { title: string; description: string | null; category: string; visibility: string; projectId: string | null; partnerId: string | null; financialYear: number | null; periodStart: Date | null; periodEnd: Date | null };

export function DocumentFields({ doc, projects, partners, canConfidential, defaults }: { doc?: Doc; projects: Opt[]; partners: Opt[]; canConfidential: boolean; defaults?: { projectId?: string; partnerId?: string; category?: string } }) {
  const visibility = [
    { value: "INTERNAL", label: "Internal — members with document access" },
    ...(canConfidential ? [{ value: "CONFIDENTIAL", label: "Confidential — restricted roles only" }] : []),
    { value: "PUBLIC", label: "Public — shown on the website once approved" },
  ];
  return (
    <>
      <TextField label="Title" name="title" defaultValue={doc?.title} required />
      <TextAreaField label="Description" name="description" defaultValue={doc?.description ?? ""} rows={2} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Category" name="category" defaultValue={doc?.category ?? defaults?.category ?? "OTHER"} options={DOCUMENT_CATEGORIES.map((c) => ({ value: c, label: humanize(c) }))} />
        <SelectField label="Visibility" name="visibility" defaultValue={doc?.visibility ?? "INTERNAL"} options={visibility} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Project" name="projectId" defaultValue={doc?.projectId ?? defaults?.projectId ?? ""} placeholder="None" options={projects} />
        <SelectField label="Partner" name="partnerId" defaultValue={doc?.partnerId ?? defaults?.partnerId ?? ""} placeholder="None" options={partners} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField label="Financial year (start year)" name="financialYear" type="number" defaultValue={doc?.financialYear ?? ""} />
        <TextField label="Reporting period start" name="periodStart" type="date" defaultValue={toDateInput(doc?.periodStart)} />
        <TextField label="Reporting period end" name="periodEnd" type="date" defaultValue={toDateInput(doc?.periodEnd)} />
      </div>
    </>
  );
}
