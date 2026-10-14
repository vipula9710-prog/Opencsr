"use server";

import { act, str } from "@/server/page";
import type { ActionState } from "@/server/action";
import { formDataToObject } from "@/lib/zod-helpers";
import { updateEnquiry } from "@/server/services/enquiries";

export async function updateEnquiryAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return act((ctx) => updateEnquiry(ctx, str(fd, "id"), formDataToObject(fd)), "Enquiry updated");
}
