import { Download } from "lucide-react";
import { requireOrgContext } from "@/server/auth/session";
import { auditEntityTypes, listAuditLogs } from "@/server/services/audit-logs";
import { parseListQuery } from "@/server/services/common";
import { PageHeader } from "@/components/ui/page-header";
import { LinkButton } from "@/components/ui/button";
import { FilterBar, FilterSelect } from "@/components/ui/filters";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { formatDateTime } from "@/lib/utils";
import type { SearchParams } from "@/server/page";

export const metadata = { title: "Audit Logs" };

export default async function AuditPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await requireOrgContext("audit.read");
  const q = parseListQuery(await searchParams);
  const [result, types] = await Promise.all([listAuditLogs(ctx, { ...q, pageSize: 50 }), auditEntityTypes(ctx)]);
  const params = { q: q.q, entityType: q.entityType };
  return (
    <div>
      <PageHeader title="Audit Logs" description="A tamper-evident trail of changes: who did what, to which record and when. Passwords and secrets are never recorded." breadcrumbs={[{ label: "Dashboard", href: "/admin" }, { label: "Audit" }]} actions={<LinkButton href="/api/export/audit" variant="outline" prefetch={false}><Download className="h-4 w-4" /> Export CSV</LinkButton>} />
      <FilterBar q={q.q} placeholder="Search summaries">
        <FilterSelect name="entityType" label="Record type" value={q.entityType} options={types.map((t) => ({ value: t, label: t }))} />
      </FilterBar>
      <Table caption="Audit log">
        <thead><tr><Th>Time</Th><Th>Actor</Th><Th>Action</Th><Th>Summary</Th><Th>Details</Th></tr></thead>
        <tbody className="divide-y divide-gray-100">
          {result.items.map((a) => (
            <Tr key={a.id}>
              <Td className="whitespace-nowrap text-xs">{formatDateTime(a.createdAt)}</Td>
              <Td className="text-sm">{a.actor?.name ?? "System"}</Td>
              <Td><code className="text-xs">{a.action}</code><p className="text-[11px] text-gray-500">{a.entityType}</p></Td>
              <Td className="text-sm">{a.summary}</Td>
              <Td>{a.metadata ? <details className="text-xs"><summary className="cursor-pointer text-brand-700">View</summary><pre className="mt-1 max-w-md overflow-x-auto rounded bg-gray-50 p-2">{JSON.stringify(a.metadata, null, 2)}</pre></details> : null}</Td>
            </Tr>
          ))}
        </tbody>
      </Table>
      <Pagination {...result} params={params} basePath="/admin/audit" />
    </div>
  );
}
