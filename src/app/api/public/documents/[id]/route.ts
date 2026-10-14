import { NextResponse } from "next/server";
import { resolvePublicOrganisation } from "@/server/services/public-site";
import { getPublicDocumentFile } from "@/server/services/documents";
import { readAsset } from "@/server/services/media";
import { fileHeaders } from "@/server/http";

export const dynamic = "force-dynamic";

/** Public download of an APPROVED document whose visibility is PUBLIC. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const org = await resolvePublicOrganisation();
  if (!org) return new NextResponse("Not found", { status: 404 });
  try {
    const { asset } = await getPublicDocumentFile(org.id, id);
    const data = await readAsset(asset);
    if (!data) return new NextResponse("Not found", { status: 404 });
    return new NextResponse(new Uint8Array(data), { headers: fileHeaders(asset, { cache: "public" }) });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
