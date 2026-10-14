import { z } from "zod";
import { prisma } from "../db";
import { actorOf, assertCan, type OrgContext, type SessionUser } from "../context";
import { audit } from "../audit";
import { ForbiddenError, NotFoundError, ValidationError } from "../errors";
import { parseInput } from "../validation";
import { dummyVerify, hashPassword, passwordProblems, verifyPassword } from "../auth/password";
import { randomToken, sha256 } from "../auth/tokens";
import { rateLimit, resetRateLimit } from "../rate-limit";
import { sendMail } from "../mail";
import { ROLES } from "@/lib/permissions";
import { zEmail, zText } from "@/lib/zod-helpers";

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

const loginSchema = z.object({ email: zEmail, password: z.string().min(1, "Required").max(200) });

/**
 * Verifies credentials with rate limiting per email and per IP. Returns the
 * user on success. Error messages never reveal whether the account exists.
 */
export async function authenticate(input: unknown, ip: string | null) {
  const { email, password } = parseInput(loginSchema, input);
  await rateLimit(`login:ip:${ip ?? "unknown"}`, 30, 15 * 60);
  await rateLimit(`login:email:${email}`, 8, 15 * 60);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) {
    await dummyVerify(password);
    throw new ValidationError("Incorrect email or password");
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    await audit({ userId: user.id, organisationId: null, ip }, { action: "auth.login_failed", entityType: "User", entityId: user.id, summary: "Failed sign-in attempt" });
    throw new ValidationError("Incorrect email or password");
  }
  await resetRateLimit(`login:email:${email}`);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await audit({ userId: user.id, organisationId: null, ip }, { action: "auth.login", entityType: "User", entityId: user.id, summary: "Signed in" });
  return user;
}

export async function changeOwnPassword(user: SessionUser, input: unknown) {
  const data = parseInput(
    z.object({ currentPassword: z.string().min(1, "Required"), newPassword: z.string().min(1, "Required").max(200) }),
    input,
  );
  const record = await prisma.user.findUnique({ where: { id: user.id } });
  if (!record || !(await verifyPassword(data.currentPassword, record.passwordHash)))
    throw new ValidationError("Current password is incorrect", { currentPassword: ["Incorrect password"] });
  const problems = passwordProblems(data.newPassword);
  if (problems.length) throw new ValidationError("Choose a stronger password", { newPassword: problems });
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(data.newPassword), passwordChangedAt: new Date() } }),
    prisma.session.deleteMany({ where: { userId: user.id } }),
  ]);
  await audit({ userId: user.id, organisationId: null }, { action: "auth.password_changed", entityType: "User", entityId: user.id, summary: "Changed password" });
}

/** Starts a password reset. Always succeeds from the caller's perspective. */
export async function requestPasswordReset(input: unknown, ip: string | null, appUrl: string) {
  const { email } = parseInput(z.object({ email: zEmail }), input);
  await rateLimit(`reset:ip:${ip ?? "unknown"}`, 10, 60 * 60);
  await rateLimit(`reset:email:${email}`, 3, 60 * 60);
  const settings = await prisma.siteSettings.findUnique({ where: { id: 1 } });
  if (settings && !settings.allowPasswordReset) return { delivered: false };
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) return { delivered: false };
  const token = randomToken(32);
  await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 60 * 60 * 1000) } });
  const link = `${appUrl.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
  const delivered = await sendMail({
    to: user.email,
    subject: "Reset your OpenCSR password",
    text: `A password reset was requested for your account.\n\nOpen this link within 60 minutes to choose a new password:\n${link}\n\nIf you did not request this, you can ignore this email.`,
  });
  await audit({ userId: user.id, organisationId: null, ip }, { action: "auth.reset_requested", entityType: "User", entityId: user.id, summary: "Password reset requested" });
  return { delivered };
}

export async function completePasswordReset(input: unknown) {
  const data = parseInput(z.object({ token: z.string().min(10).max(200), password: z.string().min(1).max(200) }), input);
  const problems = passwordProblems(data.password);
  if (problems.length) throw new ValidationError("Choose a stronger password", { password: problems });
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(data.token) } });
  if (!record || record.usedAt || record.expiresAt < new Date()) throw new ValidationError("This reset link is invalid or has expired");
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash: await hashPassword(data.password), passwordChangedAt: new Date() } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.session.deleteMany({ where: { userId: record.userId } }),
  ]);
  await audit({ userId: record.userId, organisationId: null }, { action: "auth.reset_completed", entityType: "User", entityId: record.userId, summary: "Password reset completed" });
}

/** Admin-generated reset link, for installations without email. */
export async function createResetLinkForMember(ctx: OrgContext, userId: string, appUrl: string) {
  assertCan(ctx, "users.manage");
  const membership = await prisma.membership.findUnique({ where: { userId_organisationId: { userId, organisationId: ctx.organisationId } }, include: { user: true } });
  if (!membership) throw new NotFoundError("Member");
  if (membership.user.isPlatformAdmin && !ctx.user.isPlatformAdmin) throw new ForbiddenError();
  const token = randomToken(32);
  await prisma.passwordResetToken.create({ data: { userId, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 24 * 3600 * 1000) } });
  await audit(actorOf(ctx), { action: "user.reset_link", entityType: "User", entityId: userId, summary: `Generated a password reset link for ${membership.user.email}` });
  return `${appUrl.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
}

// ---------------------------------------------------------------------------
// Members & roles
// ---------------------------------------------------------------------------

