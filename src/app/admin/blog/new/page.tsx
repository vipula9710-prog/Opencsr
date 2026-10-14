import { requireOrgContext } from "@/server/auth/session";
import { taxonomyOptions } from "@/server/services/blog";
import { PageHeader } from "@/components/ui/page-header";
import { PostEditor } from "../editor";

export const metadata = { title: "New post" };

export default async function NewPostPage() {
  const ctx = await requireOrgContext("blog.write");
  const { categories } = await taxonomyOptions(ctx);
  return (
    <div>
      <PageHeader title="New post" breadcrumbs={[{ label: "Blog", href: "/admin/blog" }, { label: "New" }]} />
      <PostEditor categories={categories} />
    </div>
  );
}
