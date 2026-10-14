import { randomBytes } from "node:crypto";
import type { Role } from "@prisma/client";
import { prisma } from "@/server/db";
import { buildOrgContext, type OrgContext, type SessionUser } from "@/server/context";
import { hashPassword } from "@/server/auth/password";
import { createOrganisation } from "@/server/services/organisations";

export const uid = () => randomBytes(4).toString("hex");

export async function makeUser(opts: { platformAdmin?: boolean; password?: string } = {}) {
  const email = `user-${uid()}@test.example.org`;
  const user = await prisma.user.create({ data: { email, name: `User ${email}`, passwordHash: await hashPassword(opts.password ?? "Password-123"), isPlatformAdmin: !!opts.platformAdmin } });
  const session: SessionUser = { id: user.id, email, name: user.name, isPlatformAdmin: user.isPlatformAdmin };
  return { user, session };
}

/** Creates an organisation with an admin (platform admin) and returns its context. */
export async function makeOrg(name = `Org ${uid()}`) {
  const { session } = await makeUser({ platformAdmin: true });
  const org = await createOrganisation(session, { name, slug: `org-${uid()}`, currency: "INR", financialYearStartMonth: 4 });
  const ctx = (await buildOrgContext(session, org.id))!;
  return { org, ctx, admin: session };
}

/** Adds a member with a given role to an organisation and returns their context. */
export async function member(organisationId: string, role: Role): Promise<OrgContext> {
  const { user, session } = await makeUser();
  await prisma.membership.create({ data: { userId: user.id, organisationId, role } });
  return (await buildOrgContext(session, organisationId))!;
}
