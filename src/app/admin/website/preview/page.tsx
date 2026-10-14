import { requireOrgContext } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { PageHeader } from "@/components/ui/page-header";
import { DevicePreview } from "./device-preview";

export const metadata = { title: "Device preview" };

export default async function PreviewPage() {
  const ctx = await requireOrgContext("website.edit");
  const pages = await prisma.page.findMany({ where: { organisationId: ctx.organisationId, status: { not: "ARCHIVED" } }, orderBy: [{ kind: "asc" }, { title: "asc" }], select: { title: true, slug: true, kind: true } });
  const paths = [
    ...pages.map((p) => ({ label: p.title, path: p.kind === "HOME" ? "/" : `/${p.slug}` })),
    { label: "Projects", path: "/projects" },
    { label: "Blog", path: "/blog" },
    { label: "Reports", path: "/reports" },
    { label: "Contact", path: "/contact" },
  ];
  return (
    <div>
      <PageHeader title="Device preview" description="The real website rendered with your unpublished draft (only visible to you while signed in)." breadcrumbs={[{ label: "Website", href: "/admin/website" }, { label: "Preview" }]} />
      <DevicePreview paths={paths} />
    </div>
  );
}
