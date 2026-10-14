import Link from "next/link";
import { Plus } from "lucide-react";
import { requireOrgContext } from "@/server/auth/session";
import { listTasks, TASK_PRIORITIES, TASK_STATUSES } from "@/server/services/tasks";
import { upcomingMilestones } from "@/server/services/tasks";
import { parseListQuery } from "@/server/services/common";
import { PageHeader } from "@/components/ui/page-header";
import { LinkButton } from "@/components/ui/button";
import { FilterBar, FilterSelect } from "@/components/ui/filters";
import { SortTh, Table, Td, Th, Tr } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { formatDate, humanize } from "@/lib/utils";
import type { SearchParams } from "@/server/page";

export const metadata = { title: "Tasks & Milestones" };

export default async function TasksPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await requireOrgContext("task.read");
  const q = parseListQuery(await searchParams);
  const [result, milestones] = await Promise.all([listTasks(ctx, q), upcomingMilestones(ctx, 90)]);
  const params = { q: q.q, status: q.status, priority: q.priority, mine: q.mine, sort: q.sort, dir: q.dir };
  const today = new Date();
  return (
    <div>
      <PageHeader title="Tasks & Milestones" breadcrumbs={[{ label: "Dashboard", href: "/admin" }, { label: "Tasks" }]} actions={ctx.permissions.has("task.write") ? <LinkButton href="/admin/tasks/new"><Plus className="h-4 w-4" /> New task</LinkButton> : null} />
      <FilterBar q={q.q} placeholder="Search tasks">
        <FilterSelect name="status" label="Status" value={q.status} options={[{ value: "open", label: "Open (default)" }, ...TASK_STATUSES.map((s) => ({ value: s, label: humanize(s) }))]} />
        <FilterSelect name="priority" label="Priority" value={q.priority} options={TASK_PRIORITIES.map((s) => ({ value: s, label: humanize(s) }))} />
        <FilterSelect name="mine" label="Assignee" value={q.mine} options={[{ value: "1", label: "Assigned to me" }]} />
      </FilterBar>
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          {result.total === 0 ? (
            <EmptyState title="No tasks found" action={ctx.permissions.has("task.write") ? <LinkButton href="/admin/tasks/new">Create task</LinkButton> : undefined} />
          ) : (
            <>
              <Table caption="Tasks">
                <thead><tr><SortTh label="Task" field="title" params={params} basePath="/admin/tasks" /><Th>Assignee</Th><SortTh label="Due" field="dueDate" params={params} basePath="/admin/tasks" /><SortTh label="Priority" field="priority" params={params} basePath="/admin/tasks" /><SortTh label="Status" field="status" params={params} basePath="/admin/tasks" /></tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {result.items.map((t) => {
                    const overdue = t.dueDate && t.dueDate < today && !["DONE", "CANCELLED"].includes(t.status);
                    return (
                      <Tr key={t.id}>
                        <Td><Link href={`/admin/tasks/${t.id}`} className="font-medium hover:underline">{t.title}</Link><p className="text-xs text-gray-500">{t.project?.title ?? ""}{t.milestone ? ` · ${t.milestone.title}` : ""}</p></Td>
                        <Td>{t.assignee?.name ?? "—"}</Td>
                        <Td className={overdue ? "font-semibold text-red-700" : ""}>{overdue ? "Overdue · " : ""}{formatDate(t.dueDate)}</Td>
                        <Td><StatusBadge status={t.priority} /></Td>
                        <Td><StatusBadge status={t.status} /></Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
              <Pagination {...result} params={params} basePath="/admin/tasks" />
            </>
          )}
        </div>
        <Card>
          <CardHeader title="Milestones due (90 days)" />
          <CardBody>
            {milestones.length === 0 ? <p className="text-sm text-gray-600">None.</p> : (
              <ul className="divide-y divide-gray-100">
                {milestones.map((m) => (
                  <li key={m.id} className="py-2 text-sm">
                    <Link href={`/admin/projects/${m.project.id}?tab=milestones`} className="font-medium hover:underline">{m.title}</Link>
                    <p className="text-xs text-gray-500">{m.project.title} · {formatDate(m.dueDate)}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
