import { NextResponse } from "next/server";
import { resolvePublicOrganisation } from "@/server/services/public-site";
import { getPublicReport, renderReportPdf } from "@/server/services/reports";
import { slugify } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const org = await resolvePublicOrganisation();
  if (!org) return new NextResponse("Not found", { status: 404 });
  const r = await getPublicReport(org.id, (await params).id);
  if (!r) return new NextResponse("Not found", { status: 404 });
  const pdf = await renderReportPdf(null, r.report, r.data);
  return new NextResponse(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${slugify(r.report.title) || "report"}.pdf"` } });
}
