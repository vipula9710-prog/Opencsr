import { prisma } from "../db";
import { logger } from "../logger";
import { publishDueScheduledPosts } from "../services/blog";
import { notify } from "../services/notifications";
import { purgeExpiredRateLimits } from "../rate-limit";

const LOCK_ID = 727_001; // arbitrary constant for pg_try_advisory_lock

async function sendTaskReminders(now: Date) {
  const due = await prisma.task.findMany({
    where: { reminderAt: { lte: now }, reminderSentAt: null, assigneeId: { not: null }, status: { notIn: ["DONE", "CANCELLED"] } },
    take: 500,
  });
  for (const t of due) {
    await notify(t.organisationId, t.assigneeId!, { type: "task.reminder", title: `Reminder: ${t.title}`, link: `/admin/tasks/${t.id}` });
    await prisma.task.update({ where: { id: t.id }, data: { reminderSentAt: now } });
  }
  // Deadline warnings 48 hours ahead (de-duplicated per task and due date).
  const soon = await prisma.task.findMany({
    where: { dueDate: { gte: now, lte: new Date(now.getTime() + 48 * 3600 * 1000) }, assigneeId: { not: null }, status: { notIn: ["DONE", "CANCELLED"] } },
    take: 500,
  });
  for (const t of soon) {
    await notify(t.organisationId, t.assigneeId!, {
      type: "task.deadline",
      title: `Due soon: ${t.title}`,
      link: `/admin/tasks/${t.id}`,
      dedupeKey: `deadline:${t.id}:${t.dueDate!.toISOString().slice(0, 10)}`,
    });
  }
  return due.length;
}

async function partnerReviewReminders(now: Date) {
  const partners = await prisma.partnerOrganisation.findMany({
    where: { archivedAt: null, nextReviewDate: { lte: new Date(now.getTime() + 14 * 86400000) } },
    select: { id: true, name: true, organisationId: true, nextReviewDate: true },
    take: 500,
  });
  for (const p of partners) {
    const managers = await prisma.membership.findMany({ where: { organisationId: p.organisationId, isActive: true, role: { in: ["ORG_ADMIN", "CSR_MANAGER"] } }, select: { userId: true } });
    for (const m of managers) {
      await notify(p.organisationId, m.userId, {
        type: "partner.review",
        title: `Due-diligence review due: ${p.name}`,
        link: `/admin/partners/${p.id}`,
        dedupeKey: `partner-review:${p.id}:${p.nextReviewDate!.toISOString().slice(0, 10)}`,
      });
    }
  }
}

async function cleanup(now: Date) {
  await prisma.session.deleteMany({ where: { expiresAt: { lt: now } } });
  await prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - 7 * 86400000) } } });
  await purgeExpiredRateLimits();
}

/** Runs all background jobs once. Safe to call concurrently from several instances. */
export async function runJobs(now = new Date()) {
  const [{ locked }] = await prisma.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_lock(${LOCK_ID}) AS locked`;
  if (!locked) return { skipped: true };
  try {
    const published = await publishDueScheduledPosts(now);
    const reminders = await sendTaskReminders(now);
    await partnerReviewReminders(now);
    await cleanup(now);
    return { skipped: false, published, reminders };
  } catch (err) {
    logger.error("background jobs failed", { err });
    throw err;
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(${LOCK_ID})`;
  }
}
