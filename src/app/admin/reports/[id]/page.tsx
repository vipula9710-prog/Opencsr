import { Download, Printer } from "lucide-react";
import { requireOrgContext } from "@/server/auth/session";
import { load } from "@/server/page";
import { getReport, REPORT_TYPE_LABELS } from "@/server/services/reports";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { ActionButton } from "@/components/ui/confirm-button";
import { Dialog } from "@/components/ui/dialog";
import { ReportView } from "@/components/reports/report-view";
import { formatDateTime } from "@/lib/utils";
import { ReportForm } from "../form";
import { reportOptions } from "../options";
import { reportWorkflowAction } from "../actions";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrgContext("report.read");
  const { id } = await params;
  const { report, data, history, isSnapshot } = await load(getReport(ctx, id));
  const canWrite = ctx.permissions.has("report.write");
  const canApprove = ctx.permissions.has("report.approve");
  const editable = canWrite && (report.status === "DRAFT" || report.status === "REJECTED");
  const opts = editable ? await reportOptions(ctx) : null;
  const step = (s: string, label: string, variant: "primary" | "outline" | "ghost" = "outline", confirm?: string) => (
    <ActionButton action={reportWorkflowAction} fields={{ id, step: s }} variant={variant} size="md" confirm={confirm}>{label}</ActionButton>
  );
  return (
    <div>
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-3">{report.title} <StatusBadge status={report.status} /></span>}
        description={REPORT_TYPE_LABELS[report.type]}
        breadcrumbs={[{ label: "Reports", href: "/admin/reports" }, { label: report.title }]}
        actions={
          <>
            <a href={`/print/reports/${id}`} target="_blank" className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium hover:bg-gray-50"><Printer className="h-4 w-4" /> Print</a>
            <a href={`/api/reports/${id}/pdf`} className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium hover:bg-gray-50"><Download className="h-4 w-4" /> PDF</a>
            {editable && opts ? <Dialog trigger="Edit" title="Edit report" wide><ReportForm report={report} {...opts} /></Dialog> : null}
            {editable ? step("submit", "Submit for review", "primary") : null}
            {canApprove && report.status === "IN_REVIEW" ? <>{step("approve", "Approve", "primary", "Approving freezes the figures in this report.")}{step("reject", "Reject")}</> : null}
            {report.status === "APPROVED" && (canApprove || canWrite) ? step("publish", "Publish on website", "primary", "Publish this report on the public website?") : null}
            {canApprove && report.status === "PUBLISHED" ? step("unpublish", "Unpublish") : null}
            {canApprove && (report.status === "APPROVED" || report.status === "PUBLISHED") ? step("reopen", "Return to draft", "ghost", "Return to draft? The frozen figures will be discarded and regenerated.") : null}
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-4">
        <Card className="lg:col-span-3">
          <CardBody>
            <ReportView data={data} summary={report.summary} title={report.title} subtitle={REPORT_TYPE_LABELS[report.type]} isSnapshot={isSnapshot} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Review history" />
          <CardBody>
            <ol className="space-y-2">{history.map((h) => <li key={h.id} className="text-xs"><p className="text-sm">{h.summary}</p><p className="text-gray-500">{h.actor?.name ?? "System"} · {formatDateTime(h.createdAt)}</p></li>)}</ol>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
