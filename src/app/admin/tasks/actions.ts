"use server";

import { redirect } from "next/navigation";
import { act, str } from "@/server/page";
import type { ActionState } from "@/server/action";
import { formDataToObject } from "@/lib/zod-helpers";
import { addComment, deleteTask, saveTask, setTaskStatus, TASK_STATUSES } from "@/server/services/tasks";
import { ValidationError } from "@/server/errors";

export async function saveTaskAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = str(fd, "id") || null;
  let newId = "";
  const data = formDataToObject(fd);
  if (!fd.has("dependsOnIds[]")) data.dependsOnIds = [];
  const res = await act(async (ctx) => {
    newId = (await saveTask(ctx, id, data)).id;
  }, "Task saved");
  if (res.ok && !id) redirect(`/admin/tasks/${newId}`);
  return res;
}

export async function taskStatusAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const status = str(fd, "status") as (typeof TASK_STATUSES)[number];
  return act((ctx) => {
    if (!TASK_STATUSES.includes(status)) throw new ValidationError("Invalid status");
    return setTaskStatus(ctx, str(fd, "id"), status);
  }, "Status updated");
}

export async function deleteTaskAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return act((ctx) => deleteTask(ctx, str(fd, "id")), "Task deleted");
}

export async function commentAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return act((ctx) => addComment(ctx, "Task", str(fd, "taskId"), str(fd, "body")), "Comment added");
}
