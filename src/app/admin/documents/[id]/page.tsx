import Link from "next/link";
import { Download } from "lucide-react";
import { requireOrgContext } from "@/server/auth/session";
import { load } from "@/server/page";
import { getDocument } from "@/server/services/documents";
import { projectOptions } from "@/server/services/projects";
import { partnerOptions } from "@/server/services/partners";
import { ACCEPT_ATTRIBUTE } from "@/server/services/media";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader, DefinitionList } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { ActionButton } from "@/components/ui/confirm-button";
import { ActionForm, SubmitButton, TextField } from "@/components/ui/form";
import { Dialog } from "@/components/ui/dialog";
import { formatDate, formatDateTime, humanize } from "@/lib/utils";
import { DocumentFields } from "../fields";
import { addVersionAction, archiveDocumentAction, documentStatusAction, updateDocumentAction } from "../actions";

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrgContext("document.read");
  const { id } = await params;
  const doc = await load(getDocument(ctx, id));
  const canWrite = ctx.permissions.has("document.write");
  const canApprove = ctx.permissions.has("report.approve");
  const [projects, partners] = canWrite ? await Promise.all([projectOptions(ctx), partnerOptions(ctx)]) : [[], []];
  const current = doc.versions.find((v) => v.id === doc.currentVersionId) ?? doc.versions[0];
  return (
    <div>
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-3">{doc.title} <StatusBadge status={doc.visibility} /> <StatusBadge status={doc.status} /></span>}
        description={doc.description ?? undefined}
        breadcrumbs={[{ label: "Documents", href: "/admin/documents" }, { label: doc.title }]}
        actions={
          <>
            {current ? <a href={`/api/files/${current.mediaAsset.id}?download=1`} className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"><Download className="h-4 w-4" /> Download</a> : null}
            {canWrite ? (
              <Dialog trigger="Edit details" title="Edit document" wide>
                <ActionForm action={updateDocumentAction} className="space-y-4">
                  <input type="hidden" name="id" value={id} />
                  <DocumentFields doc={doc} projects={projects.map((p) => ({ value: p.id, label: p.title }))} partners={partners.map((p) => ({ value: p.id, label: p.name }))} canConfidential={ctx.permissions.has("document.confidential")} />
                  <SubmitButton>Save</SubmitButton>
                </ActionForm>
              </Dialog>
            ) : null}
            {canWrite && (doc.status === "DRAFT" || doc.status === "REJECTED") ? <ActionButton action={documentStatusAction} fields={{ id, status: "IN_REVIEW" }} size="md">Submit for review</ActionButton> : null}
            {canApprove && doc.status === "IN_REVIEW" ? (
              <>
                <ActionButton action={documentStatusAction} fields={{ id, status: "APPROVED" }} size="md" variant="primary">Approve</ActionButton>
                <ActionButton action={documentStatusAction} fields={{ id, status: "REJECTED" }} size="md">Reject</ActionButton>
              </>
            ) : null}
            {canWrite ? <ActionButton action={archiveDocumentAction} fields={{ id, archived: doc.archivedAt ? "0" : "1" }} size="md" variant="ghost">{doc.archivedAt ? "Restore" : "Archive"}</ActionButton> : null}
          </>
        }
      />
      {doc.visibility === "PUBLIC" ? (
        <p className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
          {doc.status === "APPROVED" && !doc.archivedAt ? "This document is approved and publicly downloadable from the Reports page of your website." : "Marked public, but it will only appear on the website after it is approved."}
        </p>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Versions" />
          <CardBody className="p-0">
            <ul className="divide-y divide-gray-100">
              {doc.versions.map((v) => (
                <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                  <div>
                    <p className="font-medium">Version {v.version} {v.id === doc.currentVersionId ? <span className="text-xs text-brand-700">(current)</span> : null}</p>
                    <p className="text-xs text-gray-500">{v.mediaAsset.filename} · {Math.ceil(v.mediaAsset.size / 1024)} KB · {v.uploadedBy?.name ?? "—"} · {formatDateTime(v.createdAt)}</p>
                    {v.notes ? <p className="text-xs text-gray-700">{v.notes}</p> : null}
                  </div>
                  <a href={`/api/files/${v.mediaAsset.id}?download=1`} className="text-sm font-medium text-brand-700 hover:underline">Download</a>
                </li>
              ))}
            </ul>
            {canWrite ? (
              <ActionForm action={addVersionAction} className="space-y-3 border-t border-gray-100 px-5 py-4" resetOnSuccess>
                <input type="hidden" name="id" value={id} />
                <TextField label="Upload a new version" name="file" type="file" accept={ACCEPT_ATTRIBUTE} required />
                <TextField label="What changed?" name="notes" />
                <SubmitButton size="sm" pendingLabel="Uploading…">Upload version</SubmitButton>
              </ActionForm>
            ) : null}
          </CardBody>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Metadata" />
            <CardBody>
              <DefinitionList
                items={[
                  { label: "Category", value: humanize(doc.category) },
                  { label: "Project", value: doc.project ? <Link className="text-brand-700 hover:underline" href={`/admin/projects/${doc.project.id}`}>{doc.project.title}</Link> : null },
                  { label: "Partner", value: doc.partner ? <Link className="text-brand-700 hover:underline" href={`/admin/partners/${doc.partner.id}`}>{doc.partner.name}</Link> : null },
                  { label: "Financial year", value: doc.financialYear },
                  { label: "Period", value: doc.periodStart ? `${formatDate(doc.periodStart)} – ${formatDate(doc.periodEnd)}` : null },
                  { label: "Created", value: formatDateTime(doc.createdAt) },
                ]}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="History" />
            <CardBody>
              <ol className="space-y-2">{doc.history.map((h) => <li key={h.id} className="text-xs"><p className="text-sm">{h.summary}</p><p className="text-gray-500">{h.actor?.name ?? "System"} · {formatDateTime(h.createdAt)}</p></li>)}</ol>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
