import type { Organisation } from "@prisma/client";
import { prisma } from "./db";
import { ForbiddenError, NotFoundError } from "./errors";
import { permissionsForRole, type Permission, type RoleName } from "@/lib/permissions";
import type { AuditActor } from "./audit";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  isPlatformAdmin: boolean;
};

/**
 * The authorisation context passed to every service function. It is only ever
 * built on the server from a verified session and a verified membership — never
 * from organisation IDs supplied by the browser.
 */
export type OrgContext = {
  user: SessionUser;
  organisationId: string;
  organisation: Organisation;
  role: RoleName | "PLATFORM_ADMIN";
  permissions: Set<Permission>;
  ip?: string | null;
};

export async function buildOrgContext(
  user: SessionUser,
  organisationId: string,
  ip?: string | null,
): Promise<OrgContext | null> {
  const organisation = await prisma.organisation.findUnique({ where: { id: organisationId } });
  if (!organisation || organisation.archivedAt) return null;
  if (user.isPlatformAdmin) {
    return { user, organisationId, organisation, role: "PLATFORM_ADMIN", permissions: permissionsForRole("PLATFORM_ADMIN"), ip };
  }
  const membership = await prisma.membership.findUnique({
    where: { userId_organisationId: { userId: user.id, organisationId } },
  });
  if (!membership || !membership.isActive) return null;
  return {
    user,
    organisationId,
    organisation,
    role: membership.role,
    permissions: permissionsForRole(membership.role),
    ip,
  };
}

export function can(ctx: OrgContext, permission: Permission): boolean {
  return ctx.permissions.has(permission);
}

export function assertCan(ctx: OrgContext, ...permissions: Permission[]) {
  for (const p of permissions) {
    if (!ctx.permissions.has(p)) throw new ForbiddenError();
  }
}

export function actorOf(ctx: OrgContext): AuditActor {
  return { userId: ctx.user.id, organisationId: ctx.organisationId, ip: ctx.ip ?? null };
}

/** Throw NotFound when a record does not belong to the context's organisation. */
export function ensureOwned<T extends { organisationId: string } | null>(
  ctx: OrgContext,
  record: T,
  what = "Record",
): NonNullable<T> {
  if (!record || record.organisationId !== ctx.organisationId) throw new NotFoundError(what);
  return record as NonNullable<T>;
}
