import { requireOrgContext } from "@/server/auth/session";
import { load } from "@/server/page";
import { getIndicator } from "@/server/services/impact";
import { formatDate, humanize } from "@/lib/utils";
import { PrintButton } from "../../print-button";

export default async function PrintIndicatorPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrgContext("impact.read");
  const { id } = await params;
  const i = await load(getIndicator(ctx, id));
  return (
    <article className="space-y-4 text-sm">
      <PrintButton />
      <p className="text-gray-600">{ctx.organisation.name} · Impact indicator report · generated {formatDate(new Date())}</p>
      <h1 className="text-2xl font-bold">{i.name}</h1>
      {i.description ? <p>{i.description}</p> : null}
      <dl className="grid grid-cols-2 gap-2">
        <div><dt className="text-gray-500">Unit</dt><dd>{i.unit}</dd></div>
        <div><dt className="text-gray-500">Definition</dt><dd>{i.definition ?? "—"}</dd></div>
        <div><dt className="text-gray-500">Baseline</dt><dd>{i.baseline?.toString() ?? "—"}</dd></div>
        <div><dt className="text-gray-500">Target (goal, not a result)</dt><dd>{i.target?.toString() ?? "—"}</dd></div>
        <div><dt className="text-gray-500">Project</dt><dd>{i.project?.title ?? "—"}</dd></div>
        <div><dt className="text-gray-500">Data source</dt><dd>{i.dataSource ?? "—"}</dd></div>
      </dl>
      <h2 className="pt-4 text-lg font-semibold">Measurements</h2>
      <table className="min-w-full border-collapse text-left">
        <thead><tr className="border-b border-gray-300"><th className="py-1">Period</th><th className="py-1">Value</th><th className="py-1">Verification</th><th className="py-1">Source</th></tr></thead>
        <tbody>
          {i.measurements.map((m) => (
            <tr key={m.id} className="border-b border-gray-100"><td className="py-1">{formatDate(m.periodStart)} – {formatDate(m.periodEnd)}</td><td className="py-1">{m.value.toString()}</td><td className="py-1">{humanize(m.verificationStatus)}{m.verifiedBy ? ` (${m.verifiedBy.name})` : ""}</td><td className="py-1">{m.dataSource ?? "—"}</td></tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-gray-500">Unverified values have not been reviewed and should not be presented as confirmed outcomes.</p>
    </article>
  );
}
