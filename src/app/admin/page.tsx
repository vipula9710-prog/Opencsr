import Link from "next/link";
import { CalendarClock, ClipboardCheck, FolderKanban, Handshake, Layers, PiggyBank } from "lucide-react";
import { requireOrgContext } from "@/server/auth/session";
import { getDashboard } from "@/server/services/dashboard";
import { Card, CardBody, CardHeader, StatCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { ProjectStatusChart, ProgressBar } from "@/components/admin/charts";
import { formatMoney } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const ctx = await requireOrgContext();
  const d = await getDashboard(ctx);
  const { welcome } = await searchParams;
  const cur = ctx.organisation.currency;
  const money = (v: string) => formatMoney(v, cur, ctx.organisation.locale);
  const noProjects = d.projects && d.projects.total === 0;

  return (
    <div>
      <PageHeader title={`Welcome back, ${ctx.user.name.split(" ")[0]}`} description={`${ctx.organisation.name} — figures below are calculated from records stored in OpenCSR.`} />
      {welcome ? (
        <div role="status" className="mb-6 rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
          <p className="font-semibold">Your organisation is ready.</p>
          <p className="mt-1">Next steps: add focus areas and programmes, create your first project, invite colleagues, and customise your public website in the Website Builder.</p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {d.projects ? <StatCard label="Active projects" value={d.projects.active} hint={`${d.projects.total} projects in total (excluding archived)`} icon={<FolderKanban className="h-5 w-5" />} /> : null}
        {d.programmeCount !== null ? <StatCard label="Active programmes" value={d.programmeCount} icon={<Layers className="h-5 w-5" />} /> : null}
        {d.partnerCount !== null ? <StatCard label="Partner organisations" value={d.partnerCount} hint={d.partnersPending ? `${d.partnersPending} with due diligence in progress` : undefined} icon={<Handshake className="h-5 w-5" />} /> : null}
        <StatCard label="Pending reviews" value={d.pendingApprovals + d.reportsInReview} hint={`${d.pendingApprovals} approval requests · ${d.reportsInReview} reports in review`} icon={<ClipboardCheck className="h-5 w-5" />} />
      </div>

      {noProjects ? (
        <div className="mt-6">
          <EmptyState
            title="No projects yet"
            description="Start by creating your first CSR project, adding an implementation partner or publishing a blog post."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {ctx.permissions.has("project.write") ? <LinkButton href="/admin/projects/new">Create a project</LinkButton> : null}
                {ctx.permissions.has("partner.write") ? <LinkButton href="/admin/partners/new" variant="outline">Add a partner</LinkButton> : null}
                {ctx.permissions.has("blog.write") ? <LinkButton href="/admin/blog/new" variant="outline">Write a post</LinkButton> : null}
              </div>
            }
          />
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {d.projects && !noProjects ? (
          <Card className="lg:col-span-2">
            <CardHeader title="Project status distribution" actions={<Link href="/admin/projects" className="text-sm font-medium text-brand-700 hover:underline">All projects</Link>} />
            <CardBody>
              <ProjectStatusChart data={d.projects.byStatus} />
            </CardBody>
          </Card>
        ) : null}

        {ctx.permissions.has("finance.read") ? (
          <Card>
            <CardHeader title="Budget utilisation" description={d.finance ? d.finance.plan.title : "Current financial year"} actions={<PiggyBank className="h-5 w-5 text-gray-400" />} />
            <CardBody>
              {d.finance ? (
                <div className="space-y-3 text-sm">
                  <dl className="grid grid-cols-2 gap-3">
                    <div><dt className="text-gray-500">Total budget</dt><dd className="font-semibold">{money(d.finance.totals.total)}</dd></div>
                    <div><dt className="text-gray-500">Allocated</dt><dd className="font-semibold">{money(d.finance.totals.allocated)}</dd></div>
                    <div><dt className="text-gray-500">Committed</dt><dd className="font-semibold">{money(d.finance.totals.committed)}</dd></div>
                    <div><dt className="text-gray-500">Utilised</dt><dd className="font-semibold">{money(d.finance.totals.utilised)}</dd></div>
                  </dl>
                  <div>
                    <p className="mb-1 text-gray-600">Utilisation of allocated funds: <strong>{d.finance.totals.utilisationPct}%</strong></p>
                    <ProgressBar value={d.finance.totals.utilisationPct} label="Budget utilisation" />
                  </div>
                  <Link href={`/admin/budgets/${d.finance.plan.id}`} className="inline-block font-medium text-brand-700 hover:underline">Open budget plan</Link>
                </div>
              ) : (
                <div className="text-sm text-gray-600">
                  <p>No budget plan exists for the current financial year.</p>
                  {ctx.permissions.has("finance.write") ? <LinkButton href="/admin/budgets" size="sm" className="mt-3">Create budget plan</LinkButton> : null}
                </div>
              )}
            </CardBody>
          </Card>
        ) : null}

        <Card>
          <CardHeader title="Upcoming milestones" actions={<CalendarClock className="h-5 w-5 text-gray-400" />} />
          <CardBody>
            {d.milestones.length === 0 ? (
              <p className="text-sm text-gray-600">No milestones due in the next 45 days.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {d.milestones.map((m) => (
                  <li key={m.id} className="flex items-start justify-between gap-2 py-2 text-sm">
                    <div>
                      <Link href={`/admin/projects/${m.project.id}`} className="font-medium text-gray-900 hover:underline">{m.title}</Link>
                      <p className="text-xs text-gray-500">{m.project.title}</p>
                    </div>
                    <span className={m.dueDate && m.dueDate < new Date() ? "text-xs font-semibold text-red-700" : "text-xs text-gray-600"}>
                      {m.dueDate && m.dueDate < new Date() ? "Overdue · " : ""}
                      {formatDate(m.dueDate)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="My open tasks" actions={<Link href="/admin/tasks?mine=1" className="text-sm font-medium text-brand-700 hover:underline">View all</Link>} />
          <CardBody>
            {d.myTasks.length === 0 ? (
              <p className="text-sm text-gray-600">Nothing assigned to you.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {d.myTasks.map((t) => (
                  <li key={t.id} className="flex items-start justify-between gap-2 py-2 text-sm">
                    <div>
                      <Link href={`/admin/tasks/${t.id}`} className="font-medium text-gray-900 hover:underline">{t.title}</Link>
                      <p className="text-xs text-gray-500">{t.project?.title ?? "No project"} · due {formatDate(t.dueDate)}</p>
                    </div>
                    <StatusBadge status={t.priority} />
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        {d.indicators.length ? (
          <Card>
            <CardHeader title="Impact indicator progress" description="Latest recorded values against targets" actions={<Link href="/admin/impact" className="text-sm font-medium text-brand-700 hover:underline">Impact</Link>} />
            <CardBody className="space-y-4">
              {d.indicators.map((i) => (
                <div key={i.id} className="text-sm">
                  <div className="mb-1 flex justify-between gap-2">
                    <Link href={`/admin/impact/${i.id}`} className="font-medium hover:underline">{i.name}</Link>
                    <span className="text-gray-600">
                      {i.progress.latestValue ?? "—"} / {i.target} {i.unit}
                    </span>
                  </div>
                  <ProgressBar value={i.progress.progressPct} label={`${i.name} progress`} />
                  <p className="mt-1 text-xs text-gray-500">{i.progress.latestValue === null ? "No measurements yet" : i.progress.latestVerified ? "Latest value verified" : "Latest value not yet verified"}</p>
                </div>
              ))}
            </CardBody>
          </Card>
        ) : null}

        {d.activity.length ? (
          <Card className="lg:col-span-2">
            <CardHeader title="Recent activity" actions={<Link href="/admin/audit" className="text-sm font-medium text-brand-700 hover:underline">Audit log</Link>} />
            <CardBody>
              <ul className="divide-y divide-gray-100">
                {d.activity.map((a) => (
                  <li key={a.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
                    <span><span className="font-medium">{a.actor?.name ?? "System"}</span> — {a.summary}</span>
                    <time className="text-xs text-gray-500" dateTime={a.createdAt.toISOString()}>{formatDateTime(a.createdAt)}</time>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        ) : null}

        {ctx.permissions.has("blog.write") ? (
          <Card>
            <CardHeader title="Recent posts" actions={<Link href="/admin/blog" className="text-sm font-medium text-brand-700 hover:underline">Blog</Link>} />
            <CardBody>
              {d.posts.length === 0 ? (
                <p className="text-sm text-gray-600">No posts yet.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {d.posts.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                      <Link href={`/admin/blog/${p.id}/edit`} className="truncate font-medium hover:underline">{p.title}</Link>
                      <StatusBadge status={p.status} />
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        ) : null}

        {ctx.permissions.has("enquiry.read") ? (
          <Card>
            <CardHeader title="Recent enquiries" actions={<Link href="/admin/enquiries" className="text-sm font-medium text-brand-700 hover:underline">Enquiries</Link>} />
            <CardBody>
              {d.enquiries.length === 0 ? (
                <p className="text-sm text-gray-600">No enquiries received yet.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {d.enquiries.map((e) => (
                    <li key={e.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                      <Link href={`/admin/enquiries/${e.id}`} className="truncate hover:underline"><span className="font-medium">{e.name}</span> · {e.category}</Link>
                      <StatusBadge status={e.status} />
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
