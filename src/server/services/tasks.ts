import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { actorOf, assertCan, can, ensureOwned, type OrgContext } from "../context";
import { audit, diff } from "../audit";
import { NotFoundError, ValidationError } from "../errors";
import { parseInput } from "../validation";
import { zOptDate, zOptId, zOptText, zText } from "@/lib/zod-helpers";
import { enumOrUndefined, paged, skipTake, sortBy, type ListQuery } from "./common";
import { notify } from "./notifications";

export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "BLOCKED", "DONE", "CANCELLED"] as const;
export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

const taskSchema = z.object({
  title: zText(200),
  description: zOptText(5000),
  status: z.enum(TASK_STATUSES).default("TODO"),
  priority: z.enum(TASK_PRIORITIES).default("MEDIUM"),
  dueDate: zOptDate,
  reminderAt: zOptDate,
  assigneeId: zOptId,
  projectId: zOptId,
  milestoneId: zOptId,
  partnerId: zOptId,
  dependsOnIds: z.array(z.string().max(60)).max(20).optional(),
});

export type TaskFilters = ListQuery & { mine?: string; projectId?: string; priority?: string };

export async function listTasks(ctx: OrgContext, q: TaskFilters) {
  assertCan(ctx, "task.read");
  const status = enumOrUndefined(q.status, TASK_STATUSES);
  const priority = enumOrUndefined(q.priority, TASK_PRIORITIES);
  const where: Prisma.TaskWhereInput = {
    organisationId: ctx.organisationId,
    ...(status ? { status } : q.status === "open" || !q.status ? { status: { notIn: ["DONE", "CANCELLED"] } } : {}),
    ...(priority ? { priority } : {}),
    ...(q.mine === "1" ? { assigneeId: ctx.user.id } : {}),
    ...(q.projectId ? { projectId: q.projectId } : {}),
    ...(q.q ? { title: { contains: q.q, mode: "insensitive" } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.task.findMany({
      where,
      orderBy: [sortBy(q, ["dueDate", "priority", "status", "title", "createdAt"] as const, "dueDate"), { createdAt: "desc" }],
      ...skipTake(q),
      include: { assignee: { select: { id: true, name: true } }, project: { select: { id: true, title: true } }, milestone: { select: { title: true } } },
    }),
    prisma.task.count({ where }),
  ]);
  return paged(items, total, q);
}

export async function getTask(ctx: OrgContext, id: string) {
  assertCan(ctx, "task.read");
  const task = await prisma.task.findFirst({
    where: { id, organisationId: ctx.organisationId },
    include: {
      assignee: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
      project: { select: { id: true, title: true } },
      milestone: { select: { id: true, title: true } },
      partner: { select: { id: true, name: true } },
      dependsOn: { include: { dependsOn: { select: { id: true, title: true, status: true } } } },
      dependents: { include: { task: { select: { id: true, title: true, status: true } } } },
    },
  });
  if (!task) throw new NotFoundError("Task");
  const [comments, history] = await Promise.all([
    prisma.comment.findMany({ where: { organisationId: ctx.organisationId, entityType: "Task", entityId: id }, orderBy: { createdAt: "asc" }, include: { author: { select: { name: true } } } }),
    prisma.auditLog.findMany({ where: { organisationId: ctx.organisationId, entityType: "Task", entityId: id }, orderBy: { createdAt: "desc" }, take: 50, include: { actor: { select: { name: true } } } }),
  ]);
  return { ...task, comments, history };
}

async function validateTaskRefs(ctx: OrgContext, d: z.infer<typeof taskSchema>, selfId: string | null) {
  if (d.projectId) ensureOwned(ctx, await prisma.project.findUnique({ where: { id: d.projectId } }), "Project");
  if (d.partnerId) ensureOwned(ctx, await prisma.partnerOrganisation.findUnique({ where: { id: d.partnerId } }), "Partner");
  if (d.milestoneId) {
    const m = ensureOwned(ctx, await prisma.milestone.findUnique({ where: { id: d.milestoneId } }), "Milestone");
    if (d.projectId && m.projectId !== d.projectId) throw new ValidationError("The milestone belongs to a different project", { milestoneId: ["Wrong project"] });
  }
  if (d.assigneeId && !(await prisma.membership.findFirst({ where: { userId: d.assigneeId, organisationId: ctx.organisationId, isActive: true } })))
    throw new ValidationError("The assignee must be an active member", { assigneeId: ["Not a member"] });
  const deps = (d.dependsOnIds ?? []).filter((x) => x && x !== selfId);
  if (deps.length) {
    const found = await prisma.task.count({ where: { id: { in: deps }, organisationId: ctx.organisationId } });
    if (found !== deps.length) throw new ValidationError("Invalid dependency", { dependsOnIds: ["Not found"] });
    if (selfId) {
      // Prevent simple cycles: a dependency must not (transitively) depend on this task.
      const visited = new Set<string>();
      let frontier = deps;
      while (frontier.length) {
        if (frontier.includes(selfId)) throw new ValidationError("This would create a circular dependency", { dependsOnIds: ["Circular dependency"] });
        frontier.forEach((f) => visited.add(f));
        const next = await prisma.taskDependency.findMany({ where: { taskId: { in: frontier } }, select: { dependsOnId: true } });
        frontier = next.map((n) => n.dependsOnId).filter((n) => !visited.has(n));
      }
    }
  }
  return deps;
}

export async function saveTask(ctx: OrgContext, id: string | null, input: unknown) {
  assertCan(ctx, "task.write");
  const data = parseInput(taskSchema, input);
  const deps = await validateTaskRefs(ctx, data, id);
  const { dependsOnIds: _d, ...values } = data;
  const before = id ? ensureOwned(ctx, await prisma.task.findUnique({ where: { id } }), "Task") : null;
  if (values.status === "DONE" && before?.status !== "DONE") {
    const blocking = await prisma.task.count({ where: { id: { in: deps }, status: { notIn: ["DONE", "CANCELLED"] } } });
    if (blocking) throw new ValidationError("Complete the tasks this one depends on first", { status: ["Has open dependencies"] });
  }
  const task = await prisma.$transaction(async (tx) => {
    const t = before
      ? await tx.task.update({
          where: { id: before.id },
          data: { ...values, completedAt: values.status === "DONE" ? (before.completedAt ?? new Date()) : null, reminderSentAt: values.reminderAt?.getTime() !== before.reminderAt?.getTime() ? null : before.reminderSentAt },
        })
      : await tx.task.create({ data: { ...values, organisationId: ctx.organisationId, createdById: ctx.user.id, completedAt: values.status === "DONE" ? new Date() : null } });
    if (data.dependsOnIds) {
      await tx.taskDependency.deleteMany({ where: { taskId: t.id } });
      for (const dep of deps) await tx.taskDependency.create({ data: { taskId: t.id, dependsOnId: dep } });
    }
    await audit(
      actorOf(ctx),
      before
        ? { action: "task.update", entityType: "Task", entityId: t.id, summary: `Updated task ${t.title}`, metadata: diff(before, values) }
        : { action: "task.create", entityType: "Task", entityId: t.id, summary: `Created task ${t.title}` },
      tx,
    );
    return t;
  });
  if (task.assigneeId && task.assigneeId !== ctx.user.id && task.assigneeId !== before?.assigneeId) {
    await notify(ctx.organisationId, task.assigneeId, { type: "task.assigned", title: `Task assigned to you: ${task.title}`, link: `/admin/tasks/${task.id}` });
  }
  return task;
}

export async function setTaskStatus(ctx: OrgContext, id: string, status: (typeof TASK_STATUSES)[number]) {
  assertCan(ctx, "task.write");
  const t = ensureOwned(ctx, await prisma.task.findUnique({ where: { id }, include: { dependsOn: true } }), "Task");
  if (status === "DONE") {
    const blocking = await prisma.task.count({ where: { id: { in: t.dependsOn.map((d) => d.dependsOnId) }, status: { notIn: ["DONE", "CANCELLED"] } } });
    if (blocking) throw new ValidationError("Complete the tasks this one depends on first");
  }
  await prisma.task.update({ where: { id }, data: { status, completedAt: status === "DONE" ? new Date() : null } });
  await audit(actorOf(ctx), { action: "task.status", entityType: "Task", entityId: id, summary: `Task ${t.title}: ${t.status} → ${status}` });
  if (t.createdById && t.createdById !== ctx.user.id && status === "DONE") {
    await notify(ctx.organisationId, t.createdById, { type: "task.completed", title: `Task completed: ${t.title}`, link: `/admin/tasks/${id}` });
  }
}

export async function deleteTask(ctx: OrgContext, id: string) {
  assertCan(ctx, "task.write");
  const t = ensureOwned(ctx, await prisma.task.findUnique({ where: { id } }), "Task");
  await prisma.task.delete({ where: { id } });
  await audit(actorOf(ctx), { action: "task.delete", entityType: "Task", entityId: id, summary: `Deleted task ${t.title}` });
}

export async function addComment(ctx: OrgContext, entityType: "Task" | "Project" | "Report", entityId: string, body: string) {
  const text = body.trim();
  if (!text) throw new ValidationError("Comment cannot be empty", { body: ["Required"] });
  if (text.length > 5000) throw new ValidationError("Comment is too long", { body: ["Maximum 5000 characters"] });
  assertCan(ctx, entityType === "Task" ? "task.read" : entityType === "Project" ? "project.read" : "report.read");
  const exists =
    entityType === "Task"
      ? await prisma.task.findFirst({ where: { id: entityId, organisationId: ctx.organisationId } })
      : entityType === "Project"
        ? await prisma.project.findFirst({ where: { id: entityId, organisationId: ctx.organisationId } })
        : await prisma.report.findFirst({ where: { id: entityId, organisationId: ctx.organisationId } });
  if (!exists) throw new NotFoundError();
  const c = await prisma.comment.create({ data: { organisationId: ctx.organisationId, entityType, entityId, authorId: ctx.user.id, body: text } });
  if (entityType === "Task") {
    const t = exists as { assigneeId: string | null; title: string };
    if (t.assigneeId && t.assigneeId !== ctx.user.id) await notify(ctx.organisationId, t.assigneeId, { type: "task.comment", title: `New comment on ${t.title}`, link: `/admin/tasks/${entityId}` });
  }
  return c;
}

// ---------------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------------

const milestoneSchema = z.object({
  title: zText(200),
  description: zOptText(2000),
  dueDate: zOptDate,
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "MISSED"]).default("PENDING"),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});

