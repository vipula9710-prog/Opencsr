import Link from "next/link";
import { requireOrgContext } from "@/server/auth/session";
import { load } from "@/server/page";
import { getTask } from "@/server/services/tasks";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader, DefinitionList } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { ActionButton } from "@/components/ui/confirm-button";
import { ActionForm, SubmitButton, TextAreaField } from "@/components/ui/form";
import { Dialog } from "@/components/ui/dialog";
import { formatDate, formatDateTime } from "@/lib/utils";
import { TaskForm } from "../form";
import { taskFormOptions } from "../options";
import { commentAction, deleteTaskAction, taskStatusAction } from "../actions";

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrgContext("task.read");
  const { id } = await params;
  const task = await load(getTask(ctx, id));
  const canWrite = ctx.permissions.has("task.write");
  const opts = canWrite ? await taskFormOptions(ctx, id) : null;
  return (
    <div>
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-3">{task.title} <StatusBadge status={task.status} /></span>}
        breadcrumbs={[{ label: "Tasks", href: "/admin/tasks" }, { label: task.title }]}
        actions={
          canWrite ? (
            <>
              {task.status !== "DONE" ? <ActionButton action={taskStatusAction} fields={{ id, status: "DONE" }} variant="primary" size="md">Mark complete</ActionButton> : <ActionButton action={taskStatusAction} fields={{ id, status: "TODO" }} size="md">Reopen</ActionButton>}
              {opts ? <Dialog trigger="Edit" title="Edit task" wide><TaskForm task={{ ...task, dependsOnIds: task.dependsOn.map((d) => d.dependsOnId) }} {...opts} /></Dialog> : null}
              <ActionButton action={deleteTaskAction} fields={{ id }} size="md" variant="ghost" confirm="Delete this task?" redirectTo="/admin/tasks">Delete</ActionButton>
            </>
          ) : null
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Details" />
            <CardBody className="space-y-4">
              {task.description ? <p className="whitespace-pre-line text-sm">{task.description}</p> : null}
              <DefinitionList
                items={[
                  { label: "Assignee", value: task.assignee?.name },
                  { label: "Priority", value: <StatusBadge status={task.priority} /> },
                  { label: "Due", value: formatDate(task.dueDate) },
                  { label: "Reminder", value: task.reminderAt ? formatDateTime(task.reminderAt) : null },
                  { label: "Project", value: task.project ? <Link href={`/admin/projects/${task.project.id}`} className="text-brand-700 hover:underline">{task.project.title}</Link> : null },
                  { label: "Milestone", value: task.milestone?.title },
                  { label: "Partner", value: task.partner ? <Link href={`/admin/partners/${task.partner.id}`} className="text-brand-700 hover:underline">{task.partner.name}</Link> : null },
                  { label: "Created by", value: task.createdBy?.name },
                  { label: "Completed", value: task.completedAt ? formatDateTime(task.completedAt) : null },
                ]}
              />
              {task.dependsOn.length ? (
                <div>
                  <h3 className="text-sm font-medium">Depends on</h3>
                  <ul className="mt-1 space-y-1 text-sm">{task.dependsOn.map((d) => <li key={d.dependsOnId} className="flex items-center gap-2"><Link href={`/admin/tasks/${d.dependsOn.id}`} className="hover:underline">{d.dependsOn.title}</Link><StatusBadge status={d.dependsOn.status} /></li>)}</ul>
                </div>
              ) : null}
              {task.dependents.length ? (
                <div>
                  <h3 className="text-sm font-medium">Blocks</h3>
                  <ul className="mt-1 space-y-1 text-sm">{task.dependents.map((d) => <li key={d.task.id}><Link href={`/admin/tasks/${d.task.id}`} className="hover:underline">{d.task.title}</Link></li>)}</ul>
                </div>
              ) : null}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={`Comments (${task.comments.length})`} />
            <CardBody className="space-y-4">
              <ul className="space-y-3">
                {task.comments.map((c) => (
                  <li key={c.id} className="rounded-lg bg-gray-50 p-3 text-sm"><p className="whitespace-pre-line">{c.body}</p><p className="mt-1 text-xs text-gray-500">{c.author?.name ?? "Former member"} · {formatDateTime(c.createdAt)}</p></li>
                ))}
              </ul>
              <ActionForm action={commentAction} resetOnSuccess className="space-y-2">
                <input type="hidden" name="taskId" value={id} />
                <TextAreaField label="Add a comment" name="body" rows={2} />
                <SubmitButton size="sm">Post comment</SubmitButton>
              </ActionForm>
            </CardBody>
          </Card>
        </div>
        <Card>
          <CardHeader title="Activity" />
          <CardBody>
            <ol className="space-y-2">
              {task.history.map((h) => <li key={h.id} className="text-xs"><p className="text-sm text-gray-800">{h.summary}</p><p className="text-gray-500">{h.actor?.name ?? "System"} · {formatDateTime(h.createdAt)}</p></li>)}
            </ol>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
