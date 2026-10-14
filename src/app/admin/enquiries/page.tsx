import Link from "next/link";
import { Download } from "lucide-react";
import { requireOrgContext } from "@/server/auth/session";
import { ENQUIRY_STATUSES, listEnquiries } from "@/server/services/enquiries";
import { parseListQuery } from "@/server/services/common";
import { emailEnabled } from "@/server/mail";
import { PageHeader } from "@/components/ui/page-header";
import { LinkButton } from "@/components/ui/button";
import { FilterBar, FilterSelect } from "@/components/ui/filters";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime, humanize, truncate } from "@/lib/utils";
import type { SearchParams } from "@/server/page";

export const metadata = { title: "Enquiries" };

export default async function EnquiriesPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await requireOrgContext("enquiry.read");
  const q = parseListQuery(await searchParams);
  const result = await listEnquiries(ctx, q);
  const params = { q: q.q, status: q.status, category: q.category };
  return (
    <div>
      <PageHeader
        title="Enquiries"
        description={emailEnabled() ? "Messages from your website contact form. Email notifications are enabled." : "Messages from your website contact form. Email is not configured, so new enquiries are announced here and in Notifications."}
        breadcrumbs={[{ label: "Dashboard", href: "/admin" }, { label: "Enquiries" }]}
        actions={ctx.permissions.has("enquiry.manage") ? <LinkButton href="/api/export/enquiries" variant="outline" prefetch={false}><Download className="h-4 w-4" /> Export CSV</LinkButton> : null}
      />
      <FilterBar q={q.q} placeholder="Search name, email or message">
        <FilterSelect name="status" label="Status" value={q.status} options={ENQUIRY_STATUSES.map((s) => ({ value: s, label: humanize(s) }))} />
        <FilterSelect name="category" label="Category" value={q.category} options={ctx.organisation.enquiryCategories.map((c) => ({ value: c, label: c }))} />
      </FilterBar>
      {result.total === 0 ? (
        <EmptyState title="No enquiries" description="Enquiries submitted through the contact form on your website appear here." />
      ) : (
        <>
          <Table caption="Enquiries">
            <thead><tr><Th>From</Th><Th>Category</Th><Th>Message</Th><Th>Received</Th><Th>Status</Th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {result.items.map((e) => (
                <Tr key={e.id}>
                  <Td><Link href={`/admin/enquiries/${e.id}`} className="font-medium hover:underline">{e.name}</Link><p className="text-xs text-gray-500">{e.email}</p></Td>
                  <Td>{e.category}</Td>
                  <Td className="max-w-sm text-sm text-gray-600">{truncate(e.message, 100)}</Td>
                  <Td className="text-xs">{formatDateTime(e.createdAt)}</Td>
                  <Td><StatusBadge status={e.status} /></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <Pagination {...result} params={params} basePath="/admin/enquiries" />
        </>
      )}
    </div>
  );
}
