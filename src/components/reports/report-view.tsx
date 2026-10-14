import type { ReportData } from "@/server/services/reports";
import { formatMoney } from "@/lib/money";
import { formatDate, humanize } from "@/lib/utils";

/** Renders generated report data. Used in the dashboard, printable view and public website. */
export function ReportView({ data, summary, title, subtitle, isSnapshot }: { data: ReportData; summary?: string | null; title: string; subtitle?: string; isSnapshot: boolean }) {
  const money = (v: string) => formatMoney(v, data.organisation.currency, data.organisation.locale);
  return (
    <article className="space-y-8 text-sm text-gray-900">
      <header>
        <p className="text-gray-600">{data.organisation.name}</p>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle ? <p className="text-gray-700">{subtitle}</p> : null}
        <p className="mt-1 text-xs text-gray-500">
          {data.period.label} · {isSnapshot ? `Figures frozen on ${formatDate(data.generatedAt)}` : `Draft — generated from current records on ${formatDate(data.generatedAt)}`}
        </p>
      </header>
      {summary ? (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Summary</h2>
          <div className="admin-rich rich-text" dangerouslySetInnerHTML={{ __html: summary }} />
        </section>
      ) : null}
      <section>
        <h2 className="mb-2 text-lg font-semibold">Projects ({data.projects.length})</h2>
        {data.projects.length === 0 ? <p className="text-gray-600">No projects in scope.</p> : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left">
              <thead><tr className="border-b border-gray-300"><th className="py-1 pr-4">Project</th><th className="py-1 pr-4">Status</th><th className="py-1 pr-4">Location</th><th className="py-1 pr-4">Partner</th><th className="py-1">Dates</th></tr></thead>
              <tbody>
                {data.projects.map((p, i) => (
                  <tr key={i} className="border-b border-gray-100"><td className="py-1 pr-4">{p.title}</td><td className="py-1 pr-4">{humanize(p.status)}</td><td className="py-1 pr-4">{p.location ?? "—"}</td><td className="py-1 pr-4">{p.partner ?? "—"}</td><td className="py-1">{formatDate(p.startDate)} – {formatDate(p.endDate)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {data.finance ? (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Budget and expenditure</h2>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div><dt className="text-gray-500">Allocated</dt><dd className="font-semibold">{money(data.finance.allocated)}</dd></div>
            <div><dt className="text-gray-500">Committed</dt><dd className="font-semibold">{money(data.finance.committed)}</dd></div>
            <div><dt className="text-gray-500">Utilised</dt><dd className="font-semibold">{money(data.finance.utilised)}</dd></div>
            <div><dt className="text-gray-500">Utilisation</dt><dd className="font-semibold">{data.finance.utilisationPct}%</dd></div>
            <div><dt className="text-gray-500">Disbursed to partners</dt><dd className="font-semibold">{money(data.finance.disbursed)}</dd></div>
          </dl>
          <p className="mt-1 text-xs text-gray-500">Disbursements are transfers to partners and are not added to utilisation.</p>
          {data.finance.byProject.length ? (
            <table className="mt-3 min-w-full border-collapse text-left">
              <thead><tr className="border-b border-gray-300"><th className="py-1 pr-4">Project</th><th className="py-1 pr-4">Allocated</th><th className="py-1 pr-4">Committed</th><th className="py-1">Utilised</th></tr></thead>
              <tbody>{data.finance.byProject.map((r, i) => <tr key={i} className="border-b border-gray-100"><td className="py-1 pr-4">{r.title}</td><td className="py-1 pr-4">{money(r.allocated)}</td><td className="py-1 pr-4">{money(r.committed)}</td><td className="py-1">{money(r.utilised)}</td></tr>)}</tbody>
            </table>
          ) : null}
        </section>
      ) : null}
      {data.impact.length ? (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Impact indicators</h2>
          <p className="mb-2 text-xs text-gray-500">Targets are goals, not results. Only values marked “verified” have been reviewed by an authorised person.</p>
          <ul className="space-y-3">
            {data.impact.map((i, idx) => (
              <li key={idx}>
                <p className="font-medium">{i.name} <span className="font-normal text-gray-600">({i.unit}) · baseline {i.baseline ?? "n/a"} · target {i.target ?? "n/a"}</span></p>
                {i.measurements.length === 0 ? <p className="text-gray-600">No measurements in this period.</p> : (
                  <ul className="ml-4 list-disc">
                    {i.measurements.map((m, j) => <li key={j}>{formatDate(m.periodStart)} – {formatDate(m.periodEnd)}: <strong>{m.value}</strong> ({humanize(m.verification)})</li>)}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {data.milestones.length ? (
        <section>
          <h2 className="mb-2 text-lg font-semibold">Milestones</h2>
          <table className="min-w-full border-collapse text-left">
            <thead><tr className="border-b border-gray-300"><th className="py-1 pr-4">Project</th><th className="py-1 pr-4">Milestone</th><th className="py-1 pr-4">Status</th><th className="py-1">Due</th></tr></thead>
            <tbody>{data.milestones.map((m, i) => <tr key={i} className="border-b border-gray-100"><td className="py-1 pr-4">{m.project}</td><td className="py-1 pr-4">{m.title}</td><td className="py-1 pr-4">{humanize(m.status)}</td><td className="py-1">{formatDate(m.dueDate)}</td></tr>)}</tbody>
          </table>
        </section>
      ) : null}
    </article>
  );
}
