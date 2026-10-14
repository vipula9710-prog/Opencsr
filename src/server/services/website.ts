import { Prisma, type NavLocation, type NavLinkType } from "@prisma/client";
import { z } from "zod";
import { prisma, type Tx } from "../db";
import { actorOf, assertCan, can, ensureOwned, type OrgContext } from "../context";
import { audit } from "../audit";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../errors";
import { parseInput } from "../validation";
import { sanitizeRichText } from "../sanitize";
import { invalidateSite } from "../cache";
import { coerceTokens, themeTokensSchema, type ThemeTokens } from "@/lib/theme/tokens";
import { defaultTokens, getTemplate, CUSTOM_TEMPLATE_KEY, DEFAULT_TEMPLATE_KEY } from "@/lib/theme/templates";
import { coerceSiteConfig, defaultSiteConfig, siteConfigSchema, type SiteConfig } from "@/lib/site/config";
import {
  getSectionDefinition,
  mapRichText,
  validateSectionProps,
  type SectionInstance,
} from "@/lib/site/sections";
import { RESERVED_SLUGS, SYSTEM_ROUTES, zHref } from "@/lib/site/links";
import { zSlug } from "@/lib/zod-helpers";
import { buildSectionProps, DEFAULT_FOOTER_NAV, DEFAULT_HEADER_NAV, defaultPages } from "./website-defaults";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NavItemSnapshot = {
  id: string;
  location: NavLocation;
  label: string;
  type: NavLinkType;
  pageId: string | null;
  systemRoute: string | null;
  url: string | null;
  parentId: string | null;
  openInNewTab: boolean;
  hidden: boolean;
  sortOrder: number;
  /** Resolved destination at publish time (null when the target is not public). */
  href: string | null;
};

export type PageSnapshot = {
  title: string;
  slug: string;
  kind: string;
  seoTitle: string | null;
  seoDescription: string | null;
  ogImageUrl: string | null;
  sections: SectionInstance[];
};

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

/**
 * Creates the initial website for a new organisation (draft + first published
 * version) so a freshly created organisation has a working public site.
 */
export async function bootstrapWebsite(
  tx: Tx,
  org: { id: string; name: string; tagline?: string | null; email?: string | null; phone?: string | null; address?: string | null },
  opts: { templateKey?: string; actorId?: string | null; tokens?: ThemeTokens } = {},
) {
  const template = getTemplate(opts.templateKey ?? DEFAULT_TEMPLATE_KEY);
  const tokens = opts.tokens ?? structuredClone(template?.tokens ?? defaultTokens());
  const siteConfig = defaultSiteConfig(org);

  await tx.websiteSettings.create({ data: { organisationId: org.id, draftConfig: siteConfig as Prisma.InputJsonValue } });
  await tx.websiteTheme.create({
    data: { organisationId: org.id, templateKey: template?.key ?? CUSTOM_TEMPLATE_KEY, draftTokens: tokens as Prisma.InputJsonValue },
  });

  const pageIds = new Map<string, string>();
  for (const p of defaultPages(org.name)) {
    const page = await tx.page.create({
      data: { organisationId: org.id, title: p.title, slug: p.slug, kind: p.kind, status: "PUBLISHED", seoDescription: p.seoDescription },
    });
    pageIds.set(p.slug, page.id);
    let i = 0;
    for (const s of p.sections) {
      await tx.pageSection.create({
        data: { organisationId: org.id, pageId: page.id, type: s.type, props: buildSectionProps(s) as Prisma.InputJsonValue, sortOrder: i++ },
      });
    }
  }

  let order = 0;
  for (const item of DEFAULT_HEADER_NAV) {
    const parent = await tx.navigationItem.create({
      data: {
        organisationId: org.id,
        location: "HEADER",
        label: item.label,
        type: item.page ? "PAGE" : "SYSTEM",
        pageId: item.page ? pageIds.get(item.page) : null,
        systemRoute: item.system ?? null,
        sortOrder: order++,
      },
    });
    let c = 0;
    for (const child of item.children ?? []) {
      await tx.navigationItem.create({
        data: { organisationId: org.id, location: "HEADER", label: child.label, type: "PAGE", pageId: pageIds.get(child.page), parentId: parent.id, sortOrder: c++ },
      });
    }
  }
  order = 0;
  for (const item of DEFAULT_FOOTER_NAV) {
    await tx.navigationItem.create({
      data: {
        organisationId: org.id,
        location: "FOOTER",
        label: item.label,
        type: item.page ? "PAGE" : "SYSTEM",
        pageId: item.page ? pageIds.get(item.page) : null,
        systemRoute: item.system ?? null,
        sortOrder: order++,
      },
    });
  }

  await publishInTx(tx, org.id, opts.actorId ?? null, "Initial website");
}

// ---------------------------------------------------------------------------
// Reading builder state
// ---------------------------------------------------------------------------

