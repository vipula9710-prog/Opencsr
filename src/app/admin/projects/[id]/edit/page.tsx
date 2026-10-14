import { requireOrgContext } from "@/server/auth/session";
import { load } from "@/server/page";
import { getProject } from "@/server/services/projects";
import { PageHeader } from "@/components/ui/page-header";
import { ProjectForm } from "../../form";
import { projectFormOptions } from "../../options";

export const metadata = { title: "Edit project" };

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrgContext("project.write");
  const { id } = await params;
  const project = await load(getProject(ctx, id));
  const opts = await projectFormOptions(ctx);
  return (
    <div>
      <PageHeader title={`Edit ${project.title}`} breadcrumbs={[{ label: "Projects", href: "/admin/projects" }, { label: project.title, href: `/admin/projects/${id}` }, { label: "Edit" }]} />
      <ProjectForm {...opts} project={{ ...project, memberIds: project.members.map((m) => m.userId) }} />
    </div>
  );
}
