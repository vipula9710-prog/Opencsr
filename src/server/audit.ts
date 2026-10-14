import type { Prisma } from "@prisma/client";
import { prisma, type Tx } from "./db";

export type AuditActor = { userId: string | null; organisationId: string | null; ip?: string | null };

const SECRET_KEYS = /password|token|secret|hash|apikey|api_key|authorization/i;

function scrub(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((v) => scrub(v, depth + 1));
  if (typeof value === "object") {
    if (value instanceof Date) return value.toISOString();
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEYS.test(k) ? "[redacted]" : scrub(v, depth + 1);
    }
    return out;
  }
  if (typeof value === "bigint") return value.toString();
  return value;
}

/** Compute a shallow diff between two records for audit metadata. */
export function diff(before: Record<string, unknown> | null, after: Record<string, unknown>) {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(after)) {
    if (SECRET_KEYS.test(key)) continue;
    const a = before?.[key];
    const b = after[key];
    const norm = (v: unknown) => (v instanceof Date ? v.toISOString() : v?.toString?.() ?? v);
    if (JSON.stringify(norm(a)) !== JSON.stringify(norm(b))) changes[key] = { from: norm(a), to: norm(b) };
  }
  return changes;
}

export async function audit(
  actor: AuditActor,
  entry: {
    action: string;
    entityType: string;
    entityId?: string | null;
    summary: string;
    metadata?: Record<string, unknown>;
  },
  tx: Tx = prisma,
) {
  await tx.auditLog.create({
    data: {
      organisationId: actor.organisationId,
      actorId: actor.userId,
      ipAddress: actor.ip ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      summary: entry.summary.slice(0, 500),
      metadata: entry.metadata ? (scrub(entry.metadata) as Prisma.InputJsonValue) : undefined,
    },
  });
}
