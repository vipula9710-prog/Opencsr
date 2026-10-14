import { NextResponse, type NextRequest } from "next/server";
import { getOrgContext } from "@/server/auth/session";
import { errorResponse } from "@/server/http";
import { NotFoundError, UnauthenticatedError } from "@/server/errors";
import { exportProjectsCsv } from "@/server/services/projects";
import { exportPartnersCsv } from "@/server/services/partners";
import { exportImpactCsv } from "@/server/services/impact";
import { exportEnquiriesCsv } from "@/server/services/enquiries";
import { exportAuditCsv } from "@/server/services/audit-logs";
import { exportBudgetCsv } from "@/server/services/finance";

export const dynamic = "force-dynamic";

/** CSV exports. Every exporter enforces its own permission and organisation scope. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  try {
    const ctx = await getOrgContext();
    if (!ctx) throw new UnauthenticatedError();
    const { kind } = await params;
    const exporters: Record<string, () => Promise<string>> = {
      projects: () => exportProjectsCsv(ctx),
      partners: () => exportPartnersCsv(ctx),
      impact: () => exportImpactCsv(ctx),
      enquiries: () => exportEnquiriesCsv(ctx),
      audit: () => exportAuditCsv(ctx),
      budget: () => exportBudgetCsv(ctx, req.nextUrl.searchParams.get("planId") ?? ""),
    };
    const fn = exporters[kind];
    if (!fn) throw new NotFoundError("Export");
    const csv = await fn();
    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse("﻿" + csv, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${ctx.organisation.slug}-${kind}-${date}.csv"`, "Cache-Control": "private, no-store" },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
