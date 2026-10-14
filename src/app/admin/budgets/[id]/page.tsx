import Link from "next/link";
import { Download } from "lucide-react";
import { requireOrgContext } from "@/server/auth/session";
import { load } from "@/server/page";
import { financeHistory, getBudgetPlan } from "@/server/services/finance";
import { listProgrammes, projectOptions } from "@/server/services/projects";
import { partnerOptions } from "@/server/services/partners";
import { documentOptions } from "@/server/services/documents";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader, StatCard } from "@/components/ui/card";
import { Td, Th, Tr } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { ActionButton } from "@/components/ui/confirm-button";
import { ActionForm, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/ui/form";
import { Dialog } from "@/components/ui/dialog";
import { BudgetChart } from "@/components/admin/charts";
import { formatMoney } from "@/lib/money";
import { formatDate, formatDateTime, toDateInput } from "@/lib/utils";
import { allocationAction, deleteAllocationAction, disbursementAction, expenditureAction, planStatusAction, updatePlanAction } from "../actions";

type Opt = { value: string; label: string };

function ExpenditureForm({ planId, projects, documents, e }: { planId: string; projects: Opt[]; documents: Opt[]; e?: { id: string; projectId: string; description: string; category: string | null; payee: string | null; amount: string; status: string; date: Date; paymentReference: string | null; documentId: string | null; notes: string | null } }) {
  return (
    <ActionForm action={expenditureAction} className="space-y-3" resetOnSuccess={!e}>
      <input type="hidden" name="planId" value={planId} />
      {e ? <input type="hidden" name="id" value={e.id} /> : null}
      <SelectField label="Project" name="projectId" defaultValue={e?.projectId} required options={projects} placeholder="Choose…" />
      <TextField label="Description" name="description" defaultValue={e?.description} required />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Amount" name="amount" inputMode="decimal" defaultValue={e?.amount} required />
        <SelectField label="Status" name="status" defaultValue={e?.status ?? "COMMITTED"} options={[{ value: "COMMITTED", label: "Committed" }, { value: "INCURRED", label: "Incurred (utilised)" }, { value: "CANCELLED", label: "Cancelled" }]} />
        <TextField label="Date" name="date" type="date" defaultValue={toDateInput(e?.date ?? new Date())} required />
        <TextField label="Category" name="category" defaultValue={e?.category ?? ""} />
        <TextField label="Payee" name="payee" defaultValue={e?.payee ?? ""} />
        <TextField label="Payment reference" name="paymentReference" defaultValue={e?.paymentReference ?? ""} />
      </div>
      <SelectField label="Supporting document" name="documentId" defaultValue={e?.documentId ?? ""} placeholder="None" options={documents} />
      <TextAreaField label="Notes" name="notes" defaultValue={e?.notes ?? ""} rows={2} />
      <SubmitButton size="sm">Save expenditure</SubmitButton>
    </ActionForm>
  );
}

export default async function BudgetPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrgContext("finance.read");
  const { id } = await params;
  const plan = await load(getBudgetPlan(ctx, id));
  const canWrite = ctx.permissions.has("finance.write") && plan.status !== "CLOSED";
  const [history, projects, programmes, partners, documents] = await Promise.all([
    financeHistory(ctx, id),
    canWrite ? projectOptions(ctx) : Promise.resolve([]),
    canWrite ? listProgrammes(ctx) : Promise.resolve([]),
    canWrite ? partnerOptions(ctx) : Promise.resolve([]),
    canWrite ? documentOptions(ctx) : Promise.resolve([]),
  ]);
  const money = (v: string) => formatMoney(v, plan.currency, ctx.organisation.locale);
  const t = plan.totals;
  const allocatedProjects = plan.byProject.map((b) => ({ value: b.project.id, label: b.project.title }));
  const docOpts = documents.map((d) => ({ value: d.id, label: d.title }));

  return (
    <div>
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-3">{plan.title} <StatusBadge status={plan.status} /></span>}
        description={`Financial year ${plan.fyLabel} · amounts in ${plan.currency}`}
        breadcrumbs={[{ label: "Budgets", href: "/admin/budgets" }, { label: plan.title }]}
        actions={
          <>
            <LinkButton href={`/api/export/budget?planId=${id}`} variant="outline" prefetch={false}><Download className="h-4 w-4" /> Export CSV</LinkButton>
            {ctx.permissions.has("finance.write") && (plan.status === "DRAFT" || plan.status === "SUBMITTED") ? (
              <Dialog trigger="Edit plan" title="Edit budget plan">
                <ActionForm action={updatePlanAction} className="space-y-3">
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="fyStartYear" value={plan.fyStartYear} />
                  <TextField label="Title" name="title" defaultValue={plan.title} required />
                  <TextField label="Total amount" name="totalAmount" defaultValue={plan.totalAmount} inputMode="decimal" required />
                  <TextAreaField label="Notes" name="notes" defaultValue={plan.notes ?? ""} rows={2} />
                  <SubmitButton size="sm">Save</SubmitButton>
                </ActionForm>
              </Dialog>
            ) : null}
            {ctx.permissions.has("finance.write") && plan.status === "DRAFT" ? <ActionButton action={planStatusAction} fields={{ id, status: "SUBMITTED" }} size="md">Submit for approval</ActionButton> : null}
            {ctx.permissions.has("finance.approve") && plan.status === "SUBMITTED" ? <ActionButton action={planStatusAction} fields={{ id, status: "APPROVED" }} size="md" variant="primary">Approve plan</ActionButton> : null}
            {ctx.permissions.has("finance.approve") && plan.status === "APPROVED" ? <ActionButton action={planStatusAction} fields={{ id, status: "CLOSED" }} size="md" confirm="Close this plan? No further changes will be possible.">Close plan</ActionButton> : null}
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total budget" value={money(t.total)} hint={`${money(t.unallocated)} not yet allocated`} />
        <StatCard label="Allocated" value={money(t.allocated)} hint={`${t.allocationPct}% of total`} />
        <StatCard label="Utilised" value={money(t.utilised)} hint={`${t.utilisationPct}% of allocation · ${money(t.committed)} committed`} />
        <StatCard label="Remaining" value={money(t.remaining)} hint={`Disbursed to partners: ${money(t.disbursed)}`} />
      </div>

      {plan.byProject.length ? (
        <Card className="mt-6">
          <CardHeader title="Allocation vs. spending by project" />
          <CardBody>
            <BudgetChart currency={plan.currency} data={plan.byProject.map((b) => ({ name: b.project.title.replace(/^Project /, "").slice(0, 22), allocated: Number(b.allocated), committed: Number(b.committed), utilised: Number(b.utilised) }))} />
          </CardBody>
        </Card>
      ) : null}

      <Card className="mt-6">
        <CardHeader
          title="Allocations"
          actions={
            canWrite ? (
              <Dialog trigger="Add allocation" title="Add allocation" triggerSize="sm">
                <ActionForm action={allocationAction} className="space-y-3" resetOnSuccess>
                  <input type="hidden" name="planId" value={id} />
                  <SelectField label="Allocate to" name="target" required placeholder="Choose…" options={[...projects.map((p) => ({ value: `project:${p.id}`, label: `Project — ${p.title}` })), ...programmes.map((p) => ({ value: `programme:${p.id}`, label: `Programme reserve — ${p.name}` }))]} />
                  <TextField label="Amount" name="amount" inputMode="decimal" required hint={`Unallocated: ${money(t.unallocated)}`} />
                  <TextAreaField label="Notes" name="notes" rows={2} />
                  <SubmitButton size="sm">Save allocation</SubmitButton>
                </ActionForm>
              </Dialog>
            ) : null
          }
        />
        <CardBody className="p-0">
          {plan.allocations.length === 0 ? <p className="px-5 py-4 text-sm text-gray-600">No allocations yet.</p> : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <thead><tr><Th>Project / programme</Th><Th>Allocated</Th><Th>Committed</Th><Th>Utilised</Th><Th>Remaining</Th><Th>Disbursed</Th><Th><span className="sr-only">Actions</span></Th></tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {plan.allocations.map((a) => {
                    const b = plan.byProject.find((x) => x.allocationId === a.id);
                    return (
                      <Tr key={a.id}>
                        <Td>{a.project ? <Link className="font-medium hover:underline" href={`/admin/projects/${a.project.id}`}>{a.project.title}</Link> : <span>Programme reserve — {a.programme?.name}</span>}</Td>
                        <Td>{money(a.amount)}</Td>
                        <Td>{b ? money(b.committed) : "—"}</Td>
                        <Td>{b ? <>{money(b.utilised)} <span className="text-xs text-gray-500">({b.utilisationPct}%)</span></> : "—"}</Td>
                        <Td className={b && Number(b.remaining) < 0 ? "font-semibold text-red-700" : ""}>{b ? money(b.remaining) : "—"}</Td>
                        <Td>{b ? money(b.disbursed) : "—"}</Td>
                        <Td className="whitespace-nowrap text-right">
                          {canWrite ? (
                            <>
                              <Dialog trigger="Edit" title="Edit allocation" triggerSize="sm">
                                <ActionForm action={allocationAction} className="space-y-3">
                                  <input type="hidden" name="planId" value={id} />
                                  <input type="hidden" name="id" value={a.id} />
                                  <input type="hidden" name="target" value={a.projectId ? `project:${a.projectId}` : `programme:${a.programmeId}`} />
                                  <TextField label="Amount" name="amount" defaultValue={a.amount} inputMode="decimal" required />
                                  <TextAreaField label="Notes" name="notes" defaultValue={a.notes ?? ""} rows={2} />
                                  <SubmitButton size="sm">Save</SubmitButton>
                                </ActionForm>
                              </Dialog>{" "}
                              {plan.status === "DRAFT" || plan.status === "SUBMITTED" ? <ActionButton action={deleteAllocationAction} fields={{ planId: id, id: a.id }} confirm="Remove this allocation?" variant="ghost">Remove</ActionButton> : null}
                            </>
                          ) : null}
                        </Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Expenditure" description="Committed and incurred spending against project allocations" actions={canWrite && allocatedProjects.length ? <Dialog trigger="Record expenditure" title="Record expenditure" triggerSize="sm"><ExpenditureForm planId={id} projects={allocatedProjects} documents={docOpts} /></Dialog> : null} />
          <CardBody className="p-0">
            {plan.expenditures.length === 0 ? <p className="px-5 py-4 text-sm text-gray-600">No expenditure recorded.</p> : (
              <ul className="divide-y divide-gray-100">
                {plan.expenditures.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-start justify-between gap-2 px-5 py-3 text-sm">
                    <div>
                      <p className="font-medium">{e.description}</p>
                      <p className="text-xs text-gray-500">{e.project.title} · {formatDate(e.date)}{e.payee ? ` · ${e.payee}` : ""}{e.paymentReference ? ` · ref ${e.paymentReference}` : ""}{e.document ? ` · ${e.document.title}` : ""}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{money(e.amount)}</span>
                      <StatusBadge status={e.status} />
                      {canWrite ? <Dialog trigger="Edit" title="Edit expenditure" triggerSize="sm"><ExpenditureForm planId={id} projects={allocatedProjects} documents={docOpts} e={e} /></Dialog> : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader
            title="Disbursements to partners"
            actions={
              canWrite && allocatedProjects.length ? (
                <Dialog trigger="Record disbursement" title="Record disbursement" triggerSize="sm">
                  <ActionForm action={disbursementAction} className="space-y-3" resetOnSuccess>
                    <input type="hidden" name="planId" value={id} />
                    <SelectField label="Project" name="projectId" required placeholder="Choose…" options={allocatedProjects} />
                    <SelectField label="Partner" name="partnerId" placeholder="None" options={partners.map((p) => ({ value: p.id, label: p.name }))} />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <TextField label="Amount" name="amount" inputMode="decimal" required />
                      <SelectField label="Status" name="status" defaultValue="SCHEDULED" options={[{ value: "SCHEDULED", label: "Scheduled" }, { value: "DISBURSED", label: "Disbursed" }, { value: "CANCELLED", label: "Cancelled" }]} />
                      <TextField label="Date" name="date" type="date" defaultValue={toDateInput(new Date())} required />
                      <TextField label="Payment reference" name="paymentReference" />
                    </div>
                    <SelectField label="Supporting document" name="documentId" placeholder="None" options={docOpts} />
                    <TextAreaField label="Notes" name="notes" rows={2} />
                    <SubmitButton size="sm">Save disbursement</SubmitButton>
                  </ActionForm>
                </Dialog>
              ) : null
            }
          />
          <CardBody className="p-0">
            {plan.disbursements.length === 0 ? <p className="px-5 py-4 text-sm text-gray-600">No disbursements recorded.</p> : (
              <ul className="divide-y divide-gray-100">
                {plan.disbursements.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-start justify-between gap-2 px-5 py-3 text-sm">
                    <div>
                      <p className="font-medium">{d.partner?.name ?? "No partner"}</p>
                      <p className="text-xs text-gray-500">{d.project.title} · {formatDate(d.date)}{d.paymentReference ? ` · ref ${d.paymentReference}` : ""}</p>
                    </div>
                    <span className="flex items-center gap-2"><span className="font-semibold">{money(d.amount)}</span><StatusBadge status={d.status} /></span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Financial audit history" />
        <CardBody>
          {history.length === 0 ? <p className="text-sm text-gray-600">No changes recorded.</p> : (
            <ol className="space-y-2">
              {history.map((h) => (
                <li key={h.id} className="text-sm"><span>{h.summary}</span> <span className="text-xs text-gray-500">— {h.actor?.name ?? "System"}, {formatDateTime(h.createdAt)}</span></li>
              ))}
            </ol>
          )}
        </CardBody>
      </Card>
      {plan.notes ? <p className="mt-4 text-sm text-gray-600">Notes: {plan.notes}</p> : null}
    </div>
  );
}
