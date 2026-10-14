import { requireOrgContext } from "@/server/auth/session";
import { listCategories } from "@/server/services/blog";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ActionForm, SubmitButton, TextAreaField, TextField } from "@/components/ui/form";
import { ActionButton } from "@/components/ui/confirm-button";
import { Dialog } from "@/components/ui/dialog";
import { BlogNav } from "../nav";
import { deleteCategoryAction, saveCategoryAction } from "../actions";

export const metadata = { title: "Blog categories" };

export default async function CategoriesPage() {
  const ctx = await requireOrgContext("blog.write");
  const items = await listCategories(ctx);
  const canManage = ctx.permissions.has("blog.taxonomy");
  return (
    <div>
      <PageHeader title="Blog CMS" breadcrumbs={[{ label: "Blog", href: "/admin/blog" }, { label: "Categories" }]} />
      <BlogNav active="/admin/blog/categories" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title={`Categories (${items.length})`} />
          <CardBody>
            {items.length === 0 ? <p className="text-sm text-gray-600">No categories yet.</p> : (
              <ul className="divide-y divide-gray-100">
                {items.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <div><p className="font-medium">{c.name} <span className="text-xs text-gray-500">/{c.slug} · {c._count.posts} posts</span></p>{c.description ? <p className="text-gray-600">{c.description}</p> : null}</div>
                    {canManage ? (
                      <div className="flex gap-2">
                        <Dialog trigger="Edit" title="Edit category" triggerSize="sm">
                          <ActionForm action={saveCategoryAction} className="space-y-3"><input type="hidden" name="id" value={c.id} /><TextField label="Name" name="name" defaultValue={c.name} required /><TextField label="Slug" name="slug" defaultValue={c.slug} /><TextAreaField label="Description" name="description" defaultValue={c.description ?? ""} rows={2} /><SubmitButton size="sm">Save</SubmitButton></ActionForm>
                        </Dialog>
                        <ActionButton action={deleteCategoryAction} fields={{ id: c.id }} variant="ghost" confirm="Delete this category? Posts are kept.">Delete</ActionButton>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
        {canManage ? (
          <Card>
            <CardHeader title="Add category" />
            <CardBody>
              <ActionForm action={saveCategoryAction} className="space-y-3" resetOnSuccess><TextField label="Name" name="name" required /><TextField label="Slug" name="slug" hint="Optional" /><TextAreaField label="Description" name="description" rows={2} /><SubmitButton size="sm">Add</SubmitButton></ActionForm>
            </CardBody>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
