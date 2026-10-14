import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runJobs } from "@/server/jobs";

export const dynamic = "force-dynamic";

/** Trigger background jobs from an external scheduler (e.g. Railway cron). */
export async function POST(req: Request) {
  const secret = process.env.JOBS_SECRET;
  if (!secret || secret.length < 16) return NextResponse.json({ error: "JOBS_SECRET is not configured" }, { status: 503 });
  const given = Buffer.from((req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, ""));
  const expected = Buffer.from(secret);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const result = await runJobs();
  return NextResponse.json(result);
}
