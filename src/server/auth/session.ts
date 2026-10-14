import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "../db";
import { randomToken, sha256 } from "./tokens";
import { buildOrgContext, type OrgContext, type SessionUser } from "../context";
import type { Permission } from "@/lib/permissions";

const secureCookies = () => (process.env.APP_URL ?? "").startsWith("https://");
export const SESSION_COOKIE = () => (secureCookies() ? "__Host-opencsr_session" : "opencsr_session");
export const ORG_COOKIE = "opencsr_org";

function ttlMs() {
  const hours = Number(process.env.SESSION_TTL_HOURS ?? 168) || 168;
  return hours * 3600 * 1000;
}

export async function clientIp(): Promise<string | null> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0]!.trim() : h.get("x-real-ip")) || null;
}

/** Creates a database session and sets the session cookie. Call only from actions/route handlers. */
export async function createSession(userId: string) {
  const token = randomToken(32);
  const h = await headers();
  const expiresAt = new Date(Date.now() + ttlMs());
  await prisma.session.create({
    data: {
      tokenHash: sha256(token),
      userId,
      expiresAt,
      ipAddress: await clientIp(),
      userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
    },
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE(), token, {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE())?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete(SESSION_COOKIE());
}

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE())?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { select: { id: true, email: true, name: true, isPlatformAdmin: true, isActive: true } } },
  });
  if (!session || session.expiresAt < new Date() || !session.user.isActive) return null;
  // Touch at most every 10 minutes to limit writes.
  if (Date.now() - session.lastUsedAt.getTime() > 10 * 60 * 1000) {
    await prisma.session.update({ where: { id: session.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  }
  const { id, email, name, isPlatformAdmin } = session.user;
  return { id, email, name, isPlatformAdmin };
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** Organisations the current user may access (all for platform admins). */
export const getAccessibleOrganisations = cache(async () => {
  const user = await getSessionUser();
  if (!user) return [];
  if (user.isPlatformAdmin) {
    return prisma.organisation.findMany({
      where: { archivedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, isDemo: true },
    });
  }
  const memberships = await prisma.membership.findMany({
    where: { userId: user.id, isActive: true, organisation: { archivedAt: null } },
    include: { organisation: { select: { id: true, name: true, slug: true, isDemo: true } } },
    orderBy: { organisation: { name: "asc" } },
  });
  return memberships.map((m) => m.organisation);
});

/** Resolves the active organisation context for the signed-in user, or null. */
export const getOrgContext = cache(async (): Promise<OrgContext | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  const orgs = await getAccessibleOrganisations();
  if (orgs.length === 0) return null;
  const jar = await cookies();
  const preferred = jar.get(ORG_COOKIE)?.value;
  const chosen = orgs.find((o) => o.id === preferred) ?? orgs[0]!;
  return buildOrgContext(user, chosen.id, await clientIp());
});

/**
 * For pages and server actions: require a signed-in user with an active
 * organisation and (optionally) specific permissions.
 */
export async function requireOrgContext(...permissions: Permission[]): Promise<OrgContext> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const ctx = await getOrgContext();
  if (!ctx) redirect("/setup");
  for (const p of permissions) if (!ctx.permissions.has(p)) redirect("/admin/forbidden");
  return ctx;
}
