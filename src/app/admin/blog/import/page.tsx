import { requireOrgContext } from "@/server/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { BlogNav } from "../nav";
import { WordPressImportForm } from "./import-form";

export const metadata = { title: "Import from WordPress" };

export default async function WordPressImportPage() {
  const ctx = await requireOrgContext("blog.write");
  return (
    <div>
      <PageHeader title="Blog CMS" breadcrumbs={[{ label: "Blog", href: "/admin/blog" }, { label: "Import from WordPress" }]} />
      <BlogNav active="/admin/blog/import" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Import posts from WordPress" description="Bring existing blog posts, categories, tags, featured images and SEO descriptions into OpenCSR." />
          <CardBody>
            <WordPressImportForm canPublish={ctx.permissions.has("blog.publish")} canUploadMedia={ctx.permissions.has("media.write")} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="How to export from WordPress" />
          <CardBody className="space-y-3 text-sm text-gray-700">
            <ol className="list-decimal space-y-1 pl-5">
              <li>In your WordPress dashboard, open <strong>Tools → Export</strong>.</li>
              <li>Choose <strong>Posts</strong> (optionally filter by category or date).</li>
              <li>Click <strong>Download Export File</strong> and upload the .xml file here.</li>
            </ol>
            <p className="text-xs text-gray-500">
              Posts become authored by you. Posts whose address already exists here are skipped, so you can safely import again. Pages, comments and plugin content are not imported. Shortcodes are removed, and HTML is cleaned for security.
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