export async function listMembers(ctx: OrgContext) {
  assertCan(ctx, "users.manage");
  return prisma.membership.findMany({
    where: { organisationId: ctx.organisationId },
    include: { user: { select: { id: true, email: true, name: true, isActive: true, lastLoginAt: true, isPlatformAdmin: true } } },
    orderBy: { user: { name: "asc" } },
  });
}

/** Lightweight member list for assignment pickers (any member can see names). */
export async function listAssignableUsers(ctx: OrgContext) {
  const members = await prisma.membership.findMany({
    where: { organisationId: ctx.organisationId, isActive: true, user: { isActive: true } },
    select: { user: { select: { id: true, name: true } } },
    orderBy: { user: { name: "asc" } },
  });
  return members.map((m) => m.user);
}

const addMemberSchema = z.object({
  name: zText(120),
  email: zEmail,
  role: z.enum(ROLES),
  password: z.string().max(200).optional(),
});

/**
 * Adds a member. If the email is new, an account is created with the supplied
 * temporary password (or a random one plus a reset link).
 */
export async function addMember(ctx: OrgContext, input: unknown, appUrl: string) {
  assertCan(ctx, "users.manage");
  const data = parseInput(addMemberSchema, input);
  if (data.role === "ORG_ADMIN" && ctx.role !== "ORG_ADMIN" && ctx.role !== "PLATFORM_ADMIN") throw new ForbiddenError();
  let user = await prisma.user.findUnique({ where: { email: data.email } });
  let resetLink: string | null = null;
  if (!user) {
    let password = data.password?.trim();
    if (password) {
      const problems = passwordProblems(password);
      if (problems.length) throw new ValidationError("Choose a stronger temporary password", { password: problems });
    } else {
      password = randomToken(24);
    }
    user = await prisma.user.create({ data: { email: data.email, name: data.name, passwordHash: await hashPassword(password) } });
    if (!data.password?.trim()) {
      const token = randomToken(32);
      await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 72 * 3600 * 1000) } });
      resetLink = `${appUrl.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;
      await sendMail({
        to: user.email,
        subject: `You have been added to ${ctx.organisation.name} on OpenCSR`,
        text: `${ctx.user.name} added you to ${ctx.organisation.name}.\n\nSet your password using this link (valid for 72 hours):\n${resetLink}`,
      });
    }
  }
  const existing = await prisma.membership.findUnique({ where: { userId_organisationId: { userId: user.id, organisationId: ctx.organisationId } } });
  if (existing) throw new ValidationError("This person is already a member", { email: ["Already a member"] });
  const membership = await prisma.membership.create({ data: { userId: user.id, organisationId: ctx.organisationId, role: data.role } });
  await audit(actorOf(ctx), { action: "member.add", entityType: "Membership", entityId: membership.id, summary: `Added ${user.email} as ${data.role}` });
  return { membership, resetLink };
}

async function assertNotLastAdmin(organisationId: string, membershipId: string) {
  const admins = await prisma.membership.count({ where: { organisationId, role: "ORG_ADMIN", isActive: true, id: { not: membershipId } } });
  if (admins === 0) throw new ValidationError("An organisation must keep at least one active administrator");
}

export async function updateMember(ctx: OrgContext, membershipId: string, input: unknown) {
  assertCan(ctx, "users.manage");
  const data = parseInput(z.object({ role: z.enum(ROLES), isActive: z.boolean() }), input);
  const m = await prisma.membership.findFirst({ where: { id: membershipId, organisationId: ctx.organisationId }, include: { user: true } });
  if (!m) throw new NotFoundError("Member");
  if ((m.role === "ORG_ADMIN" || data.role === "ORG_ADMIN") && ctx.role !== "ORG_ADMIN" && ctx.role !== "PLATFORM_ADMIN") throw new ForbiddenError();
  if (m.role === "ORG_ADMIN" && (data.role !== "ORG_ADMIN" || !data.isActive)) await assertNotLastAdmin(ctx.organisationId, m.id);
  const updated = await prisma.membership.update({ where: { id: m.id }, data });
  await audit(actorOf(ctx), {
    action: "member.update",
    entityType: "Membership",
    entityId: m.id,
    summary: `Updated ${m.user.email}: role ${m.role} → ${data.role}${data.isActive ? "" : " (deactivated)"}`,
    metadata: { from: { role: m.role, isActive: m.isActive }, to: data },
  });
  if (!data.isActive) await prisma.session.deleteMany({ where: { userId: m.userId, user: { memberships: { none: { isActive: true } } } } });
  return updated;
}

export async function removeMember(ctx: OrgContext, membershipId: string) {
  assertCan(ctx, "users.manage");
  const m = await prisma.membership.findFirst({ where: { id: membershipId, organisationId: ctx.organisationId }, include: { user: true } });
  if (!m) throw new NotFoundError("Member");
  if (m.userId === ctx.user.id) throw new ValidationError("You cannot remove yourself");
  if (m.role === "ORG_ADMIN") {
    if (ctx.role !== "ORG_ADMIN" && ctx.role !== "PLATFORM_ADMIN") throw new ForbiddenError();
    await assertNotLastAdmin(ctx.organisationId, m.id);
  }
  await prisma.membership.delete({ where: { id: m.id } });
  await audit(actorOf(ctx), { action: "member.remove", entityType: "Membership", entityId: m.id, summary: `Removed ${m.user.email}` });
}

export async function updateProfile(user: SessionUser, input: unknown) {
  const data = parseInput(z.object({ name: zText(120) }), input);
  await prisma.user.update({ where: { id: user.id }, data: { name: data.name } });
}