export async function saveMilestone(ctx: OrgContext, projectId: string, id: string | null, input: unknown) {
  assertCan(ctx, "project.write");
  ensureOwned(ctx, await prisma.project.findUnique({ where: { id: projectId } }), "Project");
  const data = parseInput(milestoneSchema, input);
  if (id) {
    const before = await prisma.milestone.findFirst({ where: { id, projectId, organisationId: ctx.organisationId } });
    if (!before) throw new NotFoundError("Milestone");
    const m = await prisma.milestone.update({ where: { id }, data: { ...data, completedAt: data.status === "COMPLETED" ? (before.completedAt ?? new Date()) : null } });
    await audit(actorOf(ctx), { action: "milestone.update", entityType: "Project", entityId: projectId, summary: `Updated milestone ${m.title}`, metadata: diff(before, data) });
    return m;
  }
  const m = await prisma.milestone.create({ data: { ...data, projectId, organisationId: ctx.organisationId, completedAt: data.status === "COMPLETED" ? new Date() : null } });
  await audit(actorOf(ctx), { action: "milestone.create", entityType: "Project", entityId: projectId, summary: `Added milestone ${m.title}` });
  return m;
}

export async function deleteMilestone(ctx: OrgContext, projectId: string, id: string) {
  assertCan(ctx, "project.write");
  const m = await prisma.milestone.findFirst({ where: { id, projectId, organisationId: ctx.organisationId } });
  if (!m) throw new NotFoundError("Milestone");
  await prisma.milestone.delete({ where: { id } });
  await audit(actorOf(ctx), { action: "milestone.delete", entityType: "Project", entityId: projectId, summary: `Deleted milestone ${m.title}` });
}

export async function upcomingMilestones(ctx: OrgContext, days = 45) {
  if (!can(ctx, "project.read")) return [];
  return prisma.milestone.findMany({
    where: { organisationId: ctx.organisationId, status: { in: ["PENDING", "IN_PROGRESS"] }, dueDate: { lte: new Date(Date.now() + days * 86400000) } },
    orderBy: { dueDate: "asc" },
    take: 8,
    include: { project: { select: { id: true, title: true } } },
  });
}

export async function taskOptions(ctx: OrgContext, excludeId?: string) {
  return prisma.task.findMany({
    where: { organisationId: ctx.organisationId, status: { notIn: ["CANCELLED"] }, ...(excludeId ? { id: { not: excludeId } } : {}) },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, title: true },
  });
}
