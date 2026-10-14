import { requireOrgContext } from "@/server/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { ProjectForm } from "../form";
import { projectFormOptions } from "../options";

export const metadata = { title: "New project" };

export default async function NewProjectPage({ searchParams }: { searchParams: Promise<{ programmeId?: string }> }) {
  const ctx = await requireOrgContext("project.write");
  const opts = await projectFormOptions(ctx);
  const sp = await searchParams;
  return (
    <div>
      <PageHeader title="New project" breadcrumbs={[{ label: "Projects", href: "/admin/projects" }, { label: "New" }]} />
      <ProjectForm {...opts} defaults={{ programmeId: sp.programmeId }} />
    </div>
  );
}
