import Link from "next/link";
import { requireOrgContext } from "@/server/auth/session";
import { APPROVAL_LABELS, listApprovals } from "@/server/services/approvals";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { ActionButton } from "@/components/ui/confirm-button";
import { ActionForm, SubmitButton, TextField } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/empty-state";
import { cn, formatDateTime } from "@/lib/utils";
import { cancelAction, decideAction } from "./actions";

export const metadata = { title: "Approvals" };

export default async function ApprovalsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const ctx = await requireOrgContext();
  const view = (await searchParams).view === "decided" ? "DECIDED" : "PENDING";
  const items = await listApprovals(ctx, view);
  const reviewer = ctx.permissions.has("approval.review");
  return (
    <div>
      <PageHeader
        title="Approvals"
        description={reviewer ? "Review requested changes. Approving applies the change immediately; the request is only marked approved if the change succeeds." : "Requests you have submitted for approval."}
        breadcrumbs={[{ label: "Dashboard", href: "/admin" }, { label: "Approvals" }]}
      />
      <nav className="mb-4 flex gap-2" aria-label="Approval views">
        {(["PENDING", "DECIDED"] as const).map((v) => (
          <Link key={v} href={v === "PENDING" ? "/admin/approvals" : "/admin/approvals?view=decided"} aria-current={view === v ? "page" : undefined} className={cn("rounded-lg px-3 py-1.5 text-sm font-medium", view === v ? "bg-brand-600 text-white" : "bg-white text-gray-700 ring-1 ring-gray-200")}>
            {v === "PENDING" ? "Pending" : "Decided"}
          </Link>
        ))}
      </nav>
      {items.length === 0 ? (
        <EmptyState title={view === "PENDING" ? "Nothing awaiting approval" : "No decided requests"} description="Approval steps can be enabled in Organisation Settings for website publishing, report publication, budget changes, project status changes and impact verification." />
      ) : (
        <div className="space-y-3">
          {items.map((a) => (
            <Card key={a.id}>
              <CardBody className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="purple">{APPROVAL_LABELS[a.type]}</Badge>
                    <StatusBadge status={a.status} />
                  </div>
                  <p className="mt-2 font-medium text-gray-900">{a.title}</p>
                  <p className="text-xs text-gray-500">Requested by {a.requestedBy?.name ?? "—"} · {formatDateTime(a.createdAt)}</p>
                  {a.decidedAt ? <p className="text-xs text-gray-500">{a.status === "CANCELLED" ? "Cancelled" : "Decided"} by {a.decidedBy?.name ?? "—"} · {formatDateTime(a.decidedAt)}{a.decisionNote ? ` · “${a.decisionNote}”` : ""}</p> : null}
                </div>
                {a.status === "PENDING" ? (
                  <div className="flex flex-wrap items-end gap-2">
                    {reviewer ? (
                      <ActionForm action={decideAction} className="flex flex-wrap items-end gap-2" showSuccess>
                        <input type="hidden" name="id" value={a.id} />
                        <TextField label="Note (optional)" name="note" className="w-56" />
                        <SubmitButton name="decision" value="APPROVED" size="md">Approve</SubmitButton>
                        <SubmitButton name="decision" value="REJECTED" size="md" variant="outline">Reject</SubmitButton>
                      </ActionForm>
                    ) : null}
                    {a.requestedById === ctx.user.id ? <ActionButton action={cancelAction} fields={{ id: a.id }} size="md" variant="ghost">Cancel request</ActionButton> : null}
                  </div>
                ) : null}
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
