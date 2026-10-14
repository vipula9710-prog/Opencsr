import { requireOrgContext } from "@/server/auth/session";
import { listAuthors } from "@/server/services/blog";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { ActionForm, SubmitButton, TextAreaField, TextField } from "@/components/ui/form";
import { MediaField } from "@/components/admin/media-picker";
import { Dialog } from "@/components/ui/dialog";
import { ROLE_LABELS } from "@/lib/permissions";
import { BlogNav } from "../nav";
import { saveAuthorAction } from "../actions";

export const metadata = { title: "Blog authors" };

export default async function AuthorsPage() {
  const ctx = await requireOrgContext("blog.write");
  const authors = await listAuthors(ctx);
  return (
    <div>
      <PageHeader title="Blog CMS" description="Public author names and biographies shown on articles." breadcrumbs={[{ label: "Blog", href: "/admin/blog" }, { label: "Authors" }]} />
      <BlogNav active="/admin/blog/authors" />
      <div className="grid gap-4 md:grid-cols-2">
        {authors.map((a) => {
          const editable = a.user.id === ctx.user.id || ctx.permissions.has("blog.edit_any");
          return (
            <Card key={a.user.id}>
              <CardBody className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  {a.profile?.avatar ? <img src={`/media/${a.profile.avatar.id}/${encodeURIComponent(a.profile.avatar.filename)}`} alt="" className="h-12 w-12 rounded-full object-cover" /> : <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-800">{a.user.name.slice(0, 1)}</span>}
                  <div>
                    <p className="font-medium">{a.profile?.displayName ?? a.user.name}</p>
                    <p className="text-xs text-gray-500">{ROLE_LABELS[a.role]} · {a.user._count.blogPosts} posts</p>
                    {a.profile?.bio ? <p className="mt-1 text-sm text-gray-600">{a.profile.bio}</p> : null}
                  </div>
                </div>
                {editable ? (
                  <Dialog trigger="Edit" title="Author profile" triggerSize="sm">
                    <ActionForm action={saveAuthorAction} className="space-y-3">
                      <input type="hidden" name="userId" value={a.user.id} />
                      <TextField label="Display name" name="displayName" defaultValue={a.profile?.displayName ?? a.user.name} required />
                      <TextAreaField label="Biography" name="bio" defaultValue={a.profile?.bio ?? ""} rows={3} />
                      <MediaField name="avatarId" label="Photo" initial={a.profile?.avatar ? { id: a.profile.avatar.id, url: `/media/${a.profile.avatar.id}/${encodeURIComponent(a.profile.avatar.filename)}` } : null} />
                      <SubmitButton size="sm">Save</SubmitButton>
                    </ActionForm>
                  </Dialog>
                ) : null}
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
