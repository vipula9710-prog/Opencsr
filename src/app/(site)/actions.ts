"use server";

import { headers } from "next/headers";
import { runAction, type ActionState } from "@/server/action";
import { clientIp } from "@/server/auth/session";
import { resolvePublicOrganisation } from "@/server/services/public-site";
import { submitEnquiry } from "@/server/services/enquiries";
import { formDataToObject } from "@/lib/zod-helpers";
import { ValidationError } from "@/server/errors";

/** Public contact form. The organisation is resolved on the server from the request host. */
export async function submitEnquiryAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const org = await resolvePublicOrganisation();
    if (!org) throw new ValidationError("This website is not configured yet");
    await submitEnquiry(org.id, formDataToObject(fd), { ip: await clientIp(), userAgent: (await headers()).get("user-agent") });
  }, "Thank you — your message has been received.");
}
