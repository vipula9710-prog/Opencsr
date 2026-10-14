import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { prisma } from "@/server/db";
import { resolvePublicOrganisation } from "@/server/services/public-site";
import { publicPostWhere } from "@/server/services/blog";
import { publishedSlugs } from "@/server/services/website";

export const dynamic = "force-dynamic";

async function base() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const app = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  if (!host) return app;
  try {
    if (new URL(app).host === host) return app;
  } catch {}
  return `${h.get("x-forwarded-proto") ?? "https"}://${host}`;
}

/** Only published, public content is listed. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const org = await resolvePublicOrganisation();
  if (!org) return [];
  const url = await base();
  const [pages, projects, posts, reports] = await Promise.all([
    publishedSlugs(org.id),
    prisma.project.findMany({ where: { organisationId: org.id, isPublic: true, status: { notIn: ["DRAFT", "ARCHIVED"] } }, select: { slug: true, updatedAt: true } }),
    prisma.blogPost.findMany({ where: publicPostWhere(org.id), select: { slug: true, updatedAt: true, canonicalUrl: true } }),
    prisma.report.findMany({ where: { organisationId: org.id, status: "PUBLISHED", isPublic: true }, select: { id: true, updatedAt: true } }),
  ]);
  return [
    ...pages.map((p) => ({ url: p.kind === "HOME" ? `${url}/` : `${url}/${p.slug}`, lastModified: p.publishedAt ?? undefined })),
    { url: `${url}/projects` },
    { url: `${url}/blog` },
    { url: `${url}/reports` },
    { url: `${url}/contact` },
    ...projects.map((p) => ({ url: `${url}/projects/${p.slug}`, lastModified: p.updatedAt })),
    ...posts.filter((p) => !p.canonicalUrl).map((p) => ({ url: `${url}/blog/${p.slug}`, lastModified: p.updatedAt })),
    ...reports.map((r) => ({ url: `${url}/reports/${r.id}`, lastModified: r.updatedAt })),
  ];
}
