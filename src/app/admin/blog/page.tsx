import Link from "next/link";
import { Plus } from "lucide-react";
import { requireOrgContext } from "@/server/auth/session";
import { listPosts, POST_STATUSES } from "@/server/services/blog";
import { parseListQuery } from "@/server/services/common";
import { PageHeader } from "@/components/ui/page-header";
import { LinkButton } from "@/components/ui/button";
import { FilterBar, FilterSelect } from "@/components/ui/filters";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate, formatDateTime, humanize } from "@/lib/utils";
import { BlogNav } from "./nav";
import type { SearchParams } from "@/server/page";

export const metadata = { title: "Blog CMS" };

export default async function BlogPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await requireOrgContext("blog.write");
  const q = parseListQuery(await searchParams);
  const result = await listPosts(ctx, q);
  const params = { q: q.q, status: q.status };
  return (
    <div>
      <PageHeader title="Blog CMS" breadcrumbs={[{ label: "Dashboard", href: "/admin" }, { label: "Blog" }]} actions={<LinkButton href="/admin/blog/new"><Plus className="h-4 w-4" /> New post</LinkButton>} description={ctx.permissions.has("blog.edit_any") ? undefined : "You can see and edit your own posts."} />
      <BlogNav active="/admin/blog" />
      <FilterBar q={q.q} placeholder="Search posts">
        <FilterSelect name="status" label="Status" value={q.status} options={POST_STATUSES.map((s) => ({ value: s, label: humanize(s) }))} />
      </FilterBar>
      {result.total === 0 ? (
        <EmptyState title="No posts yet" action={<LinkButton href="/admin/blog/new">Write a post</LinkButton>} />
      ) : (
        <>
          <Table caption="Posts">
            <thead><tr><Th>Title</Th><Th>Author</Th><Th>Categories</Th><Th>Status</Th><Th>Published / scheduled</Th><Th>Updated</Th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {result.items.map((p) => (
                <Tr key={p.id}>
                  <Td><Link href={`/admin/blog/${p.id}/edit`} className="font-medium hover:underline">{p.title}</Link>{p.isFeatured ? <span className="ml-2 text-xs text-amber-700">Featured</span> : null}</Td>
                  <Td>{p.author?.name ?? "—"}</Td>
                  <Td className="text-xs">{p.categories.map((c) => c.name).join(", ") || "—"}</Td>
                  <Td><StatusBadge status={p.status} /></Td>
                  <Td className="text-xs">{p.status === "SCHEDULED" ? formatDateTime(p.scheduledFor) : formatDate(p.publishedAt)}</Td>
                  <Td className="text-xs">{formatDate(p.updatedAt)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <Pagination {...result} params={params} basePath="/admin/blog" />
        </>
      )}
    </div>
  );
}
