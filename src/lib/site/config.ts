import { z } from "zod";
import { EMPTY_IMAGE, zButton, zHref, zImage } from "./links";

const str = (max = 200) => z.string().trim().max(max).default("");

export const SOCIAL_PLATFORMS = ["facebook", "x", "instagram", "linkedin", "youtube", "website"] as const;

export const siteConfigSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  identity: z.object({
    siteName: z.string().trim().min(1, "Required").max(120),
    tagline: str(200),
    logo: zImage.default(EMPTY_IMAGE),
    favicon: zImage.default(EMPTY_IMAGE),
    showSiteName: z.boolean().default(true),
  }),
  header: z.object({
    layout: z.enum(["logo-left", "logo-center", "split"]).default("logo-left"),
    navAlign: z.enum(["left", "center", "right"]).default("right"),
    sticky: z.boolean().default(true),
    showTagline: z.boolean().default(false),
    logoHeight: z.coerce.number().int().min(24).max(96).default(44),
    cta: z.object({ enabled: z.boolean().default(false), label: str(40), href: zHref.default("") }).default({}),
  }),
  footer: z.object({
    layout: z.enum(["columns", "simple", "centered"]).default("columns"),
    about: str(600),
    columns: z
      .array(z.object({ title: str(60), body: str(600) }))
      .max(4)
      .default([]),
    showNavigation: z.boolean().default(true),
    showContact: z.boolean().default(true),
    contact: z.object({ email: str(200), phone: str(60), address: str(400) }).default({}),
    social: z
      .array(z.object({ platform: z.enum(SOCIAL_PLATFORMS), url: zHref }))
      .max(8)
      .default([]),
    legalLinks: z.array(zButton).max(6).default([]),
    copyright: str(200),
  }),
  blog: z.object({
    layout: z.enum(["grid", "list", "featured"]).default("grid"),
    columns: z.coerce.number().int().min(1).max(4).default(3),
    sidebar: z.boolean().default(false),
    cardStyle: z.enum(["elevated", "bordered", "minimal"]).default("elevated"),
    imageAspect: z.enum(["16/9", "4/3", "3/2", "1/1"]).default("16/9"),
    showCategories: z.boolean().default(true),
    showAuthor: z.boolean().default(true),
    showDate: z.boolean().default(true),
    showReadingTime: z.boolean().default(true),
    showRelated: z.boolean().default(true),
    showShare: z.boolean().default(true),
    articleWidth: z.enum(["narrow", "normal", "wide"]).default("narrow"),
    articleFontSize: z.enum(["sm", "md", "lg"]).default("md"),
    postsPerPage: z.coerce.number().int().min(3).max(48).default(9),
  }),
  seo: z.object({
    titleTemplate: z
      .string()
      .trim()
      .max(120)
      .refine((v) => v === "" || v.includes("%s"), "Must contain %s where the page title goes")
      .default(""),
    description: str(300),
    ogImage: zImage.default(EMPTY_IMAGE),
    noIndex: z.boolean().default(false),
  }),
  pages: z
    .object({
      projects: z.object({ title: str(120), intro: str(600) }).default({}),
      blog: z.object({ title: str(120), intro: str(600) }).default({}),
      reports: z.object({ title: str(120), intro: str(600) }).default({}),
      contact: z.object({ title: str(120), intro: str(600) }).default({}),
    })
    .default({}),
});

export type SiteConfig = z.infer<typeof siteConfigSchema>;

export function defaultSiteConfig(org: {
  name: string;
  tagline?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
}): SiteConfig {
  return siteConfigSchema.parse({
    identity: { siteName: org.name, tagline: org.tagline ?? "" },
    header: { cta: { enabled: true, label: "Contact us", href: "/contact" } },
    footer: {
      about: org.tagline ?? "",
      contact: { email: org.email ?? "", phone: org.phone ?? "", address: org.address ?? "" },
      legalLinks: [
        { label: "Privacy policy", href: "/privacy" },
        { label: "Terms of use", href: "/terms" },
      ],
      copyright: `© ${new Date().getFullYear()} ${org.name}. All rights reserved.`,
    },
    blog: {},
    seo: { titleTemplate: `%s | ${org.name}`, description: org.tagline ?? "" },
    pages: {
      projects: { title: "Our projects", intro: "" },
      blog: { title: "News & stories", intro: "" },
      reports: { title: "Reports & documents", intro: "" },
      contact: { title: "Contact us", intro: "" },
    },
  });
}

/** Parse stored config, falling back to defaults for invalid stored data. */
export function coerceSiteConfig(input: unknown, fallback: SiteConfig): SiteConfig {
  const parsed = siteConfigSchema.safeParse(input);
  return parsed.success ? parsed.data : fallback;
}

/** Navigation item as stored in a published snapshot. */
export type NavSnapshotItem = {
  id: string;
  location: "HEADER" | "FOOTER";
  label: string;
  href: string;
  openInNewTab: boolean;
  children: NavSnapshotItem[];
};
