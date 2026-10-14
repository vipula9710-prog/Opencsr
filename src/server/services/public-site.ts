import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { cookies, draftMode, headers } from "next/headers";
import { prisma } from "../db";
import { siteTag } from "../cache";
import { getOrgContext } from "../auth/session";
import { can } from "../context";
import { loadDraftPage, loadDraftSite, loadPublishedPage, loadPublishedSite, type RenderableSite } from "./website";
import { publicPostWhere } from "./blog";
import { issueFormToken } from "./enquiries";
import { publicMediaUrl } from "./media";
import { indicatorProgress } from "./impact";
import type { SectionData } from "@/lib/site/section-data";
import type { SectionInstance } from "@/lib/site/sections";

export const PREVIEW_COOKIE = "opencsr_preview";

/** Resolve which organisation's public website to serve for this request. */
export const resolvePublicOrganisation = cache(async () => {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").toLowerCase().split(",")[0]!.trim();
  if (host) {
    const byDomain = await prisma.websiteSettings.findUnique({ where: { domain: host }, select: { organisation: true } });
    if (byDomain?.organisation && !byDomain.organisation.archivedAt) return byDomain.organisation;
  }
  const slug = process.env.DEFAULT_ORGANISATION_SLUG;
  if (slug) {
    const bySlug = await prisma.organisation.findUnique({ where: { slug } });
    if (bySlug && !bySlug.archivedAt) return bySlug;
  }
  const settings = await prisma.siteSettings.findUnique({ where: { id: 1 } });
  if (settings?.defaultOrganisationId) {
    const def = await prisma.organisation.findUnique({ where: { id: settings.defaultOrganisationId } });
    if (def && !def.archivedAt) return def;
  }
  return prisma.organisation.findFirst({ where: { archivedAt: null }, orderBy: { createdAt: "asc" } });
});

const cachedPublishedSite = (organisationId: string) =>
  unstable_cache(() => loadPublishedSite(organisationId), ["published-site", organisationId], { tags: [siteTag(organisationId)], revalidate: 3600 })();

/**
 * Returns the site to render. Draft content is only returned when Next.js
 * draft mode is on AND the signed-in user has website.edit permission in the
 * organisation being previewed. Anonymous visitors always get the published site.
 */
export const getRequestSite = cache(async (): Promise<{ site: RenderableSite; organisation: NonNullable<Awaited<ReturnType<typeof resolvePublicOrganisation>>>; preview: boolean } | null> => {
  const dm = await draftMode();
  if (dm.isEnabled) {
    const jar = await cookies();
    const ctx = await getOrgContext();
    if (ctx && can(ctx, "website.edit") && jar.get(PREVIEW_COOKIE)?.value === ctx.organisationId) {
      return { site: await loadDraftSite(ctx), organisation: ctx.organisation, preview: true };
    }
  }
  const org = await resolvePublicOrganisation();
  if (!org) return null;
  const site = await cachedPublishedSite(org.id);
  if (!site) return null;
  return { site, organisation: org, preview: false };
});

export async function getRequestPage(slug: string | null) {
  const req = await getRequestSite();
  if (!req) return null;
  if (req.preview) {
    const ctx = await getOrgContext();
    if (ctx) return loadDraftPage(ctx, slug);
  }
  return unstable_cache(() => loadPublishedPage(req.organisation.id, slug), ["published-page", req.organisation.id, slug ?? "__home"], {
    tags: [siteTag(req.organisation.id)],
    revalidate: 3600,
  })();
}

// ---------------------------------------------------------------------------
// Public data for sections and system pages
// ---------------------------------------------------------------------------

export async function publicProjects(organisationId: string, opts: { take?: number; ids?: string[]; focusAreaSlug?: string } = {}) {
  const projects = await prisma.project.findMany({
    where: {
      organisationId,
      isPublic: true,
      status: { notIn: ["DRAFT", "ARCHIVED"] },
      ...(opts.ids?.length ? { id: { in: opts.ids } } : {}),
      ...(opts.focusAreaSlug ? { focusArea: { slug: opts.focusAreaSlug } } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: opts.take ?? 100,
    include: { focusArea: { select: { name: true } }, coverImage: true },
  });
  const mapped = projects.map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    summary: p.publicSummary ?? p.summary,
    status: p.status,
    location: p.location,
    focusArea: p.focusArea?.name ?? null,
    coverUrl: p.coverImage && p.coverImage.visibility === "PUBLIC" ? publicMediaUrl(p.coverImage) : null,
    coverAlt: p.coverImage?.altText ?? "",
  }));
  if (opts.ids?.length) return opts.ids.map((id) => mapped.find((m) => m.id === id)).filter(Boolean) as typeof mapped;
  return mapped;
}

