import Link from "next/link";
import { Plus, Tags } from "lucide-react";
import { requireOrgContext } from "@/server/auth/session";
import { listProgrammes } from "@/server/services/projects";
import { PageHeader } from "@/components/ui/page-header";
import { LinkButton } from "@/components/ui/button";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "CSR Programmes" };

export default async function ProgrammesPage({ searchParams }: { searchParams: Promise<{ archived?: string }> }) {
  const ctx = await requireOrgContext("programme.read");
  const sp = await searchParams;
  const programmes = await listProgrammes(ctx, { includeArchived: sp.archived === "1" });
  const canWrite = ctx.permissions.has("programme.write");
  return (
    <div>
      <PageHeader
        title="CSR Programmes"
        description="Programmes group related projects under a common objective. Focus areas are your own configurable CSR themes."
        breadcrumbs={[{ label: "Dashboard", href: "/admin" }, { label: "CSR Programmes" }]}
        actions={
          <>
            <LinkButton href="/admin/programmes/focus-areas" variant="outline"><Tags className="h-4 w-4" /> Focus areas</LinkButton>
            {canWrite ? <LinkButton href="/admin/programmes/new"><Plus className="h-4 w-4" /> New programme</LinkButton> : null}
          </>
        }
      />
      <p className="mb-3 text-sm"><Link className="text-brand-700 hover:underline" href={sp.archived === "1" ? "/admin/programmes" : "/admin/programmes?archived=1"}>{sp.archived === "1" ? "Hide archived" : "Show archived"}</Link></p>
      {programmes.length === 0 ? (
        <EmptyState title="No programmes yet" description="Create a programme such as “Education” or “Environmental sustainability” to organise your projects." action={canWrite ? <LinkButton href="/admin/programmes/new">Create programme</LinkButton> : undefined} />
      ) : (
        <Table caption="Programmes">
          <thead><tr><Th>Name</Th><Th>Focus area</Th><Th>Projects</Th><Th>Period</Th><Th>Status</Th></tr></thead>
          <tbody className="divide-y divide-gray-100">
            {programmes.map((p) => (
              <Tr key={p.id}>
                <Td><Link href={`/admin/programmes/${p.id}`} className="font-medium text-gray-900 hover:underline">{p.name}</Link></Td>
                <Td>{p.focusArea?.name ?? "—"}</Td>
                <Td>{p._count.projects}</Td>
                <Td>{p.startDate ? `${formatDate(p.startDate)} – ${formatDate(p.endDate)}` : "—"}</Td>
                <Td><StatusBadge status={p.status} /></Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
