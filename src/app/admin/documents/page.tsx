import Link from "next/link";
import { Upload } from "lucide-react";
import { requireOrgContext } from "@/server/auth/session";
import { DOCUMENT_CATEGORIES, listDocuments } from "@/server/services/documents";
import { parseListQuery } from "@/server/services/common";
import { PageHeader } from "@/components/ui/page-header";
import { LinkButton } from "@/components/ui/button";
import { FilterBar, FilterSelect } from "@/components/ui/filters";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate, humanize } from "@/lib/utils";
import { ReportsTabs } from "../reports/tabs";
import type { SearchParams } from "@/server/page";

export const metadata = { title: "Documents" };

export default async function DocumentsPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await requireOrgContext("document.read");
  const q = parseListQuery(await searchParams);
  const result = await listDocuments(ctx, q);
  const params = { q: q.q, category: q.category, visibility: q.visibility, status: q.status };
  return (
    <div>
      <PageHeader title="Reports & Documents" breadcrumbs={[{ label: "Dashboard", href: "/admin" }, { label: "Documents" }]} actions={ctx.permissions.has("document.write") ? <LinkButton href="/admin/documents/new"><Upload className="h-4 w-4" /> Upload document</LinkButton> : null} />
      {ctx.permissions.has("report.read") ? <ReportsTabs active="documents" /> : null}
      <FilterBar q={q.q} placeholder="Search documents">
        <FilterSelect name="category" label="Category" value={q.category} options={DOCUMENT_CATEGORIES.map((c) => ({ value: c, label: humanize(c) }))} />
        <FilterSelect name="visibility" label="Visibility" value={q.visibility} options={["PUBLIC", "INTERNAL", ...(ctx.permissions.has("document.confidential") ? ["CONFIDENTIAL"] : [])].map((c) => ({ value: c, label: humanize(c) }))} />
        <FilterSelect name="status" label="Archive" value={q.status} options={[{ value: "archived", label: "Archived only" }]} />
      </FilterBar>
      {result.total === 0 ? (
        <EmptyState title="No documents" description="Upload CSR policies, reports, agreements, due-diligence files and evidence. Files are stored privately and served only to authorised users." />
      ) : (
        <>
          <Table caption="Documents">
            <thead><tr><Th>Title</Th><Th>Category</Th><Th>Linked to</Th><Th>File</Th><Th>Visibility</Th><Th>Review</Th><Th>Updated</Th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {result.items.map((d) => (
                <Tr key={d.id}>
                  <Td><Link href={`/admin/documents/${d.id}`} className="font-medium hover:underline">{d.title}</Link></Td>
                  <Td>{humanize(d.category)}</Td>
                  <Td className="text-sm">{d.project?.title ?? d.partner?.name ?? "—"}</Td>
                  <Td className="text-xs text-gray-600">{d.currentVersion ? `${d.currentVersion.mediaAsset.filename} (${Math.ceil(d.currentVersion.mediaAsset.size / 1024)} KB)` : "—"}</Td>
                  <Td><StatusBadge status={d.visibility} /></Td>
                  <Td><StatusBadge status={d.status} /></Td>
                  <Td className="text-xs">{formatDate(d.updatedAt)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <Pagination {...result} params={params} basePath="/admin/documents" />
        </>
      )}
    </div>
  );
}
