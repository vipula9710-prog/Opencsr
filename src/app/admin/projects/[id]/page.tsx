import Link from "next/link";
import { Archive, ExternalLink, Pencil, Plus, RotateCcw } from "lucide-react";
import { requireOrgContext } from "@/server/auth/session";
import { load } from "@/server/page";
import { getProject, projectHistory, PROJECT_STATUSES } from "@/server/services/projects";
import { prisma } from "@/server/db";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader, DefinitionList } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { ActionButton } from "@/components/ui/confirm-button";
import { ActionForm, CheckboxField, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/ui/form";
import { Dialog } from "@/components/ui/dialog";
import { MediaField } from "@/components/admin/media-picker";
import { ProgressBar } from "@/components/admin/charts";
import { formatMoney } from "@/lib/money";
import { cn, formatDate, formatDateTime, humanize, toDateInput } from "@/lib/utils";
import {
  addProjectCommentAction, archiveProjectAction, attachMediaAction, changeStatusAction, deleteMilestoneAction, detachMediaAction, restoreProjectAction, saveMilestoneAction,
} from "../actions";

const TABS = ["overview", "milestones", "tasks", "evidence", "impact", "history"] as const;

type Milestone = { id: string; title: string; description: string | null; dueDate: Date | null; status: string; sortOrder: number };

function MilestoneForm({ projectId, m }: { projectId: string; m?: Milestone }) {
  return (
    <ActionForm action={saveMilestoneAction} className="space-y-3" resetOnSuccess={!m}>
      <input type="hidden" name="projectId" value={projectId} />
      {m ? <input type="hidden" name="id" value={m.id} /> : null}
      <TextField label="Title" name="title" defaultValue={m?.title} required />
      <TextAreaField label="Description" name="description" defaultValue={m?.description ?? ""} rows={2} />
      <div className="grid gap-3 sm:grid-cols-3">
        <TextField label="Due date" name="dueDate" type="date" defaultValue={toDateInput(m?.dueDate)} />
        <SelectField label="Status" name="status" defaultValue={m?.status ?? "PENDING"} options={["PENDING", "IN_PROGRESS", "COMPLETED", "MISSED"].map((s) => ({ value: s, label: humanize(s) }))} />
        <TextField label="Order" name="sortOrder" type="number" defaultValue={m?.sortOrder ?? 0} />
      </div>
      <SubmitButton size="sm">{m ? "Save milestone" : "Add milestone"}</SubmitButton>
    </ActionForm>
  );
}

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; saved?: string }> }) {
  const ctx = await requireOrgContext("project.read");
  const { id } = await params;
  const sp = await searchParams;
  const tab = (TABS as readonly string[]).includes(sp.tab ?? "") ? sp.tab! : "overview";
  const project = await load(getProject(ctx, id));
  const canWrite = ctx.permissions.has("project.write");
  const money = (v: string) => formatMoney(v, ctx.organisation.currency, ctx.organisation.locale);
  const [history, comments] = await Promise.all([
    tab === "history" ? projectHistory(ctx, id) : Promise.resolve([]),
    tab === "overview" ? prisma.comment.findMany({ where: { organisationId: ctx.organisationId, entityType: "Project", entityId: id }, orderBy: { createdAt: "desc" }, take: 20, include: { author: { select: { name: true } } } }) : Promise.resolve([]),
  ]);

  return (
    <div>
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-3">{project.title} <StatusBadge status={project.status} /></span>}
        description={project.summary ?? undefined}
        breadcrumbs={[{ label: "Projects", href: "/admin/projects" }, ...(project.programme ? [{ label: project.programme.name, href: `/admin/programmes/${project.programme.id}` }] : []), { label: project.title }]}
        actions={
          <>
            {project.isPublic && project.status !== "DRAFT" && project.status !== "ARCHIVED" ? <LinkButton href={`/projects/${project.slug}`} target="_blank" variant="outline"><ExternalLink className="h-4 w-4" /> View public page</LinkButton> : null}
            {canWrite ? <LinkButton href={`/admin/projects/${id}/edit`} variant="outline"><Pencil className="h-4 w-4" /> Edit</LinkButton> : null}
            {ctx.permissions.has("project.archive") ? (
              project.status === "ARCHIVED" ? (
                <ActionButton action={restoreProjectAction} fields={{ id }} size="md"><RotateCcw className="h-4 w-4" /> Restore</ActionButton>
              ) : (
                <ActionButton action={archiveProjectAction} fields={{ id }} size="md" confirm="Archive this project? It will be hidden from lists and the website." variant="outline"><Archive className="h-4 w-4" /> Archive</ActionButton>
              )
            ) : null}
          </>
        }
      />
      {sp.saved ? <p role="status" className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">Project saved.</p> : null}

      <nav aria-label="Project sections" className="mb-6 flex gap-1 overflow-x-auto border-b border-gray-200">
        {TABS.map((t) => (
          <Link key={t} href={`/admin/projects/${id}?tab=${t}`} aria-current={tab === t ? "page" : undefined} className={cn("whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium", tab === t ? "border-brand-600 text-brand-800" : "border-transparent text-gray-600 hover:text-gray-900")}>
            {t === "evidence" ? "Documents & images" : humanize(t)}
          </Link>
        ))}
      </nav>

      {tab === "overview" ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader title="Details" />
              <CardBody>
                <DefinitionList
                  items={[
                    { label: "Programme", value: project.programme?.name },
                    { label: "Focus area", value: project.focusArea?.name },
                    { label: "Implementing partner", value: project.partner ? <Link className="text-brand-700 hover:underline" href={`/admin/partners/${project.partner.id}`}>{project.partner.name}</Link> : null },
                    { label: "Partner verification", value: project.partner ? <StatusBadge status={project.partner.verificationStatus} /> : null },
                    { label: "Owner", value: project.owner?.name },
                    { label: "Location", value: project.location },
                    { label: "Start", value: formatDate(project.startDate) },
                    { label: "End", value: formatDate(project.endDate) },
                    { label: "Team", value: project.members.map((m) => m.user.name).join(", ") || null },
                    { label: "Public website", value: project.isPublic ? "Published" : "Not published" },
                  ]}
                />
              </CardBody>
            </Card>
            {project.objectives ? (
              <Card><CardHeader title="Objectives" /><CardBody><p className="whitespace-pre-line text-sm text-gray-800">{project.objectives}</p></CardBody></Card>
            ) : null}
            {project.description ? (
              <Card><CardHeader title="Description" /><CardBody><div className="admin-rich text-sm" dangerouslySetInnerHTML={{ __html: project.description }} /></CardBody></Card>
            ) : null}
            {project.risks || project.dependencies || project.notes ? (
              <Card>
                <CardHeader title="Risks, dependencies & notes" description="Internal" />
                <CardBody className="space-y-3 text-sm">
                  {project.risks ? <div><h3 className="font-medium">Risks</h3><p className="whitespace-pre-line text-gray-700">{project.risks}</p></div> : null}
                  {project.dependencies ? <div><h3 className="font-medium">Dependencies</h3><p className="whitespace-pre-line text-gray-700">{project.dependencies}</p></div> : null}
                  {project.notes ? <div><h3 className="font-medium">Internal notes</h3><p className="whitespace-pre-line text-gray-700">{project.notes}</p></div> : null}
                </CardBody>
              </Card>
            ) : null}
            <Card>
              <CardHeader title="Team notes" />
              <CardBody className="space-y-4">
                {ctx.permissions.has("project.read") ? (
                  <ActionForm action={addProjectCommentAction} resetOnSuccess className="space-y-2">
                    <input type="hidden" name="projectId" value={id} />
                    <TextAreaField label="Add a note" name="body" rows={2} />
                    <SubmitButton size="sm">Post note</SubmitButton>
                  </ActionForm>
                ) : null}
                <ul className="space-y-3">
                  {comments.map((c) => (
                    <li key={c.id} className="rounded-lg bg-gray-50 p-3 text-sm">
                      <p className="whitespace-pre-line">{c.body}</p>
                      <p className="mt-1 text-xs text-gray-500">{c.author?.name ?? "Former member"} · {formatDateTime(c.createdAt)}</p>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          </div>
          <div className="space-y-6">
            {canWrite ? (
              <Card>
                <CardHeader title="Change status" />
                <CardBody>
                  <ActionForm action={changeStatusAction} className="space-y-3">
                    <input type="hidden" name="id" value={id} />
                    <SelectField label="New status" name="status" defaultValue={project.status} options={PROJECT_STATUSES.filter((s) => s !== "ARCHIVED").map((s) => ({ value: s, label: humanize(s) }))} />
                    <TextField label="Note (optional)" name="note" />
                    <SubmitButton size="sm">Update status</SubmitButton>
                  </ActionForm>
                </CardBody>
              </Card>
            ) : null}
            {project.finance ? (
              <Card>
                <CardHeader title="Finance" description="All budget plans" />
                <CardBody className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-600">Allocated</span><strong>{money(project.finance.allocated)}</strong></div>
                  <div className="flex justify-between"><span className="text-gray-600">Committed</span><strong>{money(project.finance.committed)}</strong></div>
                  <div className="flex justify-between"><span className="text-gray-600">Utilised</span><strong>{money(project.finance.incurred)}</strong></div>
                  <div className="flex justify-between"><span className="text-gray-600">Disbursed to partner</span><strong>{money(project.finance.disbursed)}</strong></div>
                  <Link href="/admin/budgets" className="inline-block pt-1 font-medium text-brand-700 hover:underline">Manage budgets</Link>
                </CardBody>
              </Card>
            ) : null}
            <Card>
              <CardHeader title="Status history" />
              <CardBody>
                <ol className="space-y-2 text-sm">
                  {project.statusChanges.map((s) => (
                    <li key={s.id}>
                      <span className="font-medium">{s.fromStatus ? `${humanize(s.fromStatus)} → ` : ""}{humanize(s.toStatus)}</span>
                      <span className="block text-xs text-gray-500">{s.changedBy?.name ?? "System"} · {formatDateTime(s.createdAt)}{s.note ? ` · ${s.note}` : ""}</span>
                    </li>
                  ))}
                </ol>
              </CardBody>
            </Card>
          </div>
        </div>
      ) : null}

      {tab === "milestones" ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader title={`Milestones (${project.milestones.length})`} />
            <CardBody>
              {project.milestones.length === 0 ? <p className="text-sm text-gray-600">No milestones yet.</p> : (
                <ul className="divide-y divide-gray-100">
                  {project.milestones.map((m) => (
                    <li key={m.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                      <div>
                        <p className="font-medium">{m.title}</p>
                        {m.description ? <p className="text-sm text-gray-600">{m.description}</p> : null}
                        <p className="text-xs text-gray-500">Due {formatDate(m.dueDate)}{m.completedAt ? ` · completed ${formatDate(m.completedAt)}` : ""}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={m.status} />
                        {canWrite ? (
                          <>
                            <Dialog trigger="Edit" title="Edit milestone" triggerSize="sm"><MilestoneForm projectId={id} m={m} /></Dialog>
                            <ActionButton action={deleteMilestoneAction} fields={{ id: m.id, projectId: id }} confirm="Delete this milestone?" variant="ghost">Delete</ActionButton>
                          </>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
          {canWrite ? <Card><CardHeader title="Add milestone" /><CardBody><MilestoneForm projectId={id} /></CardBody></Card> : null}
        </div>
      ) : null}

      {tab === "tasks" ? (
        <Card>
          <CardHeader title={`Tasks (${project.tasks.length})`} actions={ctx.permissions.has("task.write") ? <LinkButton size="sm" href={`/admin/tasks/new?projectId=${id}`}><Plus className="h-4 w-4" /> New task</LinkButton> : null} />
          <CardBody>
            {project.tasks.length === 0 ? <p className="text-sm text-gray-600">No tasks yet.</p> : (
              <ul className="divide-y divide-gray-100">
                {project.tasks.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <Link href={`/admin/tasks/${t.id}`} className="font-medium hover:underline">{t.title}</Link>
                    <span className="flex items-center gap-2 text-xs text-gray-500">{t.assignee?.name ?? "Unassigned"} · due {formatDate(t.dueDate)} <StatusBadge status={t.status} /></span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      ) : null}

      {tab === "evidence" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Documents & evidence" actions={ctx.permissions.has("document.write") ? <LinkButton size="sm" href={`/admin/documents/new?projectId=${id}`}><Plus className="h-4 w-4" /> Upload</LinkButton> : null} />
            <CardBody>
              {project.documents.length === 0 ? <p className="text-sm text-gray-600">No documents attached.</p> : (
                <ul className="divide-y divide-gray-100">
                  {project.documents.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                      <Link href={`/admin/documents/${d.id}`} className="font-medium hover:underline">{d.title}</Link>
                      <span className="flex gap-2"><StatusBadge status={d.visibility} /><StatusBadge status={d.status} /></span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Project images" description="Images marked public appear in the project's public gallery." />
            <CardBody className="space-y-4">
              {project.media.length ? (
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {project.media.map((m) => (
                    <li key={m.id} className="rounded-lg border border-gray-200 p-2 text-xs">
                      {m.mediaAsset.mimeType.startsWith("image/") ? (
                        <img src={m.mediaAsset.visibility === "PUBLIC" ? `/media/${m.mediaAsset.id}/${encodeURIComponent(m.mediaAsset.filename)}` : `/api/files/${m.mediaAsset.id}`} alt={m.mediaAsset.altText ?? ""} className="aspect-video w-full rounded object-cover" />
                      ) : null}
                      <p className="mt-1 truncate">{m.caption ?? m.mediaAsset.filename}</p>
                      <p className="text-gray-500">{m.isPublic ? "Public" : "Internal"}</p>
                      {canWrite ? <ActionButton action={detachMediaAction} fields={{ id: m.id, projectId: id }} variant="ghost">Remove</ActionButton> : null}
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-gray-600">No images attached.</p>}
              {canWrite ? (
                <ActionForm action={attachMediaAction} className="space-y-3 border-t border-gray-100 pt-4">
                  <input type="hidden" name="projectId" value={id} />
                  <MediaField name="mediaAssetId" label="Image" />
                  <TextField label="Caption" name="caption" />
                  <CheckboxField label="Show in the public project gallery" name="isPublic" />
                  <SubmitButton size="sm">Attach image</SubmitButton>
                </ActionForm>
              ) : null}
            </CardBody>
          </Card>
        </div>
      ) : null}

      {tab === "impact" ? (
        <Card>
          <CardHeader title="Impact indicators" actions={ctx.permissions.has("impact.write") ? <LinkButton size="sm" href={`/admin/impact/new?projectId=${id}`}><Plus className="h-4 w-4" /> Add indicator</LinkButton> : null} />
          <CardBody>
            {project.impactIndicators.length === 0 ? <p className="text-sm text-gray-600">No indicators yet.</p> : (
              <ul className="space-y-4">
                {project.impactIndicators.map((i) => {
                  const latest = i.measurements[0];
                  const target = i.target ? Number(i.target) : null;
                  const base = i.baseline ? Number(i.baseline) : 0;
                  const pct = latest && target !== null && target !== base ? Math.max(0, ((Number(latest.value) - base) / (target - base)) * 100) : null;
                  return (
                    <li key={i.id} className="text-sm">
                      <div className="mb-1 flex flex-wrap justify-between gap-2">
                        <Link href={`/admin/impact/${i.id}`} className="font-medium hover:underline">{i.name}</Link>
                        <span className="text-gray-600">Latest: {latest ? `${latest.value} ${i.unit}` : "no data"} · Target: {i.target?.toString() ?? "—"}</span>
                      </div>
                      <ProgressBar value={pct} label={`${i.name} progress`} />
                      {latest ? <p className="mt-1 text-xs text-gray-500">Latest value is {latest.verificationStatus === "VERIFIED" ? "verified" : "not verified"}</p> : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>
      ) : null}

      {tab === "history" ? (
        <Card>
          <CardHeader title="Project history" description="All recorded changes to this project" />
          <CardBody>
            <ol className="space-y-3">
              {history.map((h) => (
                <li key={h.id} className="text-sm">
                  <p>{h.summary}</p>
                  <p className="text-xs text-gray-500">{h.actor?.name ?? "System"} · {formatDateTime(h.createdAt)}</p>
                  {h.metadata && typeof h.metadata === "object" && Object.keys(h.metadata as object).length ? (
                    <details className="mt-1 text-xs text-gray-600"><summary className="cursor-pointer">Changed fields</summary><pre className="mt-1 overflow-x-auto rounded bg-gray-50 p-2">{JSON.stringify(h.metadata, null, 2)}</pre></details>
                  ) : null}
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
