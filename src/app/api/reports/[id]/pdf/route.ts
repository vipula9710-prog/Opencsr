import { NextResponse } from "next/server";
import { getOrgContext } from "@/server/auth/session";
import { getReport, renderReportPdf } from "@/server/services/reports";
import { errorResponse } from "@/server/http";
import { UnauthenticatedError } from "@/server/errors";
import { slugify } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getOrgContext();
    if (!ctx) throw new UnauthenticatedError();
    const { id } = await params;
    const { report, data } = await getReport(ctx, id);
    const pdf = await renderReportPdf(ctx, report, data);
    return new NextResponse(new Uint8Array(pdf), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${slugify(report.title) || "report"}.pdf"`, "Cache-Control": "private, no-store" },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
