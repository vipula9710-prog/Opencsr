import "server-only";
import { NextResponse } from "next/server";
import { AppError } from "./errors";
import { logger } from "./logger";

/** CSRF protection for route handlers: the Origin (or Referer) must match the host. */
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin") ?? req.headers.get("referer");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin || !host) throw new AppError("Cross-site request blocked", "FORBIDDEN");
  try {
    if (new URL(origin).host !== host.split(",")[0]!.trim()) throw new Error("mismatch");
  } catch {
    throw new AppError("Cross-site request blocked", "FORBIDDEN");
  }
}

const STATUS: Record<AppError["code"], number> = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  UNAUTHENTICATED: 401,
  VALIDATION: 400,
  CONFLICT: 409,
  RATE_LIMITED: 429,
};

export function errorResponse(err: unknown) {
  if (err instanceof AppError) return NextResponse.json({ error: err.message, fieldErrors: err.fieldErrors }, { status: STATUS[err.code] });
  logger.error("route handler failed", { err });
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}

/** Headers for serving stored files safely. */
export function fileHeaders(asset: { mimeType: string; filename: string; size: number }, opts: { download?: boolean; cache: "public" | "private" }) {
  const inline = !opts.download && (asset.mimeType.startsWith("image/") || asset.mimeType === "application/pdf");
  return {
    "Content-Type": asset.mimeType,
    "Content-Length": String(asset.size),
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${asset.filename.replace(/"/g, "")}"`,
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    "Cache-Control": opts.cache === "public" ? "public, max-age=3600, stale-while-revalidate=86400" : "private, no-store",
  };
}
