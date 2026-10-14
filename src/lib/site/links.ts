import { z } from "zod";

/** Only allow safe link destinations: site-relative paths, anchors, http(s), mailto and tel. */
export function isSafeHref(href: string): boolean {
  const v = href.trim();
  if (v === "") return true;
  if (v.startsWith("//")) return false;
  if (v.startsWith("/") || v.startsWith("#")) return !/[\s<>"']/.test(v);
  return /^(https?:\/\/[^\s<>"']+|mailto:[^\s<>"']+|tel:[+\d\s()-]+)$/i.test(v);
}

export function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href);
}

export const zHref = z
  .string()
  .trim()
  .max(500)
  .refine(isSafeHref, "Use a path like /about, an anchor like #contact, or a full https:// URL");

/** Image references: uploaded media (/media/...), bundled assets (/demo/..., /images/...), or https URLs. */
export function isSafeImageUrl(url: string): boolean {
  const v = url.trim();
  if (v === "") return true;
  if (/^\/(media|demo|images)\/[A-Za-z0-9._\-/%]+$/.test(v)) return !v.includes("..");
  return /^https:\/\/[^\s<>"']+$/i.test(v);
}

export const zImage = z.object({
  url: z.string().trim().max(500).refine(isSafeImageUrl, "Choose an image from the media library"),
  alt: z.string().trim().max(300).default(""),
  mediaId: z.string().max(60).nullable().optional(),
});

export type ImageRef = z.infer<typeof zImage>;
export const EMPTY_IMAGE: ImageRef = { url: "", alt: "", mediaId: null };

export const zButton = z.object({
  label: z.string().trim().max(60).default(""),
  href: zHref.default(""),
});

export type ButtonRef = z.infer<typeof zButton>;

/** Routes that custom pages can never claim. */
export const RESERVED_SLUGS = new Set([
  "admin", "api", "blog", "projects", "reports", "contact", "login", "logout", "setup", "preview",
  "media", "files", "sitemap.xml", "robots.txt", "rss.xml", "feed", "_next", "static", "public",
  "favicon.ico", "health", "account", "reset-password", "forgot-password", "demo", "images", "home", "index",
]);

/** System routes that navigation items can point to. */
export const SYSTEM_ROUTES = [
  { value: "/", label: "Homepage" },
  { value: "/projects", label: "Projects" },
  { value: "/blog", label: "Blog" },
  { value: "/reports", label: "Reports" },
  { value: "/contact", label: "Contact" },
] as const;
