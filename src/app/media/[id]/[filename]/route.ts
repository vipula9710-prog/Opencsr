import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { readAsset } from "@/server/services/media";
import { fileHeaders } from "@/server/http";

export const dynamic = "force-dynamic";

/** Public media. Only assets explicitly marked PUBLIC and not attached to documents are served. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const asset = await prisma.mediaAsset.findFirst({ where: { id, visibility: "PUBLIC", documentVersions: { none: {} } } });
  if (!asset) return new NextResponse("Not found", { status: 404 });
  const data = await readAsset(asset);
  if (!data) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(data), { headers: fileHeaders(asset, { cache: "public" }) });
}
