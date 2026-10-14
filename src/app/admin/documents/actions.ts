"use server";

import { redirect } from "next/navigation";
import { act, str } from "@/server/page";
import type { ActionState } from "@/server/action";
import { formDataToObject } from "@/lib/zod-helpers";
import { addDocumentVersion, createDocument, setDocumentArchived, setDocumentStatus, updateDocument } from "@/server/services/documents";
import { ValidationError } from "@/server/errors";

async function fileFrom(fd: FormData) {
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) throw new ValidationError("Choose a file to upload", { file: ["Required"] });
  return { filename: file.name, data: Buffer.from(await file.arrayBuffer()) };
}

export async function createDocumentAction(_: ActionState, fd: FormData): Promise<ActionState> {
  let id = "";
  const res = await act(async (ctx) => {
    id = (await createDocument(ctx, formDataToObject(fd), await fileFrom(fd))).id;
  });
  if (res.ok) redirect(`/admin/documents/${id}`);
  return res;
}

export async function updateDocumentAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return act((ctx) => updateDocument(ctx, str(fd, "id"), formDataToObject(fd)), "Document updated");
}

export async function addVersionAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return act(async (ctx) => addDocumentVersion(ctx, str(fd, "id"), await fileFrom(fd), str(fd, "notes") || null), "New version uploaded");
}

export async function documentStatusAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const status = str(fd, "status");
  return act((ctx) => {
    if (!["DRAFT", "IN_REVIEW", "APPROVED", "REJECTED"].includes(status)) throw new ValidationError("Invalid status");
    return setDocumentStatus(ctx, str(fd, "id"), status as "DRAFT");
  }, "Status updated");
}

export async function archiveDocumentAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return act((ctx) => setDocumentArchived(ctx, str(fd, "id"), str(fd, "archived") === "1"), "Saved");
}
