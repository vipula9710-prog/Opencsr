import Link from "next/link";
import { Download, Plus } from "lucide-react";
import { requireOrgContext } from "@/server/auth/session";
import { listIndicators } from "@/server/services/impact";
import { PageHeader } from "@/components/ui/page-header";
import { LinkButton } from "@/components/ui/button";
import { FilterBar } from "@/components/ui/filters";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/admin/charts";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Impact Monitoring" };

export default async function ImpactPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const ctx = await requireOrgContext("impact.read");
  const { q } = await searchParams;
  const indicators = await listIndicators(ctx, { q });
  return (
    <div>
      <PageHeader
        title="Impact Monitoring"
        description="Indicators with baselines, targets and measured values. Targets are goals; measured values are shown as unverified until a reviewer verifies them."
        breadcrumbs={[{ label: "Dashboard", href: "/admin" }, { label: "Impact" }]}
        actions={
          <>
            <LinkButton href="/api/export/impact" variant="outline" prefetch={false}><Download className="h-4 w-4" /> Export CSV</LinkButton>
            {ctx.permissions.has("impact.write") ? <LinkButton href="/admin/impact/new"><Plus className="h-4 w-4" /> New indicator</LinkButton> : null}
          </>
        }
      />
      <FilterBar q={q} placeholder="Search indicators" />
      {indicators.length === 0 ? (
        <EmptyState title="No indicators" description="Define what success looks like for each project — e.g. number of students completing a course." action={ctx.permissions.has("impact.write") ? <LinkButton href="/admin/impact/new">Create indicator</LinkButton> : undefined} />
      ) : (
        <Table caption="Impact indicators">
          <thead><tr><Th>Indicator</Th><Th>Linked to</Th><Th>Baseline</Th><Th>Target</Th><Th>Latest actual</Th><Th className="w-48">Progress</Th></tr></thead>
          <tbody className="divide-y divide-gray-100">
            {indicators.map((i) => (
              <Tr key={i.id}>
                <Td>
                  <Link href={`/admin/impact/${i.id}`} className="font-medium hover:underline">{i.name}</Link>
                  <p className="text-xs text-gray-500">{i.unit}{i.isBeneficiaryMetric ? " · beneficiary metric" : ""}{i.isPublic ? " · public" : ""}</p>
                </Td>
                <Td className="text-sm">{i.project?.title ?? i.programme?.name ?? "—"}</Td>
                <Td>{i.baseline?.toString() ?? "—"}</Td>
                <Td>{i.target?.toString() ?? "—"}</Td>
                <Td>
                  {i.progress.latestValue ?? "—"}
                  {i.progress.latestStatus ? <div className="mt-1"><StatusBadge status={i.progress.latestStatus} /></div> : null}
                  {i.progress.latestPeriodEnd ? <p className="text-xs text-gray-500">to {formatDate(i.progress.latestPeriodEnd)}</p> : null}
                </Td>
                <Td>
                  <ProgressBar value={i.progress.progressPct} label={`${i.name} progress`} />
                  <p className="mt-1 text-xs text-gray-500">{i.progress.progressPct === null ? "n/a" : `${i.progress.progressPct}% of target`}</p>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
