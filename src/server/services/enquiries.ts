import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { actorOf, assertCan, ensureOwned, type OrgContext } from "../context";
import { audit } from "../audit";
import { ValidationError } from "../errors";
import { parseInput } from "../validation";
import { hashIp, signPayload, verifyPayload } from "../auth/tokens";
import { rateLimit } from "../rate-limit";
import { emailEnabled, sendMail } from "../mail";
import { zEmail, zOptId, zOptText, zText } from "@/lib/zod-helpers";
import { toCsv } from "@/lib/csv";
import { enumOrUndefined, paged, skipTake, type ListQuery } from "./common";
import { notifyPermission } from "./notifications";
import { ROLE_PERMISSIONS, type RoleName } from "@/lib/permissions";

export const ENQUIRY_STATUSES = ["NEW", "IN_PROGRESS", "CLOSED"] as const;

/** Issued with the form; used to reject submissions that are too fast (bots) or stale. */
export function issueFormToken(organisationId: string) {
  return signPayload({ o: organisationId, t: Date.now() });
}

const publicSchema = z.object({
  name: zText(120),
  email: zEmail,
  phone: zOptText(40),
  organisationName: zOptText(160),
  category: z.string().trim().min(1, "Choose a category").max(80),
  message: z.string().trim().min(10, "Please write at least 10 characters").max(5000),
  consent: z.literal("on", { errorMap: () => ({ message: "Please confirm that we may store your details" }) }),
  website: z.string().max(200).optional(), // honeypot
  formToken: z.string().max(500),
});

export async function submitEnquiry(organisationId: string, input: unknown, meta: { ip: string | null; userAgent: string | null }) {
  const data = parseInput(publicSchema, input);
  const org = await prisma.organisation.findUnique({ where: { id: organisationId } });
  if (!org) throw new ValidationError("Unknown organisation");
  // Spam protection: honeypot, signed timing token and IP rate limiting.
  const token = verifyPayload<{ o: string; t: number }>(data.formToken);
  const age = token ? Date.now() - token.t : -1;
  if (data.website || !token || token.o !== organisationId || age < 2500 || age > 24 * 3600 * 1000) {
    throw new ValidationError("Your message could not be sent. Please reload the page and try again.");
  }
  await rateLimit(`enquiry:${organisationId}:${hashIp(meta.ip) ?? "unknown"}`, 5, 60 * 60);
  if (!org.enquiryCategories.includes(data.category)) throw new ValidationError("Choose a category", { category: ["Invalid category"] });

  const enquiry = await prisma.enquiry.create({
    data: {
      organisationId,
      name: data.name,
      email: data.email,
      phone: data.phone,
      organisationName: data.organisationName,
      category: data.category,
      message: data.message,
      consent: true,
      ipHash: hashIp(meta.ip),
      userAgent: meta.userAgent?.slice(0, 300) ?? null,
    },
  });
  await notifyPermission(organisationId, "enquiry.read", { type: "enquiry.new", title: `New enquiry from ${data.name}`, body: data.category, link: `/admin/enquiries/${enquiry.id}` });
  if (emailEnabled()) {
    const roles = (Object.keys(ROLE_PERMISSIONS) as RoleName[]).filter((r) => ROLE_PERMISSIONS[r].includes("enquiry.manage"));
    const recipients = await prisma.membership.findMany({ where: { organisationId, isActive: true, role: { in: roles } }, select: { user: { select: { email: true } } } });
    const to = [...new Set([org.email, ...recipients.map((r) => r.user.email)].filter(Boolean) as string[])];
    if (to.length) {
      await sendMail({
        to,
        subject: `New website enquiry: ${data.category}`,
        text: `A new enquiry was received on the ${org.name} website.\n\nName: ${data.name}\nEmail: ${data.email}\nCategory: ${data.category}\n\n${data.message}\n\nView it in the OpenCSR dashboard.`,
      });
    }
  }
  return enquiry;
}

export type EnquiryFilters = ListQuery & { category?: string };

export async function listEnquiries(ctx: OrgContext, q: EnquiryFilters) {
  assertCan(ctx, "enquiry.read");
  const status = enumOrUndefined(q.status, ENQUIRY_STATUSES);
  const where: Prisma.EnquiryWhereInput = {
    organisationId: ctx.organisationId,
    ...(status ? { status } : {}),
    ...(q.category ? { category: q.category } : {}),
    ...(q.q ? { OR: [{ name: { contains: q.q, mode: "insensitive" } }, { email: { contains: q.q, mode: "insensitive" } }, { message: { contains: q.q, mode: "insensitive" } }] } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.enquiry.findMany({ where, orderBy: { createdAt: "desc" }, ...skipTake(q), include: { assignedTo: { select: { name: true } } } }),
    prisma.enquiry.count({ where }),
  ]);
  return paged(items, total, q);
}

export async function getEnquiry(ctx: OrgContext, id: string) {
  assertCan(ctx, "enquiry.read");
  const e = ensureOwned(ctx, await prisma.enquiry.findUnique({ where: { id }, include: { assignedTo: { select: { id: true, name: true } } } }), "Enquiry");
  return e;
}

export async function updateEnquiry(ctx: OrgContext, id: string, input: unknown) {
  assertCan(ctx, "enquiry.manage");
  const data = parseInput(z.object({ status: z.enum(ENQUIRY_STATUSES), internalNotes: zOptText(5000), assignedToId: zOptId }), input);
  const before = ensureOwned(ctx, await prisma.enquiry.findUnique({ where: { id } }), "Enquiry");
  if (data.assignedToId && !(await prisma.membership.findFirst({ where: { userId: data.assignedToId, organisationId: ctx.organisationId } })))
    throw new ValidationError("Assignee must be a member");
  const e = await prisma.enquiry.update({ where: { id }, data });
  await audit(actorOf(ctx), { action: "enquiry.update", entityType: "Enquiry", entityId: id, summary: `Enquiry from ${e.name}: ${before.status} → ${data.status}` });
  return e;
}

export async function exportEnquiriesCsv(ctx: OrgContext) {
  assertCan(ctx, "enquiry.manage");
  const items = await prisma.enquiry.findMany({ where: { organisationId: ctx.organisationId }, orderBy: { createdAt: "desc" } });
  await audit(actorOf(ctx), { action: "enquiry.export", entityType: "Enquiry", summary: `Exported ${items.length} enquiries` });
  return toCsv(
    ["Received", "Name", "Email", "Phone", "Organisation", "Category", "Status", "Message"],
    items.map((e) => [e.createdAt, e.name, e.email, e.phone, e.organisationName, e.category, e.status, e.message]),
  );
}

export async function newEnquiryCount(ctx: OrgContext) {
  return prisma.enquiry.count({ where: { organisationId: ctx.organisationId, status: "NEW" } });
}

export { issueFormToken as createEnquiryFormToken };
