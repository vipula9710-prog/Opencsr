import { FileText } from "lucide-react";
import { requireOrgContext } from "@/server/auth/session";
import { listMedia, publicMediaUrl, privateFileUrl, ACCEPT_ATTRIBUTE } from "@/server/services/media";
import { parseListQuery } from "@/server/services/common";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { FilterBar, FilterSelect } from "@/components/ui/filters";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/badge";
import { ActionForm, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/ui/form";
import { ActionButton } from "@/components/ui/confirm-button";
import { Dialog } from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";
import type { SearchParams } from "@/server/page";
import { deleteMediaAction, replaceMediaAction, updateMediaAction, uploadMediaAction } from "./actions";

export const metadata = { title: "Media Library" };

export default async function MediaPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await requireOrgContext("media.read");
  const q = parseListQuery(await searchParams);
  const result = await listMedia(ctx, { ...q, pageSize: 24 });
  const canWrite = ctx.permissions.has("media.write");
  const params = { q: q.q, kind: q.kind, visibility: q.visibility };
  const maxMb = Math.min(Number(process.env.UPLOAD_MAX_MB ?? 15) || 15, 25);
  return (
    <div>
      <PageHeader title="Media Library" description="Images and files for your website, projects and blog. Public files can be used on the website; private files are only served to signed-in members." breadcrumbs={[{ label: "Dashboard", href: "/admin" }, { label: "Media" }]} />
      {canWrite ? (
        <Card className="mb-6">
          <CardBody>
            <ActionForm action={uploadMediaAction} className="flex flex-wrap items-end gap-3" resetOnSuccess>
              <TextField label="Upload files" name="files" type="file" multiple accept={ACCEPT_ATTRIBUTE} hint={`Images (JPG, PNG, GIF, WebP, ICO), PDF and office documents. Max ${maxMb} MB each. SVG and HTML are not accepted for security reasons.`} className="min-w-[16rem] flex-1" />
              <SelectField label="Visibility" name="visibility" defaultValue="PUBLIC" options={[{ value: "PUBLIC", label: "Public (usable on website)" }, { value: "PRIVATE", label: "Private (members only)" }]} />
              <SubmitButton pendingLabel="Uploading…">Upload</SubmitButton>
            </ActionForm>
          </CardBody>
        </Card>
      ) : null}
      <FilterBar q={q.q} placeholder="Search file name, title or alt text">
        <FilterSelect name="kind" label="Type" value={q.kind} options={[{ value: "image", label: "Images" }, { value: "document", label: "Documents" }]} />
        <FilterSelect name="visibility" label="Visibility" value={q.visibility} options={[{ value: "PUBLIC", label: "Public" }, { value: "PRIVATE", label: "Private" }]} />
      </FilterBar>
      {result.total === 0 ? (
        <EmptyState title="No files" description="Upload logos, photographs and documents to reuse them across your site and projects." />
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {result.items.map((m) => {
              const url = m.visibility === "PUBLIC" ? publicMediaUrl(m) : privateFileUrl(m);
              const isImage = m.mimeType.startsWith("image/");
              return (
                <li key={m.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                  {isImage ? <img src={url} alt={m.altText ?? ""} className="aspect-square w-full bg-gray-100 object-cover" loading="lazy" /> : <div className="flex aspect-square items-center justify-center bg-gray-100"><FileText className="h-10 w-10 text-gray-400" aria-hidden /></div>}
                  <div className="space-y-1 p-2">
                    <p className="truncate text-xs font-medium" title={m.filename}>{m.title ?? m.filename}</p>
                    <p className="text-[11px] text-gray-500">{Math.ceil(m.size / 1024)} KB{m.width ? ` · ${m.width}×${m.height}` : ""} · {formatDate(m.createdAt)}</p>
                    <StatusBadge status={m.visibility} />
                    {isImage && !m.altText ? <p className="text-[11px] font-medium text-amber-700">Missing alt text</p> : null}
                    <div className="flex flex-wrap gap-1 pt-1">
                      <Dialog trigger="Details" title={m.filename} triggerSize="sm">
                        <div className="space-y-4">
                          {isImage ? <img src={url} alt={m.altText ?? ""} className="max-h-64 w-full rounded object-contain" /> : null}
                          <p className="break-all text-xs text-gray-600">URL: <code>{url}</code></p>
                          {canWrite ? (
                            <>
                              <ActionForm action={updateMediaAction} className="space-y-3">
                                <input type="hidden" name="id" value={m.id} />
                                <TextField label="Alternative text" name="altText" defaultValue={m.altText ?? ""} hint="Describe the image for people using screen readers." />
                                <TextField label="Title" name="title" defaultValue={m.title ?? ""} />
                                <TextAreaField label="Description" name="description" defaultValue={m.description ?? ""} rows={2} />
                                <SelectField label="Visibility" name="visibility" defaultValue={m.visibility} options={[{ value: "PUBLIC", label: "Public" }, { value: "PRIVATE", label: "Private" }]} />
                                <SubmitButton size="sm">Save details</SubmitButton>
                              </ActionForm>
                              <ActionForm action={replaceMediaAction} className="space-y-2 border-t border-gray-100 pt-3">
                                <input type="hidden" name="id" value={m.id} />
                                <TextField label="Replace file (keeps all references)" name="file" type="file" accept={ACCEPT_ATTRIBUTE} />
                                <SubmitButton size="sm" variant="outline">Replace</SubmitButton>
                              </ActionForm>
                              <div className="border-t border-gray-100 pt-3"><ActionButton action={deleteMediaAction} fields={{ id: m.id }} variant="danger" confirm="Delete this file permanently?">Delete file</ActionButton></div>
                            </>
                          ) : null}
                        </div>
                      </Dialog>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <Pagination {...result} params={params} basePath="/admin/media" />
        </>
      )}
    </div>
  );
}
