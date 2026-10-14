import { revalidatePath, revalidateTag } from "next/cache";

export const siteTag = (organisationId: string) => `site:${organisationId}`;

/** Invalidate cached public-website data for an organisation. Safe outside a request. */
export function invalidateSite(organisationId: string) {
  try {
    revalidateTag(siteTag(organisationId));
    revalidatePath("/", "layout");
  } catch {
    // Not running inside a Next.js request (e.g. CLI scripts or tests).
  }
}

export function safeRevalidatePath(path: string, type?: "page" | "layout") {
  try {
    revalidatePath(path, type);
  } catch {
    // ignore outside Next.js runtime
  }
}
