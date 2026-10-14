import { ActionForm, CheckboxField, SubmitButton, TextAreaField, TextField } from "@/components/ui/form";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { MediaField } from "@/components/admin/media-picker";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { savePostAction } from "./actions";

type Img = { id: string; filename: string; altText: string | null } | null;
type Post = {
  id: string; title: string; slug: string; excerpt: string | null; content: string; seoTitle: string | null; seoDescription: string | null; canonicalUrl: string | null; isFeatured: boolean;
  featuredImage: Img; ogImage: Img; categories: { id: string }[]; tags: { name: string }[];
};

const imgInit = (i: Img) => (i ? { id: i.id, url: `/media/${i.id}/${encodeURIComponent(i.filename)}`, alt: i.altText } : null);

export function PostEditor({ post, categories }: { post?: Post; categories: { id: string; name: string }[] }) {
  return (
    <ActionForm action={savePostAction} className="grid gap-6 lg:grid-cols-3">
      {post ? <input type="hidden" name="id" value={post.id} /> : null}
      <div className="space-y-4 lg:col-span-2">
        <TextField label="Title" name="title" defaultValue={post?.title} required className="[&_input]:text-lg [&_input]:font-semibold" />
        <div>
          <span className="mb-1 block text-sm font-medium text-gray-800">Content</span>
          <RichTextEditor name="content" label="Post content" initialHtml={post?.content} />
        </div>
        <TextAreaField label="Excerpt" name="excerpt" defaultValue={post?.excerpt ?? ""} rows={2} hint="Shown in listings. Generated from the content if left empty." />
        <SubmitButton pendingLabel="Saving…">{post ? "Save changes" : "Save draft"}</SubmitButton>
      </div>
      <div className="space-y-4">
        <Card>
          <CardHeader title="Organisation" />
          <CardBody className="space-y-3">
            <TextField label="Slug" name="slug" defaultValue={post?.slug} hint="URL: /blog/your-slug" />
            <fieldset>
              <legend className="mb-1 text-sm font-medium text-gray-800">Categories</legend>
              {categories.length === 0 ? <p className="text-xs text-gray-500">No categories yet.</p> : (
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {categories.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="categoryIds[]" value={c.id} defaultChecked={post?.categories.some((x) => x.id === c.id)} className="h-4 w-4 rounded border-gray-300" />{c.name}</label>
                  ))}
                </div>
              )}
            </fieldset>
            <TextField label="Tags" name="tagNames" defaultValue={post?.tags.map((t) => t.name).join(", ")} hint="Comma-separated" />
            <CheckboxField label="Featured post" name="isFeatured" defaultChecked={post?.isFeatured} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Images" />
          <CardBody className="space-y-4">
            <MediaField name="featuredImageId" label="Featured image" initial={imgInit(post?.featuredImage ?? null)} />
            <MediaField name="ogImageId" label="Social sharing image" initial={imgInit(post?.ogImage ?? null)} hint="Defaults to the featured image." />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="SEO" />
          <CardBody className="space-y-3">
            <TextField label="SEO title" name="seoTitle" defaultValue={post?.seoTitle ?? ""} />
            <TextAreaField label="SEO description" name="seoDescription" defaultValue={post?.seoDescription ?? ""} rows={2} />
            <TextField label="Canonical URL" name="canonicalUrl" type="url" defaultValue={post?.canonicalUrl ?? ""} hint="Only if this post was first published elsewhere." />
          </CardBody>
        </Card>
      </div>
    </ActionForm>
  );
}
