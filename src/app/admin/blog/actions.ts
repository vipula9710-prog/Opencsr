"use server";

import { redirect } from "next/navigation";
import { act, str } from "@/server/page";
import type { ActionState } from "@/server/action";
import { formDataToObject } from "@/lib/zod-helpers";
import { changePostStatus, deleteCategory, deletePost, deleteTag, saveAuthorProfile, saveCategory, savePost, saveTag } from "@/server/services/blog";

export async function savePostAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = str(fd, "id") || null;
  let newId = "";
  const data = formDataToObject(fd);
  if (!fd.has("categoryIds[]")) data.categoryIds = [];
  const res = await act(async (ctx) => {
    newId = (await savePost(ctx, id, data)).id;
  }, "Post saved");
  if (res.ok && !id) redirect(`/admin/blog/${newId}/edit?created=1`);
  return res;
}

export async function postStatusAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const scheduled = str(fd, "scheduledFor");
  const tz = Number(str(fd, "tzOffset") || "0");
  // datetime-local has no zone: convert using the browser's offset (minutes).
  const scheduledFor = scheduled ? new Date(new Date(`${scheduled}:00Z`).getTime() + tz * 60000).toISOString() : "";
  return act((ctx) => changePostStatus(ctx, str(fd, "id"), { action: str(fd, "action"), scheduledFor }), "Post updated");
}

export async function deletePostAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return act((ctx) => deletePost(ctx, str(fd, "id")), "Post deleted");
}

export async function saveCategoryAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return act((ctx) => saveCategory(ctx, str(fd, "id") || null, formDataToObject(fd)), "Category saved");
}
export async function deleteCategoryAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return act((ctx) => deleteCategory(ctx, str(fd, "id")), "Category deleted");
}
export async function saveTagAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return act((ctx) => saveTag(ctx, str(fd, "id") || null, formDataToObject(fd)), "Tag saved");
}
export async function deleteTagAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return act((ctx) => deleteTag(ctx, str(fd, "id")), "Tag deleted");
}
export async function saveAuthorAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return act((ctx) => saveAuthorProfile(ctx, str(fd, "userId"), formDataToObject(fd)), "Author profile saved");
}
