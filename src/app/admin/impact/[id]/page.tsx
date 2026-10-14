import Link from "next/link";
import { Printer } from "lucide-react";
import { requireOrgContext } from "@/server/auth/session";
import { load } from "@/server/page";
import { getIndicator } from "@/server/services/impact";
import { documentOptions } from "@/server/services/documents";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader, DefinitionList, StatCard } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { ActionButton } from "@/components/ui/confirm-button";
import { ActionForm, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/ui/form";
import { Dialog } from "@/components/ui/dialog";
import { MeasurementChart } from "@/components/admin/charts";
import { formatDate, toDateInput } from "@/lib/utils";
import { IndicatorForm } from "../form";
import { indicatorOptions } from "../options";
import { addMeasurementAction, archiveIndicatorAction, deleteMeasurementAction, submitMeasurementAction, verifyMeasurementAction } from "../actions";

export default async function IndicatorPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrgContext("impact.read");
  const { id } = await params;
  const indicator = await load(getIndicator(ctx, id));
  const canWrite = ctx.permissions.has("impact.write");
  const canVerify = ctx.permissions.has("impact.verify");
  const [opts, docs] = await Promise.all([canWrite ? indicatorOptions(ctx) : null, canWrite ? documentOptions(ctx) : Promise.resolve([])]);
  const p = indicator.progress;
  const now = new Date();
  const quarterStart = new Date(Date.UTC(now.getUTCFullYear(), Math.floor(now.getUTCMonth() / 3) * 3, 1));

  return (
    <div>
      <PageHeader
        title={indicator.name}
        description={indicator.description ?? undefined}
        breadcrumbs={[{ label: "Impact", href: "/admin/impact" }, { label: indicator.name }]}
        actions={
          <>
            <a href={`/print/impact/${id}`} target="_blank" className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium hover:bg-gray-50"><Printer className="h-4 w-4" /> Printable report</a>
            {canWrite && opts ? <Dialog trigger="Edit indicator" title="Edit indicator" wide><IndicatorForm indicator={indicator} {...opts} /></Dialog> : null}
            {canWrite ? <ActionButton action={archiveIndicatorAction} fields={{ id }} size="md" confirm="Archive this indicator?" redirectTo="/admin/impact">Archive</ActionButton> : null}
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Baseline" value={indicator.baseline?.toString() ?? "—"} hint={indicator.unit} />
        <StatCard label="Target (goal)" value={indicator.target?.toString() ?? "—"} hint={indicator.unit} />
        <StatCard label="Latest recorded value" value={p.latestValue ?? "—"} hint={p.latestValue ? `${p.latestStatus?.toLowerCase().replace("_", " ")} · ${p.progressPct ?? "n/a"}% of target` : "No measurements"} />
        <StatCard label="Latest verified value" value={p.verifiedValue ?? "—"} hint={p.verifiedValue ? `${p.verifiedProgressPct ?? "n/a"}% of target` : "Nothing verified yet"} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Target vs. actual over time" description="Filled points are verified values; hollow points are unverified." />
            <CardBody>
              {indicator.measurements.length ? (
                <MeasurementChart
                  unit={indicator.unit}
                  target={indicator.target ? Number(indicator.target) : null}
                  baseline={indicator.baseline ? Number(indicator.baseline) : null}
                  data={indicator.measurements.map((m) => ({ period: m.periodEnd.toISOString().slice(0, 10), value: Number(m.value), verified: m.verificationStatus === "VERIFIED" }))}
                />
              ) : (
                <p className="text-sm text-gray-600">No measurements recorded yet.</p>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Measurements" />
            <CardBody className="p-0">
              {indicator.measurements.length === 0 ? <p className="px-5 py-4 text-sm text-gray-600">None yet.</p> : (
                <ul className="divide-y divide-gray-100">
                  {[...indicator.measurements].reverse().map((m) => (
                    <li key={m.id} className="space-y-1 px-5 py-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p><strong>{m.value.toString()} {indicator.unit}</strong> <span className="text-gray-600">· {formatDate(m.periodStart)} – {formatDate(m.periodEnd)}</span></p>
                        <StatusBadge status={m.verificationStatus} />
                      </div>
                      <p className="text-xs text-gray-500">
                        Recorded by {m.recordedBy?.name ?? "—"}
                        {m.verifiedBy ? ` · reviewed by ${m.verifiedBy.name} on ${formatDate(m.verifiedAt)}` : ""}
                        {m.dataSource ? ` · source: ${m.dataSource}` : ""}
                        {m.evidenceDocument ? <> · evidence: <Link href={`/admin/documents/${m.evidenceDocument.id}`} className="text-brand-700 hover:underline">{m.evidenceDocument.title}</Link></> : " · no evidence attached"}
                      </p>
                      {m.notes ? <p className="whitespace-pre-line text-xs text-gray-700">{m.notes}</p> : null}
                      <div className="flex flex-wrap gap-2 pt-1">
                        {canWrite && m.verificationStatus === "UNVERIFIED" ? <ActionButton action={submitMeasurementAction} fields={{ id: m.id }}>Send for verification</ActionButton> : null}
                        {canVerify && (m.verificationStatus === "UNDER_REVIEW" || m.verificationStatus === "UNVERIFIED") ? (
                          <>
                            <ActionButton action={verifyMeasurementAction} fields={{ id: m.id, decision: "VERIFIED" }} variant="primary" confirm="Confirm you have reviewed the evidence for this value.">Verify</ActionButton>
                            <ActionButton action={verifyMeasurementAction} fields={{ id: m.id, decision: "REJECTED" }} variant="outline">Reject</ActionButton>
                          </>
                        ) : null}
                        {canWrite ? <ActionButton action={deleteMeasurementAction} fields={{ id: m.id }} variant="ghost" confirm="Delete this measurement?">Delete</ActionButton> : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
        <div className="space-y-6">
          {canWrite ? (
            <Card>
              <CardHeader title="Record a measurement" description="New values are saved as unverified." />
              <CardBody>
                <ActionForm action={addMeasurementAction} className="space-y-3" resetOnSuccess>
                  <input type="hidden" name="indicatorId" value={id} />
                  <div className="grid grid-cols-2 gap-3">
                    <TextField label="Period start" name="periodStart" type="date" defaultValue={toDateInput(quarterStart)} required />
                    <TextField label="Period end" name="periodEnd" type="date" defaultValue={toDateInput(now)} required />
                  </div>
                  <TextField label={`Actual value (${indicator.unit})`} name="value" inputMode="decimal" required />
                  <TextField label="Data source" name="dataSource" defaultValue={indicator.dataSource ?? ""} />
                  <SelectField label="Evidence document" name="evidenceDocumentId" placeholder="None" options={docs.map((d) => ({ value: d.id, label: d.title }))} />
                  <TextAreaField label="Notes" name="notes" rows={2} />
                  <SubmitButton size="sm">Record measurement</SubmitButton>
                </ActionForm>
              </CardBody>
            </Card>
          ) : null}
          <Card>
            <CardHeader title="Definition" />
            <CardBody>
              <DefinitionList
                items={[
                  { label: "Unit", value: indicator.unit },
                  { label: "Direction", value: indicator.direction === "INCREASE" ? "Higher is better" : "Lower is better" },
                  { label: "Definition", value: indicator.definition },
                  { label: "Data source", value: indicator.dataSource },
                  { label: "Frequency", value: indicator.frequency },
                  { label: "Responsible", value: indicator.responsible?.name },
                  { label: "Project", value: indicator.project ? <Link href={`/admin/projects/${indicator.project.id}`} className="text-brand-700 hover:underline">{indicator.project.title}</Link> : null },
                  { label: "Programme", value: indicator.programme?.name },
                  { label: "Beneficiary metric", value: indicator.isBeneficiaryMetric ? "Yes" : "No" },
                  { label: "Public", value: indicator.isPublic ? "Latest verified value may appear on the website" : "Internal only" },
                ]}
              />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
