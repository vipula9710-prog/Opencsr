import { ExternalLink } from "lucide-react";
import { requireOrgContext } from "@/server/auth/session";
import { load } from "@/server/page";
import { getPostForEdit, taxonomyOptions } from "@/server/services/blog";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { ActionButton } from "@/components/ui/confirm-button";
import { LinkButton } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import { PostEditor } from "../../editor";
import { ScheduleForm } from "./schedule";
import { deletePostAction, postStatusAction } from "../../actions";

export const metadata = { title: "Edit post" };

export default async function EditPostPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const ctx = await requireOrgContext("blog.write");
  const { id } = await params;
  const sp = await searchParams;
  const [post, { categories }] = await Promise.all([load(getPostForEdit(ctx, id)), taxonomyOptions(ctx)]);
  const canPublish = ctx.permissions.has("blog.publish");
  return (
    <div>
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-3">{post.title} <StatusBadge status={post.status} /></span>}
        breadcrumbs={[{ label: "Blog", href: "/admin/blog" }, { label: post.title }]}
        actions={
          <>
            {post.status === "PUBLISHED" ? <LinkButton href={`/blog/${post.slug}`} target="_blank" variant="outline"><ExternalLink className="h-4 w-4" /> View</LinkButton> : null}
            <ActionButton action={deletePostAction} fields={{ id }} size="md" variant="ghost" confirm="Delete this post permanently?" redirectTo="/admin/blog">Delete</ActionButton>
          </>
        }
      />
      {sp.created ? <p role="status" className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">Draft created.</p> : null}
      <Card className="mb-6">
        <CardHeader title="Publishing" description={post.status === "SCHEDULED" ? `Scheduled for ${formatDateTime(post.scheduledFor)}` : post.publishedAt ? `Published ${formatDateTime(post.publishedAt)}` : "Not published — visible only to signed-in editors."} />
        <CardBody className="flex flex-wrap items-end gap-3">
          {canPublish ? (
            <>
              {post.status !== "PUBLISHED" ? <ActionButton action={postStatusAction} fields={{ id, action: "publish" }} variant="primary" size="md">Publish now</ActionButton> : <ActionButton action={postStatusAction} fields={{ id, action: "unpublish" }} size="md">Unpublish</ActionButton>}
              <ScheduleForm id={id} />
              {post.status !== "ARCHIVED" ? <ActionButton action={postStatusAction} fields={{ id, action: "archive" }} size="md" variant="ghost">Archive</ActionButton> : null}
            </>
          ) : (
            <ActionButton action={postStatusAction} fields={{ id, action: "submit" }} size="md" variant="primary">Submit for review</ActionButton>
          )}
        </CardBody>
      </Card>
      <PostEditor post={post} categories={categories} />
      <Card className="mt-6">
        <CardHeader title="Publication history" />
        <CardBody>
          <ol className="space-y-2">{post.history.map((h) => <li key={h.id} className="text-xs"><p className="text-sm">{h.summary}</p><p className="text-gray-500">{h.actor?.name ?? "System"} · {formatDateTime(h.createdAt)}</p></li>)}</ol>
        </CardBody>
      </Card>
    </div>
  );
}
