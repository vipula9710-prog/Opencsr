import { Prisma, type ApprovalType } from "@prisma/client";
import { prisma } from "../db";
import { actorOf, assertCan, can, type OrgContext } from "../context";
import { audit } from "../audit";
import { ForbiddenError, NotFoundError, ValidationError } from "../errors";
import { notify, notifyPermission } from "./notifications";

export const APPROVAL_LABELS: Record<ApprovalType, string> = {
  WEBSITE_PUBLISH: "Website publishing",
  REPORT_PUBLISH: "Report publication",
  BUDGET_ALLOCATION: "Budget change",
  PROJECT_STATUS: "Project status change",
  IMPACT_MEASUREMENT: "Impact verification",
};

export async function requestApproval(
  ctx: OrgContext,
  input: { type: ApprovalType; entityId?: string | null; title: string; payload: Record<string, unknown> },
) {
  const pending = await prisma.approval.findFirst({
    where: { organisationId: ctx.organisationId, type: input.type, entityId: input.entityId ?? null, status: "PENDING" },
  });
  if (pending && input.type !== "BUDGET_ALLOCATION") throw new ValidationError("A request for this item is already awaiting approval");
  const approval = await prisma.approval.create({
    data: {
      organisationId: ctx.organisationId,
      type: input.type,
      entityId: input.entityId ?? null,
      title: input.title.slice(0, 300),
      payload: input.payload as Prisma.InputJsonValue,
      requestedById: ctx.user.id,
    },
  });
  await audit(actorOf(ctx), { action: "approval.request", entityType: "Approval", entityId: approval.id, summary: `Requested approval: ${approval.title}` });
  await notifyPermission(ctx.organisationId, "approval.review", { type: "approval.pending", title: `Approval requested: ${approval.title}`, link: `/admin/approvals` }, ctx.user.id);
  return approval;
}

export async function listApprovals(ctx: OrgContext, status: "PENDING" | "DECIDED" = "PENDING") {
  // Requesters can always see their own requests; reviewers see all.
  const where: Prisma.ApprovalWhereInput = {
    organisationId: ctx.organisationId,
    ...(status === "PENDING" ? { status: "PENDING" } : { status: { not: "PENDING" } }),
    ...(can(ctx, "approval.review") ? {} : { requestedById: ctx.user.id }),
  };
  return prisma.approval.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { requestedBy: { select: { name: true } }, decidedBy: { select: { name: true } } },
  });
}

export async function pendingApprovalCount(ctx: OrgContext) {
  if (!can(ctx, "approval.review")) return 0;
  return prisma.approval.count({ where: { organisationId: ctx.organisationId, status: "PENDING" } });
}

/**
 * Approve or reject a request. On approval the requested change is applied
 * using the approver's context; the approval is only marked APPROVED if the
 * change succeeds.
 */
export async function decideApproval(ctx: OrgContext, id: string, decision: "APPROVED" | "REJECTED", note?: string | null) {
  assertCan(ctx, "approval.review");
  const approval = await prisma.approval.findFirst({ where: { id, organisationId: ctx.organisationId } });
  if (!approval) throw new NotFoundError("Approval");
  if (approval.status !== "PENDING") throw new ValidationError("This request has already been decided");
  if (approval.requestedById === ctx.user.id && ctx.role !== "ORG_ADMIN" && ctx.role !== "PLATFORM_ADMIN")
    throw new ForbiddenError("You cannot approve your own request");

  // Claim the request first so two reviewers cannot apply it concurrently.
  const claimed = await prisma.approval.updateMany({
    where: { id, status: "PENDING" },
    data: { status: decision, decidedById: ctx.user.id, decidedAt: new Date(), decisionNote: note ?? null },
  });
  if (claimed.count === 0) throw new ValidationError("This request was decided by someone else");
  try {
    if (decision === "APPROVED") await applyApproval(ctx, approval.type, approval.payload as Record<string, unknown>);
    else if (approval.type === "IMPACT_MEASUREMENT") {
      const { verifyMeasurement } = await import("./impact");
      await verifyMeasurement(ctx, String((approval.payload as Record<string, unknown>).measurementId), "REJECTED", note);
    } else if (approval.type === "REPORT_PUBLISH" && approval.entityId) {
      await prisma.report.updateMany({ where: { id: approval.entityId, organisationId: ctx.organisationId, status: "IN_REVIEW" }, data: { status: "REJECTED" } });
    }
  } catch (err) {
    // The change failed: return the request to pending so it is not shown as approved.
    await prisma.approval.update({ where: { id }, data: { status: "PENDING", decidedById: null, decidedAt: null, decisionNote: null } });
    throw err;
  }
  await audit(actorOf(ctx), { action: `approval.${decision.toLowerCase()}`, entityType: "Approval", entityId: id, summary: `${decision === "APPROVED" ? "Approved" : "Rejected"}: ${approval.title}`, metadata: { note } });
  if (approval.requestedById) {
    await notify(ctx.organisationId, approval.requestedById, {
      type: "approval.decided",
      title: `${decision === "APPROVED" ? "Approved" : "Rejected"}: ${approval.title}`,
      body: note ?? undefined,
      link: "/admin/approvals?view=decided",
    });
  }
}

async function applyApproval(ctx: OrgContext, type: ApprovalType, payload: Record<string, unknown>) {
  switch (type) {
    case "WEBSITE_PUBLISH": {
      const { publishWebsite } = await import("./website");
      if (!can(ctx, "website.publish")) throw new ForbiddenError("Approving website publication requires publishing permission");
      await publishWebsite(ctx, (payload.note as string) ?? "Approved publication", { viaApproval: true });
      return;
    }
    case "REPORT_PUBLISH": {
      const { approveReport } = await import("./reports");
      await approveReport(ctx, String(payload.reportId), Boolean(payload.publish));
      return;
    }
    case "BUDGET_ALLOCATION": {
      if (!can(ctx, "finance.write")) throw new ForbiddenError("Approving budget changes requires finance permissions");
      const { applyAllocation } = await import("./finance");
      await applyAllocation(ctx, payload as never);
      return;
    }
    case "PROJECT_STATUS": {
      const { changeProjectStatus } = await import("./projects");
      await changeProjectStatus(ctx, String(payload.projectId), payload.status as never, (payload.note as string) ?? null, { viaApproval: true });
      return;
    }
    case "IMPACT_MEASUREMENT": {
      const { verifyMeasurement } = await import("./impact");
      await verifyMeasurement(ctx, String(payload.measurementId), "VERIFIED", null);
      return;
    }
  }
}

export async function cancelApproval(ctx: OrgContext, id: string) {
  const approval = await prisma.approval.findFirst({ where: { id, organisationId: ctx.organisationId, status: "PENDING" } });
  if (!approval) throw new NotFoundError("Approval");
  if (approval.requestedById !== ctx.user.id && !can(ctx, "approval.review")) throw new ForbiddenError();
  await prisma.approval.update({ where: { id }, data: { status: "CANCELLED", decidedAt: new Date(), decidedById: ctx.user.id } });
  await audit(actorOf(ctx), { action: "approval.cancel", entityType: "Approval", entityId: id, summary: `Cancelled request: ${approval.title}` });
}
