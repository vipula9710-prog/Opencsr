import Link from "next/link";
import { Download, Plus } from "lucide-react";
import { requireOrgContext } from "@/server/auth/session";
import { listPartners, PARTNER_TYPES, VERIFICATION_STATUSES } from "@/server/services/partners";
import { parseListQuery } from "@/server/services/common";
import { PageHeader } from "@/components/ui/page-header";
import { LinkButton } from "@/components/ui/button";
import { FilterBar, FilterSelect } from "@/components/ui/filters";
import { SortTh, Table, Td, Th, Tr } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate, humanize } from "@/lib/utils";
import type { SearchParams } from "@/server/page";

export const metadata = { title: "NGO & Partners" };

export default async function PartnersPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await requireOrgContext("partner.read");
  const q = parseListQuery(await searchParams);
  const result = await listPartners(ctx, q);
  const params = { q: q.q, type: q.type, verification: q.verification, archived: q.archived, sort: q.sort, dir: q.dir };
  return (
    <div>
      <PageHeader
        title="NGO & Partners"
        description="Implementation partners, their due diligence and their projects. Verification status reflects your own internal review only."
        breadcrumbs={[{ label: "Dashboard", href: "/admin" }, { label: "NGO & Partners" }]}
        actions={
          <>
            <LinkButton href="/api/export/partners" variant="outline" prefetch={false}><Download className="h-4 w-4" /> Export CSV</LinkButton>
            {ctx.permissions.has("partner.write") ? <LinkButton href="/admin/partners/new"><Plus className="h-4 w-4" /> New partner</LinkButton> : null}
          </>
        }
      />
      <FilterBar q={q.q} placeholder="Search name, city or registration number">
        <FilterSelect name="type" label="Type" value={q.type} options={PARTNER_TYPES.map((t) => ({ value: t, label: humanize(t) }))} />
        <FilterSelect name="verification" label="Verification" value={q.verification} options={VERIFICATION_STATUSES.map((t) => ({ value: t, label: humanize(t) }))} />
        <FilterSelect name="archived" label="Archive" value={q.archived} options={[{ value: "1", label: "Archived only" }]} />
      </FilterBar>
      {result.total === 0 ? (
        <EmptyState title="No partners found" description="Add the NGOs and implementation partners you work with." action={ctx.permissions.has("partner.write") ? <LinkButton href="/admin/partners/new">Add partner</LinkButton> : undefined} />
      ) : (
        <>
          <Table caption="Partners">
            <thead>
              <tr>
                <SortTh label="Name" field="name" params={params} basePath="/admin/partners" />
                <SortTh label="Type" field="type" params={params} basePath="/admin/partners" />
                <Th>Location</Th>
                <Th>Projects</Th>
                <SortTh label="Verification" field="verificationStatus" params={params} basePath="/admin/partners" />
                <SortTh label="Next review" field="nextReviewDate" params={params} basePath="/admin/partners" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {result.items.map((p) => (
                <Tr key={p.id}>
                  <Td><Link href={`/admin/partners/${p.id}`} className="font-medium hover:underline">{p.name}</Link></Td>
                  <Td>{humanize(p.type)}</Td>
                  <Td>{[p.city, p.state].filter(Boolean).join(", ") || "—"}</Td>
                  <Td>{p._count.projects}</Td>
                  <Td><StatusBadge status={p.verificationStatus} /></Td>
                  <Td className={p.nextReviewDate && p.nextReviewDate < new Date() ? "font-semibold text-red-700" : ""}>{formatDate(p.nextReviewDate)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <Pagination {...result} params={params} basePath="/admin/partners" />
        </>
      )}
    </div>
  );
}
