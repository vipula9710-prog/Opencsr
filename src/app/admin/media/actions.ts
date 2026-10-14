"use server";

import { act, str } from "@/server/page";
import type { ActionState } from "@/server/action";
import { formDataToObject } from "@/lib/zod-helpers";
import { deleteMedia, replaceMediaFile, updateMediaMeta, uploadMedia } from "@/server/services/media";
import { ValidationError } from "@/server/errors";

export async function uploadMediaAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return act(async (ctx) => {
    const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    if (!files.length) throw new ValidationError("Choose at least one file");
    const visibility = str(fd, "visibility") === "PRIVATE" ? "PRIVATE" : "PUBLIC";
    for (const file of files.slice(0, 20)) {
      await uploadMedia(ctx, { filename: file.name, data: Buffer.from(await file.arrayBuffer()), visibility });
    }
  }, "Uploaded");
}

export async function updateMediaAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return act((ctx) => updateMediaMeta(ctx, str(fd, "id"), formDataToObject(fd)), "Saved");
}

export async function replaceMediaAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return act(async (ctx) => {
    const file = fd.get("file");
    if (!(file instanceof File) || !file.size) throw new ValidationError("Choose a file");
    await replaceMediaFile(ctx, str(fd, "id"), file.name, Buffer.from(await file.arrayBuffer()));
  }, "File replaced");
}

export async function deleteMediaAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return act((ctx) => deleteMedia(ctx, str(fd, "id")), "Deleted");
}
