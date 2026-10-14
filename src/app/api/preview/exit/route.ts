import { NextResponse, type NextRequest } from "next/server";
import { draftMode, cookies } from "next/headers";
import { PREVIEW_COOKIE } from "@/server/services/public-site";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  (await draftMode()).disable();
  (await cookies()).delete(PREVIEW_COOKIE);
  const path = req.nextUrl.searchParams.get("path") ?? "/";
  return NextResponse.redirect(new URL(path.startsWith("/") && !path.startsWith("//") ? path : "/", req.nextUrl.origin));
}
