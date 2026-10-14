import { prisma } from "../db";
import type { OrgContext } from "../context";
import type { Permission } from "@/lib/permissions";
import { ROLE_PERMISSIONS, type RoleName } from "@/lib/permissions";
import { logger } from "../logger";

type NotificationInput = { type: string; title: string; body?: string; link?: string; dedupeKey?: string };

/** Creates an in-app notification. Never throws (notifications are best-effort). */
export async function notify(organisationId: string, userId: string, n: NotificationInput) {
  try {
    if (n.dedupeKey) {
      await prisma.notification.upsert({
        where: { userId_dedupeKey: { userId, dedupeKey: n.dedupeKey } },
        create: { organisationId, userId, ...n },
        update: {},
      });
    } else {
      await prisma.notification.create({ data: { organisationId, userId, ...n } });
    }
  } catch (err) {
    logger.warn("failed to create notification", { err, type: n.type });
  }
}

/** Notify every active member holding a permission (optionally excluding the actor). */
export async function notifyPermission(organisationId: string, permission: Permission, n: NotificationInput, excludeUserId?: string) {
  const roles = (Object.keys(ROLE_PERMISSIONS) as RoleName[]).filter((r) => ROLE_PERMISSIONS[r].includes(permission));
  const members = await prisma.membership.findMany({
    where: { organisationId, isActive: true, role: { in: roles }, user: { isActive: true } },
    select: { userId: true },
  });
  for (const m of members) if (m.userId !== excludeUserId) await notify(organisationId, m.userId, n);
}

export async function listNotifications(ctx: OrgContext, opts: { unreadOnly?: boolean; take?: number } = {}) {
  return prisma.notification.findMany({
    where: { userId: ctx.user.id, organisationId: ctx.organisationId, ...(opts.unreadOnly ? { readAt: null } : {}) },
    orderBy: { createdAt: "desc" },
    take: opts.take ?? 50,
  });
}

export async function unreadCount(ctx: OrgContext) {
  return prisma.notification.count({ where: { userId: ctx.user.id, organisationId: ctx.organisationId, readAt: null } });
}

export async function markRead(ctx: OrgContext, id?: string) {
  await prisma.notification.updateMany({
    where: { userId: ctx.user.id, organisationId: ctx.organisationId, readAt: null, ...(id ? { id } : {}) },
    data: { readAt: new Date() },
  });
}
