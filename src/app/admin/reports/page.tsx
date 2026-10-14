import Link from "next/link";
import { Plus } from "lucide-react";
import { requireOrgContext } from "@/server/auth/session";
import { listReports, REPORT_TYPE_LABELS } from "@/server/services/reports";
import { PageHeader } from "@/components/ui/page-header";
import { LinkButton } from "@/components/ui/button";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ReportsTabs } from "./tabs";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Reports" };

export default async function ReportsPage() {
  const ctx = await requireOrgContext();
  if (!ctx.permissions.has("report.read")) {
    const { redirect } = await import("next/navigation");
    redirect(ctx.permissions.has("document.read") ? "/admin/documents" : "/admin/forbidden");
  }
  const reports = await listReports(ctx);
  return (
    <div>
      <PageHeader title="Reports & Documents" breadcrumbs={[{ label: "Dashboard", href: "/admin" }, { label: "Reports" }]} actions={ctx.permissions.has("report.write") ? <LinkButton href="/admin/reports/new"><Plus className="h-4 w-4" /> New report</LinkButton> : null} />
      <ReportsTabs active="reports" />
      {reports.length === 0 ? (
        <EmptyState title="No reports yet" description="Generate annual CSR, project, impact or budget reports from your stored records." action={ctx.permissions.has("report.write") ? <LinkButton href="/admin/reports/new">Create report</LinkButton> : undefined} />
      ) : (
        <Table caption="Reports">
          <thead><tr><Th>Title</Th><Th>Type</Th><Th>Scope</Th><Th>Updated</Th><Th>Status</Th></tr></thead>
          <tbody className="divide-y divide-gray-100">
            {reports.map((r) => (
              <Tr key={r.id}>
                <Td><Link href={`/admin/reports/${r.id}`} className="font-medium hover:underline">{r.title}</Link></Td>
                <Td>{REPORT_TYPE_LABELS[r.type]}</Td>
                <Td className="text-sm">{r.project?.title ?? r.programme?.name ?? "Organisation-wide"}</Td>
                <Td>{formatDate(r.updatedAt)}</Td>
                <Td><StatusBadge status={r.status} /></Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