async function loadTheme(tx: Tx, organisationId: string) {
  const theme = await tx.websiteTheme.findUnique({ where: { organisationId }, include: { publishedVersion: true } });
  const settings = await tx.websiteSettings.findUnique({ where: { organisationId } });
  if (!theme || !settings) throw new NotFoundError("Website configuration");
  return { theme, settings };
}

export async function getBuilderState(ctx: OrgContext) {
  assertCan(ctx, "website.edit");
  const { theme, settings } = await loadTheme(prisma, ctx.organisationId);
  const fallbackConfig = defaultSiteConfig(ctx.organisation);
  const pages = await prisma.page.findMany({
    where: { organisationId: ctx.organisationId, status: { not: "ARCHIVED" } },
    orderBy: [{ kind: "asc" }, { title: "asc" }],
    include: { sections: { orderBy: { sortOrder: "asc" } } },
  });
  const navigation = await prisma.navigationItem.findMany({
    where: { organisationId: ctx.organisationId },
    orderBy: [{ location: "asc" }, { sortOrder: "asc" }],
  });
  return {
    templateKey: theme.templateKey,
    tokens: coerceTokens(theme.draftTokens, defaultTokens()),
    siteConfig: coerceSiteConfig(settings.draftConfig, fallbackConfig),
    domain: settings.domain,
    hasUnpublishedChanges: theme.hasUnpublishedChanges || pages.some((p) => p.hasUnpublishedChanges && p.status === "PUBLISHED"),
    publishedAt: theme.publishedAt,
    publishedVersion: theme.publishedVersion?.version ?? null,
    pages: pages.map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      kind: p.kind,
      status: p.status,
      seoTitle: p.seoTitle,
      seoDescription: p.seoDescription,
      hasUnpublishedChanges: p.hasUnpublishedChanges,
      publishedAt: p.publishedAt,
      updatedAt: p.updatedAt,
      sections: p.sections.map((s) => ({ id: s.id, type: s.type, hidden: s.hidden, props: s.props as Record<string, unknown> })),
    })),
    navigation,
  };
}

// ---------------------------------------------------------------------------
// Theme & site configuration drafts
// ---------------------------------------------------------------------------

export async function updateThemeDraft(ctx: OrgContext, input: unknown) {
  assertCan(ctx, "website.edit");
  const tokens = parseInput(themeTokensSchema, input);
  const before = await prisma.websiteTheme.findUnique({ where: { organisationId: ctx.organisationId } });
  if (!before) throw new NotFoundError("Website theme");
  await prisma.websiteTheme.update({
    where: { organisationId: ctx.organisationId },
    data: {
      draftTokens: tokens as Prisma.InputJsonValue,
      hasUnpublishedChanges: true,
      templateKey: before.templateKey === CUSTOM_TEMPLATE_KEY ? CUSTOM_TEMPLATE_KEY : before.templateKey,
    },
  });
  return tokens;
}

export async function updateSiteConfigDraft(ctx: OrgContext, input: unknown) {
  assertCan(ctx, "website.edit");
  const config = parseInput(siteConfigSchema, input);
  await prisma.$transaction([
    prisma.websiteSettings.update({
      where: { organisationId: ctx.organisationId },
      data: { draftConfig: config as Prisma.InputJsonValue },
    }),
    prisma.websiteTheme.update({ where: { organisationId: ctx.organisationId }, data: { hasUnpublishedChanges: true } }),
  ]);
  return config;
}

export async function updateDomain(ctx: OrgContext, domain: string | null) {
  assertCan(ctx, "org.settings.manage");
  const value = domain?.trim().toLowerCase() || null;
  if (value && !/^[a-z0-9.-]+(:\d+)?$/.test(value)) throw new ValidationError("Enter a host name such as csr.example.org", { domain: ["Invalid host name"] });
  try {
    await prisma.websiteSettings.update({ where: { organisationId: ctx.organisationId }, data: { domain: value } });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") throw new ConflictError("Another organisation already uses this domain", { domain: ["Already in use"] });
    throw err;
  }
  await audit(actorOf(ctx), { action: "website.domain", entityType: "WebsiteSettings", summary: `Website domain set to ${value ?? "(none)"}` });
  invalidateSite(ctx.organisationId);
}

