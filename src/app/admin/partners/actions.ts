"use server";

import { redirect } from "next/navigation";
import { act, str } from "@/server/page";
import type { ActionState } from "@/server/action";
import { formDataToObject } from "@/lib/zod-helpers";
import { deleteContact, saveAgreement, saveContact, savePartner, setPartnerArchived, updateVerification } from "@/server/services/partners";

function partnerInput(fd: FormData) {
  const data = formDataToObject(fd);
  const dd: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (k.startsWith("dd.") && typeof v === "string") dd[k.slice(3)] = v;
  return { ...data, dueDiligence: dd };
}

export async function savePartnerAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = str(fd, "id") || null;
  let newId = "";
  const res = await act(async (ctx) => {
    newId = (await savePartner(ctx, id, partnerInput(fd))).id;
  });
  if (res.ok) redirect(`/admin/partners/${newId}?saved=1`);
  return res;
}

export async function verificationAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return act((ctx) => updateVerification(ctx, str(fd, "id"), formDataToObject(fd)), "Verification status recorded");
}

export async function archivePartnerAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return act((ctx) => setPartnerArchived(ctx, str(fd, "id"), str(fd, "archived") === "1"), "Saved");
}

export async function saveContactAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return act((ctx) => saveContact(ctx, str(fd, "partnerId"), str(fd, "id") || null, formDataToObject(fd)), "Contact saved");
}

export async function deleteContactAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return act((ctx) => deleteContact(ctx, str(fd, "partnerId"), str(fd, "id")), "Contact removed");
}

export async function saveAgreementAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return act((ctx) => saveAgreement(ctx, str(fd, "partnerId"), str(fd, "id") || null, formDataToObject(fd)), "Agreement saved");
}
