import { requireOrgContext } from "@/server/auth/session";
import { load } from "@/server/page";
import { getReport, REPORT_TYPE_LABELS } from "@/server/services/reports";
import { ReportView } from "@/components/reports/report-view";
import { PrintButton } from "../../print-button";

export default async function PrintReportPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrgContext("report.read");
  const { id } = await params;
  const { report, data, isSnapshot } = await load(getReport(ctx, id));
  return (
    <>
      <PrintButton />
      <ReportView data={data} summary={report.summary} title={report.title} subtitle={REPORT_TYPE_LABELS[report.type]} isSnapshot={isSnapshot} />
    </>
  );
}