/** Applies a template to the draft after saving the current draft as a backup version. */
export async function applyTemplate(ctx: OrgContext, templateKey: string) {
  assertCan(ctx, "website.edit");
  const template = getTemplate(templateKey);
  if (!template) throw new ValidationError("Unknown template");
  return prisma.$transaction(async (tx) => {
    const { theme, settings } = await loadTheme(tx, ctx.organisationId);
    const nav = await navSnapshot(tx, ctx.organisationId);
    const version = await nextVersion(tx, ctx.organisationId);
    await tx.themeVersion.create({
      data: {
        organisationId: ctx.organisationId,
        version,
        kind: "BACKUP",
        templateKey: theme.templateKey,
        tokens: theme.draftTokens as Prisma.InputJsonValue,
        siteConfig: settings.draftConfig as Prisma.InputJsonValue,
        navigation: nav as unknown as Prisma.InputJsonValue,
        note: `Automatic backup before applying template “${template.name}”`,
        createdById: ctx.user.id,
      },
    });
    await tx.websiteTheme.update({
      where: { organisationId: ctx.organisationId },
      data: { templateKey: template.key, draftTokens: template.tokens as Prisma.InputJsonValue, hasUnpublishedChanges: true },
    });
    await audit(actorOf(ctx), { action: "theme.template", entityType: "WebsiteTheme", summary: `Applied template ${template.name} to draft (backup v${version})` }, tx);
    return { backupVersion: version };
  });
}

// ---------------------------------------------------------------------------
// Pages and sections
// ---------------------------------------------------------------------------

const pageMetaSchema = z.object({
  title: z.string().trim().min(1, "Required").max(120),
  slug: zSlug,
  seoTitle: z.string().trim().max(120).nullish(),
  seoDescription: z.string().trim().max(300).nullish(),
});

function assertSlugAllowed(slug: string, kind: string) {
  if (kind === "HOME") return;
  if (RESERVED_SLUGS.has(slug)) throw new ValidationError("This address is reserved by the system", { slug: ["Reserved — choose another address"] });
}

export async function createPage(ctx: OrgContext, input: unknown) {
  assertCan(ctx, "website.edit");
  const data = parseInput(pageMetaSchema.extend({ template: z.enum(["blank", "content", "landing"]).default("content") }), input);
  assertSlugAllowed(data.slug, "STANDARD");
  const sections =
    data.template === "blank"
      ? []
      : data.template === "landing"
        ? [{ type: "hero" }, { type: "imageText" }, { type: "cta" }]
        : [{ type: "hero", overrides: { heading: data.title, subheading: "", size: "sm", primaryButton: { label: "", href: "" }, secondaryButton: { label: "", href: "" } } }, { type: "richText" }];
  try {
    return await prisma.$transaction(async (tx) => {
      const page = await tx.page.create({
        data: { organisationId: ctx.organisationId, title: data.title, slug: data.slug, seoTitle: data.seoTitle, seoDescription: data.seoDescription, status: "DRAFT" },
      });
      let i = 0;
      for (const s of sections) {
        await tx.pageSection.create({ data: { organisationId: ctx.organisationId, pageId: page.id, type: s.type, props: buildSectionProps(s) as Prisma.InputJsonValue, sortOrder: i++ } });
      }
      await audit(actorOf(ctx), { action: "page.create", entityType: "Page", entityId: page.id, summary: `Created page ${page.title}` }, tx);
      return page;
    });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") throw new ConflictError("A page with this address already exists", { slug: ["Already in use"] });
    throw err;
  }
}

async function getOwnedPage(ctx: OrgContext, pageId: string, tx: Tx = prisma) {
  const page = await tx.page.findFirst({ where: { id: pageId, organisationId: ctx.organisationId } });
  if (!page) throw new NotFoundError("Page");
  return page;
}

export async function updatePageMeta(ctx: OrgContext, pageId: string, input: unknown) {
  assertCan(ctx, "website.edit");
  const page = await getOwnedPage(ctx, pageId);
  const data = parseInput(pageMetaSchema, input);
  if (page.kind === "HOME") data.slug = page.slug;
  assertSlugAllowed(data.slug, page.kind);
  try {
    return await prisma.page.update({
      where: { id: page.id },
      data: { title: data.title, slug: data.slug, seoTitle: data.seoTitle ?? null, seoDescription: data.seoDescription ?? null, hasUnpublishedChanges: true },
    });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") throw new ConflictError("A page with this address already exists", { slug: ["Already in use"] });
    throw err;
  }
}

const sectionInputSchema = z.array(
  z.object({
    id: z.string().max(60).optional(),
    type: z.string().max(40),
    hidden: z.boolean().default(false),
    props: z.record(z.unknown()),
  }),
).max(60, "A page can have at most 60 sections");

/**
 * Replaces the draft sections of a page (used by the builder's save/autosave).
 * Each section is validated against its registered schema and rich text is
 * sanitised on the server.
 */
