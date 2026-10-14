import type { OrgContext } from "@/server/context";
import { prisma } from "@/server/db";
import { projectOptions } from "@/server/services/projects";
import { partnerOptions } from "@/server/services/partners";
import { listAssignableUsers } from "@/server/services/users";
import { taskOptions } from "@/server/services/tasks";

export async function taskFormOptions(ctx: OrgContext, excludeId?: string) {
  const [projects, partners, users, tasks, milestones] = await Promise.all([
    projectOptions(ctx),
    partnerOptions(ctx),
    listAssignableUsers(ctx),
    taskOptions(ctx, excludeId),
    prisma.milestone.findMany({ where: { organisationId: ctx.organisationId, status: { not: "COMPLETED" } }, include: { project: { select: { title: true } } }, orderBy: { dueDate: "asc" }, take: 200 }),
  ]);
  return {
    projects: projects.map((p) => ({ id: p.id, name: p.title })),
    partners,
    users,
    tasks: tasks.map((t) => ({ id: t.id, name: t.title })),
    milestones: milestones.map((m) => ({ id: m.id, name: `${m.project.title}: ${m.title}` })),
  };
}
