import { prisma } from "../db";
import { can, type OrgContext } from "../context";
import { currentFyStartYear } from "./organisations";
import { financeOverview } from "./finance";
import { upcomingMilestones } from "./tasks";
import { recentActivity } from "./audit-logs";
import { indicatorProgress } from "./impact";
import { pendingApprovalCount } from "./approvals";

/** All dashboard metrics are computed from stored records. Nothing is estimated. */
export async function getDashboard(ctx: OrgContext) {
  const org = ctx.organisationId;
  const fy = currentFyStartYear(ctx.organisation.financialYearStartMonth);
  const canProjects = can(ctx, "project.read");

  const [statusGroups, programmeCount, partnerCount, partnersPending, milestones, pendingApprovals, reportsInReview, activity, posts, enquiries, finance, indicators, myTasks] =
    await Promise.all([
      canProjects ? prisma.project.groupBy({ by: ["status"], where: { organisationId: org }, _count: true }) : Promise.resolve([]),
      can(ctx, "programme.read") ? prisma.programme.count({ where: { organisationId: org, status: "ACTIVE" } }) : Promise.resolve(null),
      can(ctx, "partner.read") ? prisma.partnerOrganisation.count({ where: { organisationId: org, archivedAt: null } }) : Promise.resolve(null),
      can(ctx, "partner.read")
        ? prisma.partnerOrganisation.count({ where: { organisationId: org, archivedAt: null, verificationStatus: { in: ["PENDING_REVIEW", "DOCUMENTS_UPLOADED", "INFORMATION_SUPPLIED"] } } })
        : Promise.resolve(null),
      upcomingMilestones(ctx),
      pendingApprovalCount(ctx),
      can(ctx, "report.approve") ? prisma.report.count({ where: { organisationId: org, status: "IN_REVIEW" } }) : Promise.resolve(0),
      recentActivity(ctx),
      can(ctx, "blog.write")
        ? prisma.blogPost.findMany({ where: { organisationId: org }, orderBy: { updatedAt: "desc" }, take: 5, select: { id: true, title: true, status: true, updatedAt: true } })
        : Promise.resolve([]),
      can(ctx, "enquiry.read")
        ? prisma.enquiry.findMany({ where: { organisationId: org }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, name: true, category: true, status: true, createdAt: true } })
        : Promise.resolve([]),
      financeOverview(ctx, fy),
      can(ctx, "impact.read")
        ? prisma.impactIndicator.findMany({ where: { organisationId: org, archivedAt: null, target: { not: null } }, take: 6, orderBy: { updatedAt: "desc" }, include: { measurements: true } })
        : Promise.resolve([]),
      can(ctx, "task.read")
        ? prisma.task.findMany({ where: { organisationId: org, assigneeId: ctx.user.id, status: { notIn: ["DONE", "CANCELLED"] } }, orderBy: [{ dueDate: "asc" }], take: 6, include: { project: { select: { title: true } } } })
        : Promise.resolve([]),
    ]);

  const byStatus = Object.fromEntries(statusGroups.map((g) => [g.status, g._count])) as Record<string, number>;
  return {
    fyStartYear: fy,
    projects: canProjects
      ? {
          active: byStatus.ACTIVE ?? 0,
          total: Object.values(byStatus).reduce((a, b) => a + b, 0) - (byStatus.ARCHIVED ?? 0),
          byStatus: ["DRAFT", "PLANNED", "ACTIVE", "ON_HOLD", "COMPLETED"].map((s) => ({ status: s, count: byStatus[s] ?? 0 })),
        }
      : null,
    programmeCount,
    partnerCount,
    partnersPending,
    milestones,
    pendingApprovals,
    reportsInReview,
    activity,
    posts,
    enquiries,
    finance,
    indicators: indicators.map((i) => ({ id: i.id, name: i.name, unit: i.unit, target: i.target?.toString() ?? null, progress: indicatorProgress(i) })),
    myTasks,
  };
}
