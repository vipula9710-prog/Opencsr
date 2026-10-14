import { NextResponse, type NextRequest } from "next/server";
import { getOrgContext } from "@/server/auth/session";
import { authorisePrivateFile, readAsset } from "@/server/services/media";
import { errorResponse, fileHeaders } from "@/server/http";
import { NotFoundError, UnauthenticatedError } from "@/server/errors";

export const dynamic = "force-dynamic";

/** Authenticated, authorised access to private files. An unguessable URL is never enough. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getOrgContext();
    if (!ctx) throw new UnauthenticatedError();
    const { id } = await params;
    const asset = await authorisePrivateFile(ctx, id);
    const data = await readAsset(asset);
    if (!data) throw new NotFoundError("File");
    return new NextResponse(new Uint8Array(data), { headers: fileHeaders(asset, { download: req.nextUrl.searchParams.has("download"), cache: "private" }) });
  } catch (err) {
    return errorResponse(err);
  }
}
