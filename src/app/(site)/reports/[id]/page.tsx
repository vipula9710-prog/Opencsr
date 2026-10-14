import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicReport, REPORT_TYPE_LABELS } from "@/server/services/reports";
import { ReportView } from "@/components/reports/report-view";
import { getSite } from "../../site-data";

type Props = { params: Promise<{ id: string }> };

async function load(id: string) {
  const site = await getSite();
  if (!site) return null;
  return getPublicReport(site.organisation.id, id);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = await load((await params).id);
  return r ? { title: r.report.title, alternates: { canonical: `/reports/${r.report.id}` } } : {};
}

export default async function PublicReportPage({ params }: Props) {
  const r = await load((await params).id);
  if (!r) notFound();
  return (
    <section className="section-pt-md section-pb-md">
      <div className="site-container w-narrow">
        <p className="mb-6 flex flex-wrap gap-4 text-sm"><a href="/reports" className="site-link">← All reports</a><a href={`/reports/${r.report.id}/pdf`} className="site-link">Download PDF</a></p>
        <div className="site-card p-6 @3xl:p-10" style={{ ["--c-heading" as string]: "var(--c-heading)" }}>
          <ReportView data={r.data} summary={r.report.summary} title={r.report.title} subtitle={REPORT_TYPE_LABELS[r.report.type]} isSnapshot />
        </div>
      </div>
    </section>
  );
}
