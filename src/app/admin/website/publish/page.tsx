import { requireOrgContext } from "@/server/auth/session";
import { getBuilderState, listThemeVersions, approvalRules } from "@/server/services/website";
import { can } from "@/server/context";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ActionForm, SubmitButton, TextField } from "@/components/ui/form";
import { ActionButton } from "@/components/ui/confirm-button";
import { formatDateTime } from "@/lib/utils";
import { getTemplate } from "@/lib/theme/templates";
import { discardFormAction, publishFormAction, restoreVersionAction } from "../actions";

export const metadata = { title: "Publish website" };

export default async function PublishPage() {
  const ctx = await requireOrgContext("website.edit");
  const [state, versions] = await Promise.all([getBuilderState(ctx), listThemeVersions(ctx)]);
  const changedPages = state.pages.filter((p) => p.hasUnpublishedChanges && p.status === "PUBLISHED");
  const canPublish = can(ctx, "website.publish");
  const needsApproval = Boolean(approvalRules(ctx).websitePublish) && !can(ctx, "approval.review");
  return (
    <div>
      <PageHeader title="Publish & history" description="Publishing validates the draft and replaces the live website in one step. Each publish creates a version you can roll back to." breadcrumbs={[{ label: "Website", href: "/admin/website" }, { label: "Publish" }]} />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Draft changes" />
          <CardBody className="space-y-4 text-sm">
            {state.hasUnpublishedChanges ? (
              <>
                <p>The draft differs from the live website.{changedPages.length ? " Pages with changes:" : " Theme, header/footer or navigation have changed."}</p>
                {changedPages.length ? <ul className="list-disc pl-5">{changedPages.map((p) => <li key={p.id}>{p.title}</li>)}</ul> : null}
              </>
            ) : <p>No unpublished changes. The live website matches the draft.</p>}
            {canPublish ? (
              <ActionForm action={publishFormAction} className="flex flex-wrap items-end gap-3">
                <TextField label="Note (optional)" name="note" className="min-w-[16rem] flex-1" placeholder="What changed?" />
                <SubmitButton pendingLabel="Publishing…">{needsApproval ? "Request publish approval" : "Publish now"}</SubmitButton>
              </ActionForm>
            ) : <p className="text-gray-600">Your role can edit drafts but not publish them.</p>}
            <div className="border-t border-gray-100 pt-4">
              <ActionButton action={discardFormAction} size="md" variant="outline" confirm="Discard all unpublished changes and reset the draft to the live version?">Discard all draft changes</ActionButton>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Live website" />
          <CardBody className="space-y-1 text-sm">
            <p>Version: <strong>{state.publishedVersion ? `v${state.publishedVersion}` : "none"}</strong></p>
            <p>Published: {formatDateTime(state.publishedAt)}</p>
            <a href="/" target="_blank" className="inline-block pt-2 font-medium text-brand-700 hover:underline">Open live website</a>
          </CardBody>
        </Card>
      </div>
      <Card className="mt-6">
        <CardHeader title="Version history" description="Restore copies a version's theme, header/footer and navigation into the draft. “Roll back & publish” makes it live immediately. Page content has its own revisions under Pages." />
        <CardBody className="p-0">
          <ul className="divide-y divide-gray-100">
            {versions.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                <div>
                  <p className="font-medium">Version {v.version} {v.kind === "BACKUP" ? <Badge tone="gray">Backup</Badge> : <Badge tone="green">Published</Badge>} {v.version === state.publishedVersion ? <Badge tone="purple">Live</Badge> : null}</p>
                  <p className="text-xs text-gray-500">{formatDateTime(v.createdAt)} · {v.createdBy?.name ?? "System"} · theme {getTemplate(v.templateKey ?? "")?.name ?? "Custom"}{v.note ? ` · ${v.note}` : ""}</p>
                </div>
                <div className="flex gap-2">
                  <ActionButton action={restoreVersionAction} fields={{ id: v.id }} confirm="Replace the current draft theme, header/footer and navigation with this version?">Restore to draft</ActionButton>
                  {canPublish && v.version !== state.publishedVersion ? <ActionButton action={restoreVersionAction} fields={{ id: v.id, publish: "1" }} variant="primary" confirm="Roll back the live website to this version now?">Roll back & publish</ActionButton> : null}
                </div>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
