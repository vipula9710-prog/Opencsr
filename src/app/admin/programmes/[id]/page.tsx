import Link from "next/link";
import { requireOrgContext } from "@/server/auth/session";
import { load } from "@/server/page";
import { getProgramme } from "@/server/services/projects";
import { listFocusAreas } from "@/server/services/organisations";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { ProgrammeForm } from "../form";

export default async function ProgrammePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrgContext("programme.read");
  const { id } = await params;
  const programme = await load(getProgramme(ctx, id));
  const canWrite = ctx.permissions.has("programme.write");
  const focusAreas = canWrite ? await listFocusAreas(ctx) : [];
  return (
    <div>
      <PageHeader
        title={programme.name}
        description={programme.description ?? undefined}
        breadcrumbs={[{ label: "CSR Programmes", href: "/admin/programmes" }, { label: programme.name }]}
        actions={ctx.permissions.has("project.write") ? <LinkButton href={`/admin/projects/new?programmeId=${programme.id}`}>Add project</LinkButton> : null}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title={`Projects (${programme.projects.length})`} />
          <CardBody>
            {programme.projects.length === 0 ? <p className="text-sm text-gray-600">No projects in this programme yet.</p> : (
              <ul className="divide-y divide-gray-100">
                {programme.projects.map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                    <Link href={`/admin/projects/${p.id}`} className="font-medium hover:underline">{p.title}</Link>
                    <span className="flex items-center gap-3 text-gray-500">{formatDate(p.startDate)}<StatusBadge status={p.status} /></span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Impact indicators" />
          <CardBody>
            {programme.impactIndicators.length === 0 ? <p className="text-sm text-gray-600">No programme-level indicators.</p> : (
              <ul className="space-y-1 text-sm">{programme.impactIndicators.map((i) => <li key={i.id}><Link href={`/admin/impact/${i.id}`} className="hover:underline">{i.name}</Link> <span className="text-gray-500">({i.unit})</span></li>)}</ul>
            )}
          </CardBody>
        </Card>
        {canWrite ? (
          <Card className="lg:col-span-3">
            <CardHeader title="Edit programme" />
            <CardBody><ProgrammeForm programme={programme} focusAreas={focusAreas} /></CardBody>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