export async function saveSections(ctx: OrgContext, pageId: string, input: unknown) {
  assertCan(ctx, "website.edit");
  const items = parseInput(sectionInputSchema, input);
  const validated = items.map((item, index) => {
    if (!getSectionDefinition(item.type)) throw new ValidationError(`Unknown section type “${item.type}”`);
    const result = validateSectionProps(item.type, item.props);
    if (!result.ok) {
      const prefixed: Record<string, string[]> = {};
      for (const [k, v] of Object.entries(result.errors)) prefixed[`sections.${index}.${k}`] = v;
      throw new ValidationError(`Section ${index + 1} (${getSectionDefinition(item.type)!.label}) has invalid settings`, prefixed);
    }
    return { ...item, props: mapRichText(item.type, result.props, sanitizeRichText) };
  });

  return prisma.$transaction(async (tx) => {
    const page = await getOwnedPage(ctx, pageId, tx);
    const existing = await tx.pageSection.findMany({ where: { pageId: page.id } });
    const existingIds = new Set(existing.map((s) => s.id));
    const keep = new Set<string>();
    const result: SectionInstance[] = [];
    for (const [i, s] of validated.entries()) {
      if (s.id && existingIds.has(s.id)) {
        keep.add(s.id);
        await tx.pageSection.update({ where: { id: s.id }, data: { type: s.type, hidden: s.hidden, props: s.props as Prisma.InputJsonValue, sortOrder: i } });
        result.push({ id: s.id, type: s.type, hidden: s.hidden, props: s.props });
      } else {
        // Keep client-generated IDs (random 32-hex) so autosave does not need ID remapping.
        const clientId = s.id && /^[a-f0-9]{32}$/.test(s.id) && !(await tx.pageSection.findUnique({ where: { id: s.id }, select: { id: true } })) ? s.id : undefined;
        const created = await tx.pageSection.create({
          data: { id: clientId, organisationId: ctx.organisationId, pageId: page.id, type: s.type, hidden: s.hidden, props: s.props as Prisma.InputJsonValue, sortOrder: i },
        });
        keep.add(created.id);
        result.push({ id: created.id, type: s.type, hidden: s.hidden, props: s.props });
      }
    }
    const toDelete = existing.filter((s) => !keep.has(s.id)).map((s) => s.id);
    if (toDelete.length) await tx.pageSection.deleteMany({ where: { id: { in: toDelete }, pageId: page.id } });
    await tx.page.update({ where: { id: page.id }, data: { hasUnpublishedChanges: true } });
    return result;
  });
}

function pageSnapshotFrom(
  page: { title: string; slug: string; kind: string; seoTitle: string | null; seoDescription: string | null; ogImage?: { id: string; filename: string } | null },
  sections: { id: string; type: string; hidden: boolean; props: Prisma.JsonValue }[],
): PageSnapshot {
  return {
    title: page.title,
    slug: page.slug,
    kind: page.kind,
    seoTitle: page.seoTitle,
    seoDescription: page.seoDescription,
    ogImageUrl: page.ogImage ? `/media/${page.ogImage.id}/${encodeURIComponent(page.ogImage.filename)}` : null,
    sections: sections.map((s) => ({ id: s.id, type: s.type, hidden: s.hidden, props: s.props as Record<string, unknown> })),
  };
}

async function publishPageInTx(tx: Tx, organisationId: string, pageId: string, actorId: string | null, note?: string) {
  const page = await tx.page.findFirst({
    where: { id: pageId, organisationId },
    include: { sections: { orderBy: { sortOrder: "asc" } }, ogImage: { select: { id: true, filename: true } } },
  });
  if (!page) throw new NotFoundError("Page");
  const last = await tx.pageRevision.findFirst({ where: { pageId }, orderBy: { revision: "desc" }, select: { revision: true } });
  const revision = await tx.pageRevision.create({
    data: {
      organisationId,
      pageId,
      revision: (last?.revision ?? 0) + 1,
      snapshot: pageSnapshotFrom(page, page.sections) as unknown as Prisma.InputJsonValue,
      createdById: actorId,
      note: note ?? null,
    },
  });
  await tx.page.update({
    where: { id: pageId },
    data: { status: "PUBLISHED", publishedRevisionId: revision.id, publishedAt: new Date(), hasUnpublishedChanges: false },
  });
  return revision;
}

export async function publishPage(ctx: OrgContext, pageId: string) {
  assertCan(ctx, "website.publish");
  await assertDirectPublishAllowed(ctx);
  const rev = await prisma.$transaction(async (tx) => {
    const page = await getOwnedPage(ctx, pageId, tx);
    const r = await publishPageInTx(tx, ctx.organisationId, page.id, ctx.user.id);
    await audit(actorOf(ctx), { action: "page.publish", entityType: "Page", entityId: page.id, summary: `Published page ${page.title} (revision ${r.revision})` }, tx);
    return r;
  });
  invalidateSite(ctx.organisationId);
  return rev;
}

export async function unpublishPage(ctx: OrgContext, pageId: string) {
  assertCan(ctx, "website.publish");
  const page = await getOwnedPage(ctx, pageId);
  if (page.kind === "HOME") throw new ValidationError("The homepage cannot be unpublished");
  await prisma.page.update({ where: { id: page.id }, data: { status: "DRAFT", publishedRevisionId: null, hasUnpublishedChanges: true } });
  await audit(actorOf(ctx), { action: "page.unpublish", entityType: "Page", entityId: page.id, summary: `Unpublished page ${page.title}` });
  invalidateSite(ctx.organisationId);
}

