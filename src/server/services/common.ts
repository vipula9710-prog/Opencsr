import { z } from "zod";

export const listQuerySchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10000).catch(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).catch(20).default(20),
  sort: z.string().max(40).optional().catch(undefined),
  dir: z.enum(["asc", "desc"]).catch("desc").default("desc"),
  status: z.string().max(40).optional().catch(undefined),
});

export type ListQuery = z.infer<typeof listQuerySchema>;

export type Paginated<T> = { items: T[]; total: number; page: number; pageSize: number; pageCount: number };

export function parseListQuery(params: Record<string, string | string[] | undefined>): ListQuery & Record<string, string | undefined> {
  const flat: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(params)) flat[k] = Array.isArray(v) ? v[0] : v;
  return { ...flat, ...listQuerySchema.parse(flat) } as ListQuery & Record<string, string | undefined>;
}

export function paged<T>(items: T[], total: number, q: ListQuery): Paginated<T> {
  return { items, total, page: q.page, pageSize: q.pageSize, pageCount: Math.max(1, Math.ceil(total / q.pageSize)) };
}

export function skipTake(q: ListQuery) {
  return { skip: (q.page - 1) * q.pageSize, take: q.pageSize };
}

/** Pick a whitelisted sort field, defaulting when the requested one is not allowed. */
export function sortBy<T extends string>(q: ListQuery, allowed: readonly T[], fallback: T): Record<string, "asc" | "desc"> {
  const field = allowed.includes(q.sort as T) ? (q.sort as T) : fallback;
  return { [field]: q.dir };
}

export function enumOrUndefined<T extends string>(value: string | undefined, values: readonly T[]): T | undefined {
  return values.includes(value as T) ? (value as T) : undefined;
}
