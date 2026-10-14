import { NextResponse, type NextRequest } from "next/server";
import { getOrgContext } from "@/server/auth/session";
import { listMedia, publicMediaUrl } from "@/server/services/media";
import { listQuerySchema } from "@/server/services/common";
import { errorResponse } from "@/server/http";
import { UnauthenticatedError } from "@/server/errors";

export const dynamic = "force-dynamic";

/** JSON list of media for the picker (organisation-scoped). */
export async function GET(req: NextRequest) {
  try {
    const ctx = await getOrgContext();
    if (!ctx) throw new UnauthenticatedError();
    const sp = Object.fromEntries(req.nextUrl.searchParams);
    const q = listQuerySchema.parse({ ...sp, pageSize: 60 });
    const result = await listMedia(ctx, { ...q, kind: sp.kind, visibility: sp.visibility });
    return NextResponse.json({
      items: result.items.map((m) => ({ id: m.id, url: publicMediaUrl(m), alt: m.altText ?? "", filename: m.filename, mimeType: m.mimeType, width: m.width, height: m.height, visibility: m.visibility })),
      total: result.total,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
