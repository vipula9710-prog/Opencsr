import Link from "next/link";
import { requireOrgContext } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filters";
import { StatusBadge } from "@/components/ui/badge";

export const metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const ctx = await requireOrgContext();
  const q = ((await searchParams).q ?? "").trim().slice(0, 100);
  const org = ctx.organisationId;
  const has = (p: string) => ctx.permissions.has(p as never);
  const contains = { contains: q, mode: "insensitive" as const };
  const [projects, partners, posts, documents, tasks] = q
    ? await Promise.all([
        has("project.read") ? prisma.project.findMany({ where: { organisationId: org, OR: [{ title: contains }, { location: contains }] }, take: 10, select: { id: true, title: true, status: true } }) : [],
        has("partner.read") ? prisma.partnerOrganisation.findMany({ where: { organisationId: org, name: contains }, take: 10, select: { id: true, name: true, verificationStatus: true } }) : [],
        has("blog.write") ? prisma.blogPost.findMany({ where: { organisationId: org, title: contains, ...(has("blog.edit_any") ? {} : { authorId: ctx.user.id }) }, take: 10, select: { id: true, title: true, status: true } }) : [],
        has("document.read") ? prisma.document.findMany({ where: { organisationId: org, title: contains, ...(has("document.confidential") ? {} : { visibility: { not: "CONFIDENTIAL" } }) }, take: 10, select: { id: true, title: true, status: true } }) : [],
        has("task.read") ? prisma.task.findMany({ where: { organisationId: org, title: contains }, take: 10, select: { id: true, title: true, status: true } }) : [],
      ])
    : [[], [], [], [], []];
  const groups = [
    { title: "Projects", items: projects.map((p) => ({ href: `/admin/projects/${p.id}`, label: p.title, status: p.status })) },
    { title: "Partners", items: partners.map((p) => ({ href: `/admin/partners/${p.id}`, label: p.name, status: p.verificationStatus })) },
    { title: "Tasks", items: tasks.map((p) => ({ href: `/admin/tasks/${p.id}`, label: p.title, status: p.status })) },
    { title: "Documents", items: documents.map((p) => ({ href: `/admin/documents/${p.id}`, label: p.title, status: p.status })) },
    { title: "Blog posts", items: posts.map((p) => ({ href: `/admin/blog/${p.id}/edit`, label: p.title, status: p.status })) },
  ].filter((g) => g.items.length);
  return (
    <div>
      <PageHeader title="Search" breadcrumbs={[{ label: "Dashboard", href: "/admin" }, { label: "Search" }]} />
      <FilterBar q={q} placeholder="Search across projects, partners, tasks, documents and posts" />
      {q && groups.length === 0 ? <p className="text-sm text-gray-600">No results for “{q}”.</p> : null}
      <div className="grid gap-4 md:grid-cols-2">
        {groups.map((g) => (
          <Card key={g.title}>
            <CardHeader title={g.title} />
            <CardBody>
              <ul className="space-y-2">{g.items.map((i) => <li key={i.href} className="flex items-center justify-between gap-2 text-sm"><Link href={i.href} className="hover:underline">{i.label}</Link><StatusBadge status={i.status} /></li>)}</ul>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
