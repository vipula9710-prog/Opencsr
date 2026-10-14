import { NextResponse, type NextRequest } from "next/server";
import { draftMode, cookies } from "next/headers";
import { getOrgContext } from "@/server/auth/session";
import { PREVIEW_COOKIE } from "@/server/services/public-site";

export const dynamic = "force-dynamic";

/**
 * Enables draft preview of the public website for signed-in users with
 * website.edit permission. Pages re-check the session on every request, so the
 * cookie alone never grants access to drafts.
 */
export async function GET(req: NextRequest) {
  const ctx = await getOrgContext();
  const path = req.nextUrl.searchParams.get("path") ?? "/";
  const allowed = ctx && (ctx.permissions.has("website.edit") || (ctx.permissions.has("blog.write") && path.startsWith("/blog/")));
  if (!ctx || !allowed) return NextResponse.json({ error: "Not authorised" }, { status: 403 });
  const safePath = path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/admin") && !path.startsWith("/api") ? path : "/";
  (await draftMode()).enable();
  (await cookies()).set(PREVIEW_COOKIE, ctx.organisationId, { httpOnly: true, sameSite: "lax", path: "/", secure: (process.env.APP_URL ?? "").startsWith("https://") });
  return NextResponse.redirect(new URL(safePath, req.nextUrl.origin));
}