export async function publicPosts(organisationId: string, opts: { take?: number; skip?: number; categorySlug?: string; tagSlug?: string; q?: string; excludeId?: string } = {}) {
  const where = {
    AND: [
      publicPostWhere(organisationId),
      opts.categorySlug ? { categories: { some: { slug: opts.categorySlug } } } : {},
      opts.tagSlug ? { tags: { some: { slug: opts.tagSlug } } } : {},
      opts.q ? { OR: [{ title: { contains: opts.q, mode: "insensitive" as const } }, { excerpt: { contains: opts.q, mode: "insensitive" as const } }] } : {},
      opts.excludeId ? { id: { not: opts.excludeId } } : {},
    ],
  };
  const [posts, total] = await Promise.all([
    prisma.blogPost.findMany({
      where,
      orderBy: [{ publishedAt: "desc" }, { scheduledFor: "desc" }],
      take: opts.take ?? 10,
      skip: opts.skip ?? 0,
      include: { featuredImage: true, author: { select: { name: true, id: true } }, categories: { select: { name: true, slug: true } } },
    }),
    prisma.blogPost.count({ where }),
  ]);
  const profiles = await prisma.authorProfile.findMany({ where: { organisationId, userId: { in: posts.map((p) => p.authorId).filter(Boolean) as string[] } } });
  return {
    total,
    posts: posts.map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt,
      publishedAt: (p.publishedAt ?? p.scheduledFor)?.toISOString() ?? null,
      imageUrl: p.featuredImage && p.featuredImage.visibility === "PUBLIC" ? publicMediaUrl(p.featuredImage) : null,
      imageAlt: p.featuredImage?.altText ?? "",
      authorName: profiles.find((a) => a.userId === p.authorId)?.displayName ?? p.author?.name ?? null,
      categories: p.categories,
      readingMinutes: p.readingMinutes,
    })),
  };
}

export async function publicReportItems(organisationId: string, take = 50) {
  const [reports, docs] = await Promise.all([
    prisma.report.findMany({ where: { organisationId, status: "PUBLISHED", isPublic: true }, orderBy: { publishedAt: "desc" }, take }),
    prisma.document.findMany({ where: { organisationId, visibility: "PUBLIC", status: "APPROVED", archivedAt: null }, orderBy: { updatedAt: "desc" }, take }),
  ]);
  const items = [
    ...reports.map((r) => ({ id: r.id, title: r.title, href: `/reports/${r.id}`, date: r.publishedAt?.toISOString() ?? null, label: "Report", description: null as string | null })),
    ...docs.map((d) => ({ id: d.id, title: d.title, href: `/api/public/documents/${d.id}`, date: d.updatedAt.toISOString(), label: d.category.replace(/_/g, " ").toLowerCase(), description: d.description })),
  ];
  return items.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")).slice(0, take);
}

/** Public indicators show the latest VERIFIED value only. */
export async function publicIndicators(organisationId: string) {
  const indicators = await prisma.impactIndicator.findMany({
    where: { organisationId, isPublic: true, archivedAt: null },
    include: { measurements: { where: { verificationStatus: "VERIFIED" }, orderBy: { periodEnd: "desc" }, take: 1 } },
    orderBy: { name: "asc" },
  });
  return indicators
    .filter((i) => i.measurements.length)
    .map((i) => {
      const p = indicatorProgress(i);
      return { id: i.id, name: i.name, unit: i.unit, value: p.verifiedValue!, periodEnd: i.measurements[0]!.periodEnd.toISOString(), definition: i.definition };
    });
}

export async function loadSectionData(
  organisation: { id: string; email: string | null; phone: string | null; address: string | null; enquiryCategories: string[]; isDemo: boolean; demoBannerEnabled: boolean },
  sections: SectionInstance[],
  opts: { preview: boolean; contact?: { email: string; phone: string; address: string } },
): Promise<SectionData> {
  const types = new Set(sections.map((s) => s.type));
  const needProjects = types.has("featuredProjects") || types.has("projectGrid");
  const manualIds = sections.filter((s) => s.type === "featuredProjects" && s.props.mode === "manual").flatMap((s) => (s.props.projectIds as string[]) ?? []);
  const [projects, posts, focusAreas, reports, indicators] = await Promise.all([
    needProjects ? publicProjects(organisation.id, { take: 24 }) : Promise.resolve([]),
    types.has("latestPosts") ? publicPosts(organisation.id, { take: 9 }).then((r) => r.posts) : Promise.resolve([]),
    types.has("focusAreas")
      ? prisma.focusArea.findMany({ where: { organisationId: organisation.id, isPublic: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, slug: true, description: true, icon: true } })
      : Promise.resolve([]),
    types.has("reports") ? publicReportItems(organisation.id, 12) : Promise.resolve([]),
    types.has("impactMetrics") ? publicIndicators(organisation.id) : Promise.resolve([]),
  ]);
  let allProjects = projects;
  if (manualIds.length) {
    const extra = await publicProjects(organisation.id, { ids: manualIds });
    allProjects = [...projects, ...extra.filter((e) => !projects.some((p) => p.id === e.id))];
  }
  return {
    organisationId: organisation.id,
    projects: allProjects,
    posts,
    focusAreas,
    reports,
    indicators,
    contact: opts.contact ?? { email: organisation.email ?? "", phone: organisation.phone ?? "", address: organisation.address ?? "" },
    enquiry: { categories: organisation.enquiryCategories, token: types.has("contact") ? issueFormToken(organisation.id) : "" },
    isDemo: organisation.isDemo || organisation.demoBannerEnabled,
    preview: opts.preview,
  };
}
