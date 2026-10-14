import { requireOrgContext } from "@/server/auth/session";
import { listTags } from "@/server/services/blog";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ActionForm, SubmitButton, TextField } from "@/components/ui/form";
import { ActionButton } from "@/components/ui/confirm-button";
import { BlogNav } from "../nav";
import { deleteTagAction, saveTagAction } from "../actions";

export const metadata = { title: "Blog tags" };

export default async function TagsPage() {
  const ctx = await requireOrgContext("blog.write");
  const items = await listTags(ctx);
  const canManage = ctx.permissions.has("blog.taxonomy");
  return (
    <div>
      <PageHeader title="Blog CMS" breadcrumbs={[{ label: "Blog", href: "/admin/blog" }, { label: "Tags" }]} />
      <BlogNav active="/admin/blog/tags" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title={`Tags (${items.length})`} description="Tags are also created automatically when added to a post." />
          <CardBody>
            {items.length === 0 ? <p className="text-sm text-gray-600">No tags yet.</p> : (
              <ul className="flex flex-wrap gap-2">
                {items.map((t) => (
                  <li key={t.id} className="flex items-center gap-1 rounded-full border border-gray-200 bg-white py-1 pl-3 pr-1 text-sm">
                    {t.name} <span className="text-xs text-gray-500">({t._count.posts})</span>
                    {canManage ? <ActionButton action={deleteTagAction} fields={{ id: t.id }} variant="ghost" confirm={`Delete tag “${t.name}”?`}>×<span className="sr-only">Delete {t.name}</span></ActionButton> : null}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
        {canManage ? (
          <Card><CardHeader title="Add tag" /><CardBody><ActionForm action={saveTagAction} className="space-y-3" resetOnSuccess><TextField label="Name" name="name" required /><SubmitButton size="sm">Add</SubmitButton></ActionForm></CardBody></Card>
        ) : null}
      </div>
    </div>
  );
}
