import Link from "next/link";
import { requireOrgContext } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { ActionForm, SelectField, SubmitButton, TextField } from "@/components/ui/form";
import { ActionButton } from "@/components/ui/confirm-button";
import { Dialog } from "@/components/ui/dialog";
import { LinkButton } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import { createPageAction, pageStatusAction, restoreRevisionAction } from "../actions";

export const metadata = { title: "Website pages" };

export default async function PagesPage() {
  const ctx = await requireOrgContext("website.edit");
  const pages = await prisma.page.findMany({
    where: { organisationId: ctx.organisationId },
    orderBy: [{ status: "asc" }, { kind: "asc" }, { title: "asc" }],
    include: { revisions: { orderBy: { revision: "desc" }, take: 15, include: { createdBy: { select: { name: true } } } }, _count: { select: { sections: true } } },
  });
  const canPublish = ctx.permissions.has("website.publish");
  return (
    <div>
      <PageHeader title="Pages" description="Pages are built from sections in the visual editor. Reserved addresses such as /admin, /api, /blog and /projects cannot be used." breadcrumbs={[{ label: "Website", href: "/admin/website" }, { label: "Pages" }]} />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Table caption="Pages">
            <thead><tr><Th>Page</Th><Th>Address</Th><Th>Status</Th><Th>Last published</Th><Th><span className="sr-only">Actions</span></Th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {pages.map((p) => (
                <Tr key={p.id}>
                  <Td>
                    <Link href={`/admin/website/pages/${p.id}`} className="font-medium hover:underline">{p.title}</Link>
                    <p className="text-xs text-gray-500">{p._count.sections} sections{p.kind === "LEGAL" ? " · legal" : ""}{p.hasUnpublishedChanges && p.status !== "ARCHIVED" ? " · unpublished changes" : ""}</p>
                  </Td>
                  <Td><code className="text-xs">{p.kind === "HOME" ? "/" : `/${p.slug}`}</code></Td>
                  <Td>{p.kind === "HOME" ? <Badge tone="purple">Homepage</Badge> : <StatusBadge status={p.status} />}</Td>
                  <Td className="text-xs">{formatDateTime(p.publishedAt)}</Td>
                  <Td className="whitespace-nowrap text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      {p.status !== "ARCHIVED" ? <LinkButton href={`/admin/website/pages/${p.id}`} size="sm" variant="outline">Edit</LinkButton> : null}
                      {canPublish && p.status !== "ARCHIVED" && (p.hasUnpublishedChanges || p.status === "DRAFT") ? <ActionButton action={pageStatusAction} fields={{ id: p.id, op: "publish" }} variant="primary">Publish page</ActionButton> : null}
                      {canPublish && p.kind !== "HOME" && p.status === "PUBLISHED" ? <ActionButton action={pageStatusAction} fields={{ id: p.id, op: "unpublish" }} confirm="Remove this page from the live website?">Unpublish</ActionButton> : null}
                      {canPublish && p.kind !== "HOME" && p.status !== "ARCHIVED" ? <ActionButton action={pageStatusAction} fields={{ id: p.id, op: "archive" }} variant="ghost" confirm="Archive this page? It will be removed from the website and menus.">Archive</ActionButton> : null}
                      {p.status === "ARCHIVED" ? <ActionButton action={pageStatusAction} fields={{ id: p.id, op: "restore" }}>Restore</ActionButton> : null}
                      {p.revisions.length ? (
                        <Dialog trigger="Revisions" title={`Revisions of ${p.title}`} triggerSize="sm" triggerVariant="ghost">
                          <ul className="divide-y divide-gray-100">
                            {p.revisions.map((r) => (
                              <li key={r.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                                <span>Revision {r.revision}{r.id === p.publishedRevisionId ? " (live)" : ""}<span className="block text-xs text-gray-500">{r.createdBy?.name ?? "System"} · {formatDateTime(r.createdAt)}{r.note ? ` · ${r.note}` : ""}</span></span>
                                <ActionButton action={restoreRevisionAction} fields={{ pageId: p.id, revisionId: r.id }} confirm="Replace the current draft of this page with this revision?">Restore to draft</ActionButton>
                              </li>
                            ))}
                          </ul>
                        </Dialog>
                      ) : null}
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
        <Card>
          <CardHeader title="Create page" />
          <CardBody>
            <ActionForm action={createPageAction} className="space-y-3">
              <TextField label="Title" name="title" required />
              <TextField label="Address" name="slug" required hint="e.g. our-approach → /our-approach" pattern="[a-z0-9-]+" />
              <SelectField label="Start with" name="template" defaultValue="content" options={[{ value: "content", label: "Heading + text" }, { value: "landing", label: "Landing page (hero, image & text, call to action)" }, { value: "blank", label: "Blank" }]} />
              <TextField label="SEO title (optional)" name="seoTitle" />
              <TextField label="SEO description (optional)" name="seoDescription" />
              <SubmitButton size="sm">Create draft page</SubmitButton>
            </ActionForm>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
