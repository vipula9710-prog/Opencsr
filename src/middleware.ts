import { NextResponse, type NextRequest } from "next/server";

// Lightweight edge check: redirect anonymous visitors away from /admin early.
// Real authentication and authorisation happen on the server for every request.
export function middleware(req: NextRequest) {
  const hasSession = req.cookies.has("opencsr_session") || req.cookies.has("__Host-opencsr_session");
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(req.nextUrl.pathname)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*", "/print/:path*"] };
