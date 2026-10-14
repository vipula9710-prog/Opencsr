"use server";

import { redirect } from "next/navigation";
import { act, str } from "@/server/page";
import type { ActionState } from "@/server/action";
import { formDataToObject } from "@/lib/zod-helpers";
import { saveProgramme } from "@/server/services/projects";
import { deleteFocusArea, saveFocusArea } from "@/server/services/organisations";

export async function saveProgrammeAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = str(fd, "id") || null;
  let createdId: string | null = null;
  const res = await act(async (ctx) => {
    const p = await saveProgramme(ctx, id, formDataToObject(fd));
    createdId = p.id;
  }, "Programme saved");
  if (res.ok && !id && createdId) redirect(`/admin/programmes/${createdId}`);
  return res;
}

export async function saveFocusAreaAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return act((ctx) => saveFocusArea(ctx, str(fd, "id") || null, formDataToObject(fd)), "Focus area saved");
}

export async function deleteFocusAreaAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return act((ctx) => deleteFocusArea(ctx, str(fd, "id")), "Focus area deleted");
}
