"use server";

import { redirect } from "next/navigation";
import { act, str } from "@/server/page";
import type { ActionState } from "@/server/action";
import { formDataToObject } from "@/lib/zod-helpers";
import { archiveProject, attachProjectMedia, changeProjectStatus, createProject, detachProjectMedia, restoreProject, updateProject, PROJECT_STATUSES } from "@/server/services/projects";
import { deleteMilestone, saveMilestone, addComment } from "@/server/services/tasks";
import { ValidationError } from "@/server/errors";

export async function createProjectAction(_: ActionState, fd: FormData): Promise<ActionState> {
  let id = "";
  const res = await act(async (ctx) => {
    id = (await createProject(ctx, formDataToObject(fd))).id;
  });
  if (res.ok) redirect(`/admin/projects/${id}`);
  return res;
}

export async function updateProjectAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = str(fd, "id");
  const data = formDataToObject(fd);
  if (!fd.has("memberIds[]")) data.memberIds = [];
  const res = await act((ctx) => updateProject(ctx, id, data));
  if (res.ok) redirect(`/admin/projects/${id}?saved=1`);
  return res;
}

export async function changeStatusAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const status = str(fd, "status") as (typeof PROJECT_STATUSES)[number];
  return act(async (ctx) => {
    if (!PROJECT_STATUSES.includes(status)) throw new ValidationError("Invalid status");
    const r = await changeProjectStatus(ctx, str(fd, "id"), status, str(fd, "note") || null);
    if (r.pending) return { pending: true };
  }, "Status updated (or sent for approval if your organisation requires it)");
}

export async function archiveProjectAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return act((ctx) => archiveProject(ctx, str(fd, "id")), "Project archived");
}

export async function restoreProjectAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return act((ctx) => restoreProject(ctx, str(fd, "id")), "Project restored");
}

export async function saveMilestoneAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return act((ctx) => saveMilestone(ctx, str(fd, "projectId"), str(fd, "id") || null, formDataToObject(fd)), "Milestone saved");
}

export async function deleteMilestoneAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return act((ctx) => deleteMilestone(ctx, str(fd, "projectId"), str(fd, "id")), "Milestone deleted");
}

export async function attachMediaAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return act((ctx) => {
    if (!str(fd, "mediaAssetId")) throw new ValidationError("Choose an image");
    return attachProjectMedia(ctx, str(fd, "projectId"), str(fd, "mediaAssetId"), { caption: str(fd, "caption"), isPublic: fd.get("isPublic") === "on" });
  }, "Image attached");
}

export async function detachMediaAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return act((ctx) => detachProjectMedia(ctx, str(fd, "projectId"), str(fd, "id")), "Image removed");
}

export async function addProjectCommentAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return act((ctx) => addComment(ctx, "Project", str(fd, "projectId"), str(fd, "body")), "Note added");
}
