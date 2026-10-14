import { ActionForm, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/ui/form";
import { humanize } from "@/lib/utils";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/server/services/tasks";
import { saveTaskAction } from "./actions";

type Opt = { id: string; name: string };
type Task = { id: string; title: string; description: string | null; status: string; priority: string; dueDate: Date | null; reminderAt: Date | null; assigneeId: string | null; projectId: string | null; milestoneId: string | null; partnerId: string | null; dependsOnIds: string[] };

const dt = (d: Date | null | undefined) => (d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");

export function TaskForm({ task, users, projects, partners, milestones, tasks, defaults }: { task?: Task; users: Opt[]; projects: Opt[]; partners: Opt[]; milestones: Opt[]; tasks: Opt[]; defaults?: { projectId?: string; partnerId?: string } }) {
  return (
    <ActionForm action={saveTaskAction} className="space-y-4">
      {task ? <input type="hidden" name="id" value={task.id} /> : null}
      <TextField label="Title" name="title" defaultValue={task?.title} required />
      <TextAreaField label="Description" name="description" defaultValue={task?.description ?? ""} rows={3} />
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField label="Status" name="status" defaultValue={task?.status ?? "TODO"} options={TASK_STATUSES.map((s) => ({ value: s, label: humanize(s) }))} />
        <SelectField label="Priority" name="priority" defaultValue={task?.priority ?? "MEDIUM"} options={TASK_PRIORITIES.map((s) => ({ value: s, label: humanize(s) }))} />
        <SelectField label="Assignee" name="assigneeId" defaultValue={task?.assigneeId ?? ""} placeholder="Unassigned" options={users.map((u) => ({ value: u.id, label: u.name }))} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Due date" name="dueDate" type="date" defaultValue={task?.dueDate ? task.dueDate.toISOString().slice(0, 10) : ""} />
        <TextField label="Reminder" name="reminderAt" type="datetime-local" defaultValue={dt(task?.reminderAt)} hint="An in-app notification is sent to the assignee at this time." />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField label="Project" name="projectId" defaultValue={task?.projectId ?? defaults?.projectId ?? ""} placeholder="None" options={projects.map((p) => ({ value: p.id, label: p.name }))} />
        <SelectField label="Milestone" name="milestoneId" defaultValue={task?.milestoneId ?? ""} placeholder="None" options={milestones.map((p) => ({ value: p.id, label: p.name }))} />
        <SelectField label="Partner" name="partnerId" defaultValue={task?.partnerId ?? defaults?.partnerId ?? ""} placeholder="None" options={partners.map((p) => ({ value: p.id, label: p.name }))} />
      </div>
      {tasks.length ? (
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-gray-800">Depends on</legend>
          <div className="grid max-h-36 gap-1 overflow-y-auto rounded-lg border border-gray-200 p-3 sm:grid-cols-2">
            {tasks.map((t) => (
              <label key={t.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="dependsOnIds[]" value={t.id} defaultChecked={task?.dependsOnIds.includes(t.id)} className="h-4 w-4 rounded border-gray-300" />
                <span className="truncate">{t.name}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      <SubmitButton>{task ? "Save task" : "Create task"}</SubmitButton>
    </ActionForm>
  );
}