/** Marks a draft page so that it goes live with the next website publish. */
export async function setPageLive(ctx: OrgContext, pageId: string, live: boolean) {
  assertCan(ctx, "website.edit");
  const page = await getOwnedPage(ctx, pageId);
  if (!live) return unpublishPage(ctx, pageId);
  await prisma.page.update({ where: { id: page.id }, data: { status: "PUBLISHED", hasUnpublishedChanges: true } });
}

export async function archivePage(ctx: OrgContext, pageId: string) {
  assertCan(ctx, "website.publish");
  const page = await getOwnedPage(ctx, pageId);
  if (page.kind === "HOME") throw new ValidationError("The homepage cannot be archived");
  await prisma.$transaction(async (tx) => {
    await tx.page.update({ where: { id: page.id }, data: { status: "ARCHIVED", publishedRevisionId: null } });
    await tx.navigationItem.updateMany({ where: { pageId: page.id }, data: { hidden: true } });
    await audit(actorOf(ctx), { action: "page.archive", entityType: "Page", entityId: page.id, summary: `Archived page ${page.title}` }, tx);
  });
  invalidateSite(ctx.organisationId);
}

export async function restoreArchivedPage(ctx: OrgContext, pageId: string) {
  assertCan(ctx, "website.edit");
  const page = await getOwnedPage(ctx, pageId);
  if (page.status !== "ARCHIVED") return;
  await prisma.page.update({ where: { id: page.id }, data: { status: "DRAFT", hasUnpublishedChanges: true } });
  await audit(actorOf(ctx), { action: "page.restore", entityType: "Page", entityId: page.id, summary: `Restored archived page ${page.title}` });
}

export async function listPageRevisions(ctx: OrgContext, pageId: string) {
  assertCan(ctx, "website.edit");
  const page = await getOwnedPage(ctx, pageId);
  return prisma.pageRevision.findMany({
    where: { pageId: page.id },
    orderBy: { revision: "desc" },
    take: 50,
    select: { id: true, revision: true, note: true, createdAt: true, createdBy: { select: { name: true } } },
  });
}

