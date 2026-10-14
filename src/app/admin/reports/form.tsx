import { ActionForm, SelectField, SubmitButton, TextField } from "@/components/ui/form";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { REPORT_TYPE_LABELS, REPORT_TYPES } from "@/server/services/reports";
import { toDateInput } from "@/lib/utils";
import { saveReportAction } from "./actions";

type Opt = { value: string; label: string };
type Report = { id: string; title: string; type: string; summary: string | null; fyStartYear: number | null; periodStart: Date | null; periodEnd: Date | null; projectId: string | null; programmeId: string | null };

export function ReportForm({ report, projects, programmes, years }: { report?: Report; projects: Opt[]; programmes: Opt[]; years: Opt[] }) {
  return (
    <ActionForm action={saveReportAction} className="space-y-4">
      {report ? <input type="hidden" name="id" value={report.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Title" name="title" defaultValue={report?.title} required />
        <SelectField label="Report type" name="type" defaultValue={report?.type ?? "CSR_ANNUAL"} options={REPORT_TYPES.map((t) => ({ value: t, label: REPORT_TYPE_LABELS[t] }))} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField label="Financial year" name="fyStartYear" defaultValue={report?.fyStartYear ? String(report.fyStartYear) : ""} placeholder="None" options={years} hint="Required for annual and budget reports" />
        <TextField label="Period start (optional)" name="periodStart" type="date" defaultValue={toDateInput(report?.periodStart)} />
        <TextField label="Period end (optional)" name="periodEnd" type="date" defaultValue={toDateInput(report?.periodEnd)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Project" name="projectId" defaultValue={report?.projectId ?? ""} placeholder="All projects" options={projects} hint="Required for project reports" />
        <SelectField label="Programme" name="programmeId" defaultValue={report?.programmeId ?? ""} placeholder="All programmes" options={programmes} />
      </div>
      <div>
        <span className="mb-1 block text-sm font-medium text-gray-800">Narrative summary</span>
        <RichTextEditor name="summary" label="Narrative summary" initialHtml={report?.summary} />
      </div>
      <p className="text-xs text-gray-500">Figures in the report are generated from stored projects, budgets and impact measurements. They are frozen when the report is approved.</p>
      <SubmitButton>{report ? "Save report" : "Create report"}</SubmitButton>
    </ActionForm>
  );
}
