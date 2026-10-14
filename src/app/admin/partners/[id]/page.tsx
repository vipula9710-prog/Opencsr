import Link from "next/link";
import { Pencil, Plus, ShieldCheck } from "lucide-react";
import { requireOrgContext } from "@/server/auth/session";
import { load } from "@/server/page";
import { getPartner, partnerActivity, VERIFICATION_HELP, VERIFICATION_STATUSES } from "@/server/services/partners";
import { listDueDiligenceFields } from "@/server/services/organisations";
import { projectOptions } from "@/server/services/projects";
import { documentOptions } from "@/server/services/documents";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader, DefinitionList } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { ActionButton } from "@/components/ui/confirm-button";
import { ActionForm, CheckboxField, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/ui/form";
import { Dialog } from "@/components/ui/dialog";
import { formatMoney } from "@/lib/money";
import { formatDate, formatDateTime, humanize, toDateInput } from "@/lib/utils";
import { archivePartnerAction, deleteContactAction, saveAgreementAction, saveContactAction, verificationAction } from "../actions";

type Contact = { id: string; name: string; designation: string | null; email: string | null; phone: string | null; isPrimary: boolean };

function ContactForm({ partnerId, c }: { partnerId: string; c?: Contact }) {
  return (
    <ActionForm action={saveContactAction} className="space-y-3" resetOnSuccess={!c}>
      <input type="hidden" name="partnerId" value={partnerId} />
      {c ? <input type="hidden" name="id" value={c.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Name" name="name" defaultValue={c?.name} required />
        <TextField label="Designation" name="designation" defaultValue={c?.designation ?? ""} />
        <TextField label="Email" name="email" type="email" defaultValue={c?.email ?? ""} />
        <TextField label="Phone" name="phone" defaultValue={c?.phone ?? ""} />
      </div>
      <CheckboxField label="Primary contact" name="isPrimary" defaultChecked={c?.isPrimary} />
      <SubmitButton size="sm">{c ? "Save contact" : "Add contact"}</SubmitButton>
    </ActionForm>
  );
}

export default async function PartnerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const ctx = await requireOrgContext("partner.read");
  const { id } = await params;
  const sp = await searchParams;
  const partner = await load(getPartner(ctx, id));
  const canWrite = ctx.permissions.has("partner.write");
  const [activity, fields, projects, documents] = await Promise.all([
    partnerActivity(ctx, id),
    listDueDiligenceFields(ctx),
    canWrite ? projectOptions(ctx) : Promise.resolve([]),
    canWrite ? documentOptions(ctx) : Promise.resolve([]),
  ]);
  const money = (v: string) => formatMoney(v, ctx.organisation.currency, ctx.organisation.locale);
  const verifyStatuses = ctx.permissions.has("partner.verify") ? VERIFICATION_STATUSES : VERIFICATION_STATUSES.filter((s) => !["VERIFIED", "REJECTED", "EXPIRED"].includes(s));

  return (
    <div>
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-3">{partner.name} <StatusBadge status={partner.verificationStatus} /></span>}
        description={`${humanize(partner.type)}${partner.city ? ` · ${partner.city}` : ""}${partner.archivedAt ? " · Archived" : ""}`}
        breadcrumbs={[{ label: "NGO & Partners", href: "/admin/partners" }, { label: partner.name }]}
        actions={
          canWrite ? (
            <>
              <LinkButton href={`/admin/partners/${id}/edit`} variant="outline"><Pencil className="h-4 w-4" /> Edit</LinkButton>
              <ActionButton action={archivePartnerAction} fields={{ id, archived: partner.archivedAt ? "0" : "1" }} size="md" confirm={partner.archivedAt ? undefined : "Archive this partner?"}>{partner.archivedAt ? "Restore" : "Archive"}</ActionButton>
            </>
          ) : null
        }
      />
      {sp.saved ? <p role="status" className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">Partner saved.</p> : null}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Profile" />
            <CardBody>
              <DefinitionList
                items={[
                  { label: "Type", value: humanize(partner.type) },
                  { label: "Website", value: partner.website ? <a href={partner.website} target="_blank" rel="noopener noreferrer" className="text-brand-700 hover:underline">{partner.website}</a> : null },
                  { label: "Email", value: partner.canSeeConfidential ? partner.email : "Restricted" },
                  { label: "Phone", value: partner.canSeeConfidential ? partner.phone : "Restricted" },
                  { label: "Address", value: [partner.address, partner.city, partner.state, partner.country].filter(Boolean).join(", ") || null },
                  { label: "Registration number", value: partner.registrationNumber },
                ]}
              />
            </CardBody>
          </Card>
          {partner.canSeeConfidential ? (
            <Card>
              <CardHeader title="Due-diligence information" description="Supplied information — see the verification panel for review status." />
              <CardBody className="space-y-3">
                {partner.registrationDetails ? <p className="whitespace-pre-line text-sm">{partner.registrationDetails}</p> : null}
                {fields.length ? (
                  <DefinitionList items={fields.map((f) => ({ label: f.label, value: partner.dueDiligence[f.key] ?? <span className="text-gray-400">Not provided</span> }))} />
                ) : (
                  <p className="text-sm text-gray-600">No custom due-diligence fields configured.</p>
                )}
                {partner.notes ? <div><h3 className="text-sm font-medium">Internal notes</h3><p className="whitespace-pre-line text-sm text-gray-700">{partner.notes}</p></div> : null}
              </CardBody>
            </Card>
          ) : null}
          {partner.canSeeConfidential ? (
            <Card>
              <CardHeader title="Contact persons" actions={canWrite ? <Dialog trigger={<><Plus className="h-4 w-4" /> Add</>} title="Add contact" triggerSize="sm"><ContactForm partnerId={id} /></Dialog> : null} />
              <CardBody>
                {partner.contacts.length === 0 ? <p className="text-sm text-gray-600">No contacts recorded.</p> : (
                  <ul className="divide-y divide-gray-100">
                    {partner.contacts.map((c) => (
                      <li key={c.id} className="flex flex-wrap items-start justify-between gap-2 py-2 text-sm">
                        <div>
                          <p className="font-medium">{c.name} {c.isPrimary ? <span className="text-xs text-brand-700">(primary)</span> : null}</p>
                          <p className="text-gray-600">{[c.designation, c.email, c.phone].filter(Boolean).join(" · ")}</p>
                        </div>
                        {canWrite ? (
                          <div className="flex gap-2">
                            <Dialog trigger="Edit" title="Edit contact" triggerSize="sm"><ContactForm partnerId={id} c={c} /></Dialog>
                            <ActionButton action={deleteContactAction} fields={{ partnerId: id, id: c.id }} variant="ghost" confirm="Remove this contact?">Remove</ActionButton>
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          ) : null}
          <Card>
            <CardHeader
              title="Agreements"
              actions={
                canWrite ? (
                  <Dialog trigger={<><Plus className="h-4 w-4" /> Add</>} title="Add agreement" triggerSize="sm" wide>
                    <ActionForm action={saveAgreementAction} className="space-y-3" resetOnSuccess>
                      <input type="hidden" name="partnerId" value={id} />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <TextField label="Title" name="title" required />
                        <TextField label="Reference" name="reference" />
                        <SelectField label="Project" name="projectId" placeholder="None" options={projects.map((p) => ({ value: p.id, label: p.title }))} />
                        <SelectField label="Status" name="status" defaultValue="DRAFT" options={["DRAFT", "ACTIVE", "EXPIRED", "TERMINATED"].map((s) => ({ value: s, label: humanize(s) }))} />
                        <TextField label="Start date" name="startDate" type="date" />
                        <TextField label="End date" name="endDate" type="date" />
                        <TextField label={`Amount (${ctx.organisation.currency})`} name="amount" inputMode="decimal" />
                        <SelectField label="Signed document" name="documentId" placeholder="None" options={documents.map((d) => ({ value: d.id, label: d.title }))} />
                      </div>
                      <TextAreaField label="Notes" name="notes" rows={2} />
                      <SubmitButton size="sm">Save agreement</SubmitButton>
                    </ActionForm>
                  </Dialog>
                ) : null
              }
            />
            <CardBody>
              {partner.agreements.length === 0 ? <p className="text-sm text-gray-600">No agreements recorded.</p> : (
                <ul className="divide-y divide-gray-100">
                  {partner.agreements.map((a) => (
                    <li key={a.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
                      <div>
                        <p className="font-medium">{a.title} {a.reference ? <span className="text-gray-500">({a.reference})</span> : null}</p>
                        <p className="text-gray-600">{a.project?.title ?? "No project"} · {formatDate(a.startDate)} – {formatDate(a.endDate)}{a.amount ? ` · ${money(a.amount.toString())}` : ""}</p>
                      </div>
                      <StatusBadge status={a.status} />
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader title="Projects" />
              <CardBody>
                {partner.projects.length === 0 ? <p className="text-sm text-gray-600">Not linked to any projects.</p> : (
                  <ul className="space-y-1 text-sm">{partner.projects.map((p) => <li key={p.id} className="flex justify-between"><Link href={`/admin/projects/${p.id}`} className="hover:underline">{p.title}</Link><StatusBadge status={p.status} /></li>)}</ul>
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Follow-up tasks" actions={ctx.permissions.has("task.write") ? <LinkButton size="sm" variant="outline" href={`/admin/tasks/new?partnerId=${id}`}>New task</LinkButton> : null} />
              <CardBody>
                {partner.tasks.length === 0 ? <p className="text-sm text-gray-600">No open tasks.</p> : (
                  <ul className="space-y-1 text-sm">{partner.tasks.map((t) => <li key={t.id}><Link href={`/admin/tasks/${t.id}`} className="hover:underline">{t.title}</Link> <span className="text-xs text-gray-500">· {t.assignee?.name ?? "Unassigned"} · due {formatDate(t.dueDate)}</span></li>)}</ul>
                )}
              </CardBody>
            </Card>
          </div>
          {partner.disbursements.length ? (
            <Card>
              <CardHeader title="Disbursements" />
              <CardBody>
                <ul className="divide-y divide-gray-100 text-sm">
                  {partner.disbursements.map((d) => (
                    <li key={d.id} className="flex justify-between gap-2 py-2"><span>{formatDate(d.date)} · {d.project.title}{d.paymentReference ? ` · ref ${d.paymentReference}` : ""}</span><span className="flex items-center gap-2 font-medium">{money(d.amount.toString())}<StatusBadge status={d.status} /></span></li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Verification" actions={<ShieldCheck className="h-5 w-5 text-gray-400" />} />
            <CardBody className="space-y-3 text-sm">
              <StatusBadge status={partner.verificationStatus} />
              <p className="text-gray-700">{VERIFICATION_HELP[partner.verificationStatus]}</p>
              <dl className="space-y-1 text-xs text-gray-600">
                <div>Last reviewed: {formatDate(partner.lastReviewedAt)}{partner.verifiedBy ? ` by ${partner.verifiedBy.name}` : ""}</div>
                <div>Next review: {formatDate(partner.nextReviewDate)}</div>
              </dl>
              {partner.verificationNotes && partner.canSeeConfidential ? <p className="whitespace-pre-line rounded bg-gray-50 p-2 text-xs">{partner.verificationNotes}</p> : null}
              {canWrite ? (
                <ActionForm action={verificationAction} className="space-y-3 border-t border-gray-100 pt-3">
                  <input type="hidden" name="id" value={id} />
                  <SelectField label="Record status" name="status" defaultValue={partner.verificationStatus} options={verifyStatuses.map((s) => ({ value: s, label: humanize(s) }))} />
                  <TextAreaField label="Review notes" name="notes" rows={3} defaultValue={partner.canSeeConfidential ? partner.verificationNotes ?? "" : ""} />
                  <TextField label="Next review date" name="nextReviewDate" type="date" defaultValue={toDateInput(partner.nextReviewDate)} />
                  <SubmitButton size="sm">Save verification</SubmitButton>
                  {!ctx.permissions.has("partner.verify") ? <p className="text-xs text-gray-500">Only reviewers can record Verified, Rejected or Expired outcomes.</p> : null}
                </ActionForm>
              ) : null}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Documents" actions={ctx.permissions.has("document.write") ? <LinkButton size="sm" variant="outline" href={`/admin/documents/new?partnerId=${id}&category=DUE_DILIGENCE`}>Upload</LinkButton> : null} />
            <CardBody>
              {partner.documents.length === 0 ? <p className="text-sm text-gray-600">No documents uploaded.</p> : (
                <ul className="space-y-2 text-sm">{partner.documents.map((d) => <li key={d.id} className="flex justify-between gap-2"><Link href={`/admin/documents/${d.id}`} className="hover:underline">{d.title}</Link><StatusBadge status={d.status} /></li>)}</ul>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Activity history" />
            <CardBody>
              <ol className="space-y-2">
                {activity.slice(0, 25).map((a) => (
                  <li key={a.id} className="text-xs"><p className="text-sm text-gray-800">{a.summary}</p><p className="text-gray-500">{a.actor?.name ?? "System"} · {formatDateTime(a.createdAt)}</p></li>
                ))}
              </ol>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