/** Copies a previous revision into the draft. Publish to make it live. */
export async function restorePageRevision(ctx: OrgContext, pageId: string, revisionId: string) {
  assertCan(ctx, "website.edit");
  await prisma.$transaction(async (tx) => {
    const page = await getOwnedPage(ctx, pageId, tx);
    const rev = await tx.pageRevision.findFirst({ where: { id: revisionId, pageId: page.id, organisationId: ctx.organisationId } });
    if (!rev) throw new NotFoundError("Revision");
    const snap = rev.snapshot as unknown as PageSnapshot;
    await tx.pageSection.deleteMany({ where: { pageId: page.id } });
    for (const [i, s] of snap.sections.entries()) {
      await tx.pageSection.create({ data: { organisationId: ctx.organisationId, pageId: page.id, type: s.type, hidden: s.hidden, props: s.props as Prisma.InputJsonValue, sortOrder: i } });
    }
    await tx.page.update({
      where: { id: page.id },
      data: { title: snap.title, seoTitle: snap.seoTitle, seoDescription: snap.seoDescription, hasUnpublishedChanges: true },
    });
    await audit(actorOf(ctx), { action: "page.revision.restore", entityType: "Page", entityId: page.id, summary: `Restored revision ${rev.revision} of ${page.title} into draft` }, tx);
  });
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

const navItemInput = z.object({
  id: z.string().max(60).optional(),
  label: z.string().trim().min(1, "Label required").max(60),
  type: z.enum(["PAGE", "SYSTEM", "EXTERNAL"]),
  pageId: z.string().max(60).nullish(),
  systemRoute: z.string().max(60).nullish(),
  url: zHref.nullish(),
  openInNewTab: z.boolean().default(false),
  hidden: z.boolean().default(false),
});

const navTreeInput = z
  .array(navItemInput.extend({ children: z.array(navItemInput).max(12).default([]) }))
  .max(20);

export async function saveNavigation(ctx: OrgContext, location: NavLocation, input: unknown) {
  assertCan(ctx, "website.edit");
  const items = parseInput(navTreeInput, input);
  const pages = await prisma.page.findMany({ where: { organisationId: ctx.organisationId }, select: { id: true } });
  const pageIds = new Set(pages.map((p) => p.id));
  const systemRoutes = new Set<string>(SYSTEM_ROUTES.map((r) => r.value));
  const check = (i: z.infer<typeof navItemInput>) => {
    if (i.type === "PAGE" && (!i.pageId || !pageIds.has(i.pageId))) throw new ValidationError(`“${i.label}” must link to a page`);
    if (i.type === "SYSTEM" && (!i.systemRoute || !systemRoutes.has(i.systemRoute))) throw new ValidationError(`“${i.label}” must link to a valid system page`);
    if (i.type === "EXTERNAL" && !i.url) throw new ValidationError(`“${i.label}” needs a URL`);
  };
  items.forEach((i) => {
    check(i);
    i.children.forEach(check);
  });
  if (location === "FOOTER" && items.some((i) => i.children.length)) throw new ValidationError("Footer navigation does not support dropdowns");

  await prisma.$transaction(async (tx) => {
    await tx.navigationItem.deleteMany({ where: { organisationId: ctx.organisationId, location } });
    for (const [i, item] of items.entries()) {
      const parent = await tx.navigationItem.create({
        data: {
          organisationId: ctx.organisationId,
          location,
          label: item.label,
          type: item.type,
          pageId: item.type === "PAGE" ? item.pageId : null,
          systemRoute: item.type === "SYSTEM" ? item.systemRoute : null,
          url: item.type === "EXTERNAL" ? item.url : null,
          openInNewTab: item.openInNewTab,
          hidden: item.hidden,
          sortOrder: i,
        },
      });
      for (const [j, child] of item.children.entries()) {
        await tx.navigationItem.create({
          data: {
            organisationId: ctx.organisationId,
            location,
            label: child.label,
            type: child.type,
            pageId: child.type === "PAGE" ? child.pageId : null,
            systemRoute: child.type === "SYSTEM" ? child.systemRoute : null,
            url: child.type === "EXTERNAL" ? child.url : null,
            openInNewTab: child.openInNewTab,
            hidden: child.hidden,
            parentId: parent.id,
            sortOrder: j,
          },
        });
      }
    }
    await tx.websiteTheme.update({ where: { organisationId: ctx.organisationId }, data: { hasUnpublishedChanges: true } });
  });
}

async function navSnapshot(tx: Tx, organisationId: string, publishedPageIds?: Set<string>): Promise<NavItemSnapshot[]> {
  const items = await tx.navigationItem.findMany({
    where: { organisationId },
    orderBy: [{ location: "asc" }, { sortOrder: "asc" }],
    include: { page: { select: { slug: true, kind: true, status: true, id: true } } },
  });
  return items.map((i) => {
    let href: string | null = null;
    if (i.type === "SYSTEM") href = i.systemRoute;
    else if (i.type === "EXTERNAL") href = i.url;
    else if (i.page && (!publishedPageIds || publishedPageIds.has(i.page.id))) href = i.page.kind === "HOME" ? "/" : `/${i.page.slug}`;
    return {
      id: i.id,
      location: i.location,
      label: i.label,
      type: i.type,
      pageId: i.pageId,
      systemRoute: i.systemRoute,
      url: i.url,
      parentId: i.parentId,
      openInNewTab: i.openInNewTab,
      hidden: i.hidden,
      sortOrder: i.sortOrder,
      href,
    };
  });
}

// ---------------------------------------------------------------------------
// Publishing, discarding and version history
// ---------------------------------------------------------------------------

async function nextVersion(tx: Tx, organisationId: string) {
  const last = await tx.themeVersion.findFirst({ where: { organisationId }, orderBy: { version: "desc" }, select: { version: true } });
  return (last?.version ?? 0) + 1;
}

async function publishInTx(tx: Tx, organisationId: string, actorId: string | null, note?: string | null) {
  const theme = await tx.websiteTheme.findUnique({ where: { organisationId } });
  const settings = await tx.websiteSettings.findUnique({ where: { organisationId } });
  if (!theme || !settings) throw new NotFoundError("Website configuration");

  // Validate before publishing; never publish an invalid configuration.
  const tokens = themeTokensSchema.safeParse(theme.draftTokens);
  if (!tokens.success) throw new ValidationError("The draft theme is invalid and cannot be published");
  const config = siteConfigSchema.safeParse(settings.draftConfig);
  if (!config.success) throw new ValidationError("The draft site settings are invalid and cannot be published");

  // Publish pages that are marked live and have unpublished changes.
  const pages = await tx.page.findMany({ where: { organisationId, status: "PUBLISHED" }, select: { id: true, hasUnpublishedChanges: true, publishedRevisionId: true } });
  let pagesPublished = 0;
  for (const p of pages) {
    if (p.hasUnpublishedChanges || !p.publishedRevisionId) {
      await publishPageInTx(tx, organisationId, p.id, actorId, note ?? undefined);
      pagesPublished++;
    }
  }
  const livePageIds = new Set(pages.map((p) => p.id));
  const navigation = await navSnapshot(tx, organisationId, livePageIds);
  const version = await nextVersion(tx, organisationId);
  const tv = await tx.themeVersion.create({
    data: {
      organisationId,
      version,
      kind: "PUBLISHED",
      templateKey: theme.templateKey,
      tokens: tokens.data as Prisma.InputJsonValue,
      siteConfig: config.data as Prisma.InputJsonValue,
      navigation: navigation as unknown as Prisma.InputJsonValue,
      note: note ?? null,
      createdById: actorId,
    },
  });
  await tx.websiteTheme.update({
    where: { organisationId },
    data: { publishedVersionId: tv.id, publishedAt: new Date(), publishedById: actorId, hasUnpublishedChanges: false },
  });
  return { version, pagesPublished };
}

type ApprovalRules = { websitePublish?: boolean; reportPublish?: boolean; budgetChanges?: boolean; projectStatus?: boolean; impactVerification?: boolean };

export function approvalRules(ctx: OrgContext): ApprovalRules {
  return (ctx.organisation.approvalRules ?? {}) as ApprovalRules;
}

async function assertDirectPublishAllowed(ctx: OrgContext) {
  if (approvalRules(ctx).websitePublish && !can(ctx, "approval.review")) {
    throw new ForbiddenError("Website publishing requires approval in this organisation. Use “Request approval” instead.");
  }
}

export async function publishWebsite(ctx: OrgContext, note?: string | null, opts: { viaApproval?: boolean } = {}) {
  assertCan(ctx, "website.publish");
  if (!opts.viaApproval) await assertDirectPublishAllowed(ctx);
  const result = await prisma.$transaction(async (tx) => {
    const r = await publishInTx(tx, ctx.organisationId, ctx.user.id, note);
    await audit(
      actorOf(ctx),
      { action: "website.publish", entityType: "WebsiteTheme", summary: `Published website version ${r.version}`, metadata: { pagesPublished: r.pagesPublished, note } },
      tx,
    );
    return r;
  });
  invalidateSite(ctx.organisationId);
  return result;
}

/** Resets all drafts (theme, settings, navigation, pages) to the published state. */
export async function discardDrafts(ctx: OrgContext) {
  assertCan(ctx, "website.edit");
  await prisma.$transaction(async (tx) => {
    const { theme } = await loadTheme(tx, ctx.organisationId);
    if (theme.publishedVersion) await copyVersionIntoDraft(tx, ctx.organisationId, theme.publishedVersion.id);
    const pages = await tx.page.findMany({ where: { organisationId: ctx.organisationId, hasUnpublishedChanges: true, publishedRevisionId: { not: null } } });
    for (const p of pages) {
      const rev = await tx.pageRevision.findUnique({ where: { id: p.publishedRevisionId! } });
      if (!rev) continue;
      const snap = rev.snapshot as unknown as PageSnapshot;
      await tx.pageSection.deleteMany({ where: { pageId: p.id } });
      for (const [i, s] of snap.sections.entries()) {
        await tx.pageSection.create({ data: { organisationId: ctx.organisationId, pageId: p.id, type: s.type, hidden: s.hidden, props: s.props as Prisma.InputJsonValue, sortOrder: i } });
      }
      await tx.page.update({ where: { id: p.id }, data: { title: snap.title, slug: snap.slug, seoTitle: snap.seoTitle, seoDescription: snap.seoDescription, hasUnpublishedChanges: false } });
    }
    await tx.websiteTheme.update({ where: { organisationId: ctx.organisationId }, data: { hasUnpublishedChanges: false } });
    await audit(actorOf(ctx), { action: "website.discard", entityType: "WebsiteTheme", summary: "Discarded unpublished website changes" }, tx);
  });
}

async function copyVersionIntoDraft(tx: Tx, organisationId: string, versionId: string) {
  const v = await tx.themeVersion.findFirst({ where: { id: versionId, organisationId } });
  if (!v) throw new NotFoundError("Version");
  await tx.websiteTheme.update({
    where: { organisationId },
    data: { draftTokens: v.tokens as Prisma.InputJsonValue, templateKey: v.templateKey ?? CUSTOM_TEMPLATE_KEY, hasUnpublishedChanges: true },
  });
  await tx.websiteSettings.update({ where: { organisationId }, data: { draftConfig: v.siteConfig as Prisma.InputJsonValue } });
  // Restore navigation items whose target pages still exist.
  const nav = (v.navigation as unknown as NavItemSnapshot[]) ?? [];
  const pageIds = new Set((await tx.page.findMany({ where: { organisationId }, select: { id: true } })).map((p) => p.id));
  await tx.navigationItem.deleteMany({ where: { organisationId } });
  const idMap = new Map<string, string>();
  const ordered = [...nav.filter((n) => !n.parentId), ...nav.filter((n) => n.parentId)];
  for (const n of ordered) {
    if (n.type === "PAGE" && (!n.pageId || !pageIds.has(n.pageId))) continue;
    if (n.parentId && !idMap.has(n.parentId)) continue;
    const created = await tx.navigationItem.create({
      data: {
        organisationId,
        location: n.location,
        label: n.label,
        type: n.type,
        pageId: n.pageId,
        systemRoute: n.systemRoute,
        url: n.url,
        openInNewTab: n.openInNewTab,
        hidden: n.hidden,
        sortOrder: n.sortOrder,
        parentId: n.parentId ? idMap.get(n.parentId) : null,
      },
    });
    idMap.set(n.id, created.id);
  }
}

export async function listThemeVersions(ctx: OrgContext) {
  assertCan(ctx, "website.edit");
  return prisma.themeVersion.findMany({
    where: { organisationId: ctx.organisationId },
    orderBy: { version: "desc" },
    take: 50,
    select: { id: true, version: true, kind: true, templateKey: true, note: true, createdAt: true, createdBy: { select: { name: true } } },
  });
}

/** Copies a previous version (theme, site settings and navigation) into the draft. */
export async function restoreThemeVersion(ctx: OrgContext, versionId: string, opts: { publish?: boolean } = {}) {
  assertCan(ctx, "website.edit");
  const v = ensureOwned(ctx, await prisma.themeVersion.findUnique({ where: { id: versionId } }), "Version");
  await prisma.$transaction(async (tx) => {
    await copyVersionIntoDraft(tx, ctx.organisationId, v.id);
    await audit(actorOf(ctx), { action: "theme.restore", entityType: "ThemeVersion", entityId: v.id, summary: `Restored website version ${v.version} into draft` }, tx);
  });
  if (opts.publish) return publishWebsite(ctx, `Rollback to version ${v.version}`);
  return null;
}

// ---------------------------------------------------------------------------
// Reading published / draft data for rendering
// ---------------------------------------------------------------------------

export type RenderableSite = {
  organisationId: string;
  tokens: ThemeTokens;
  config: SiteConfig;
  navigation: NavItemSnapshot[];
  version: number | null;
  isDraft: boolean;
};

export async function loadPublishedSite(organisationId: string): Promise<RenderableSite | null> {
  const org = await prisma.organisation.findUnique({ where: { id: organisationId } });
  if (!org) return null;
  const theme = await prisma.websiteTheme.findUnique({ where: { organisationId }, include: { publishedVersion: true } });
  const fallbackConfig = defaultSiteConfig(org);
  const v = theme?.publishedVersion;
  return {
    organisationId,
    tokens: coerceTokens(v?.tokens, defaultTokens()),
    config: coerceSiteConfig(v?.siteConfig, fallbackConfig),
    navigation: ((v?.navigation as unknown as NavItemSnapshot[]) ?? []).filter((n) => !n.hidden && n.href),
    version: v?.version ?? null,
    isDraft: false,
  };
}

/** Draft rendering. Callers must have verified the viewer's website.edit permission. */
export async function loadDraftSite(ctx: OrgContext): Promise<RenderableSite> {
  assertCan(ctx, "website.edit");
  const { theme, settings } = await loadTheme(prisma, ctx.organisationId);
  const nav = await navSnapshot(prisma, ctx.organisationId);
  return {
    organisationId: ctx.organisationId,
    tokens: coerceTokens(theme.draftTokens, defaultTokens()),
    config: coerceSiteConfig(settings.draftConfig, defaultSiteConfig(ctx.organisation)),
    navigation: nav.filter((n) => !n.hidden && n.href),
    version: null,
    isDraft: true,
  };
}

export async function loadPublishedPage(organisationId: string, slug: string | null): Promise<PageSnapshot | null> {
  const page = await prisma.page.findFirst({
    where: { organisationId, status: "PUBLISHED", publishedRevisionId: { not: null }, ...(slug === null ? { kind: "HOME" } : { slug, kind: { not: "HOME" } }) },
    include: { publishedRevision: true },
  });
  if (!page?.publishedRevision) return null;
  const snap = page.publishedRevision.snapshot as unknown as PageSnapshot;
  return { ...snap, slug: page.slug, sections: snap.sections.filter((s) => !s.hidden && getSectionDefinition(s.type)) };
}

export async function loadDraftPage(ctx: OrgContext, slug: string | null): Promise<PageSnapshot | null> {
  assertCan(ctx, "website.edit");
  const page = await prisma.page.findFirst({
    where: { organisationId: ctx.organisationId, status: { not: "ARCHIVED" }, ...(slug === null ? { kind: "HOME" } : { slug, kind: { not: "HOME" } }) },
    include: { sections: { orderBy: { sortOrder: "asc" } }, ogImage: { select: { id: true, filename: true } } },
  });
  if (!page) return null;
  const snap = pageSnapshotFrom(page, page.sections);
  return { ...snap, sections: snap.sections.filter((s) => !s.hidden) };
}

export async function publishedSlugs(organisationId: string) {
  return prisma.page.findMany({
    where: { organisationId, status: "PUBLISHED", publishedRevisionId: { not: null } },
    select: { slug: true, kind: true, publishedAt: true },
  });
}
