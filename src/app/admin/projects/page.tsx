import Link from "next/link";
import { Download, Plus } from "lucide-react";
import { requireOrgContext } from "@/server/auth/session";
import { listProjects, listProgrammes, PROJECT_STATUSES } from "@/server/services/projects";
import { listFocusAreas } from "@/server/services/organisations";
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

export const metadata = { title: "Projects" };

export default async function ProjectsPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await requireOrgContext("project.read");
  const q = parseListQuery(await searchParams);
  const [result, programmes, focusAreas] = await Promise.all([listProjects(ctx, q), listProgrammes(ctx), listFocusAreas(ctx)]);
  const params = { q: q.q, status: q.status, programmeId: q.programmeId, focusAreaId: q.focusAreaId, archived: q.archived, sort: q.sort, dir: q.dir };
  const canWrite = ctx.permissions.has("project.write");
  return (
    <div>
      <PageHeader
        title="Projects"
        breadcrumbs={[{ label: "Dashboard", href: "/admin" }, { label: "Projects" }]}
        actions={
          <>
            <LinkButton href="/api/export/projects" variant="outline" prefetch={false}><Download className="h-4 w-4" /> Export CSV</LinkButton>
            {canWrite ? <LinkButton href="/admin/projects/new"><Plus className="h-4 w-4" /> New project</LinkButton> : null}
          </>
        }
      />
      <FilterBar q={q.q} placeholder="Search title, location or summary">
        <FilterSelect name="status" label="Status" value={q.status} options={PROJECT_STATUSES.filter((s) => s !== "ARCHIVED").map((s) => ({ value: s, label: humanize(s) }))} />
        <FilterSelect name="programmeId" label="Programme" value={q.programmeId} options={programmes.map((p) => ({ value: p.id, label: p.name }))} />
        <FilterSelect name="focusAreaId" label="Focus area" value={q.focusAreaId} options={focusAreas.map((p) => ({ value: p.id, label: p.name }))} />
        <FilterSelect name="archived" label="Archive" value={q.archived} options={[{ value: "1", label: "Archived only" }]} />
      </FilterBar>
      {result.total === 0 ? (
        <EmptyState title={q.q || q.status ? "No matching projects" : "No projects yet"} description="Projects hold objectives, milestones, budgets, impact indicators and evidence." action={canWrite ? <LinkButton href="/admin/projects/new">Create project</LinkButton> : undefined} />
      ) : (
        <>
          <Table caption="Projects">
            <thead>
              <tr>
                <SortTh label="Title" field="title" params={params} basePath="/admin/projects" />
                <Th>Programme</Th>
                <Th>Partner</Th>
                <Th>Owner</Th>
                <SortTh label="Start" field="startDate" params={params} basePath="/admin/projects" />
                <SortTh label="Status" field="status" params={params} basePath="/admin/projects" />
                <SortTh label="Updated" field="updatedAt" params={params} basePath="/admin/projects" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {result.items.map((p) => (
                <Tr key={p.id}>
                  <Td>
                    <Link href={`/admin/projects/${p.id}`} className="font-medium text-gray-900 hover:underline">{p.title}</Link>
                    <p className="text-xs text-gray-500">{p.location ?? ""}{p.isPublic ? " · on website" : ""}</p>
                  </Td>
                  <Td>{p.programme?.name ?? "—"}</Td>
                  <Td>{p.partner?.name ?? "—"}</Td>
                  <Td>{p.owner?.name ?? "—"}</Td>
                  <Td>{formatDate(p.startDate)}</Td>
                  <Td><StatusBadge status={p.status} /></Td>
                  <Td className="text-xs text-gray-500">{formatDate(p.updatedAt)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <Pagination {...result} params={params} basePath="/admin/projects" />
        </>
      )}
    </div>
  );
}
