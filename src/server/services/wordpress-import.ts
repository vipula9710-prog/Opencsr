import { XMLParser } from "fast-xml-parser";
import type { PostStatus } from "@prisma/client";
import { prisma } from "../db";
import { actorOf, assertCan, can, type OrgContext } from "../context";
import { audit } from "../audit";
import { ValidationError } from "../errors";
import { sanitizeRichText } from "../sanitize";
import { invalidateSite } from "../cache";
import { logger } from "../logger";
import { createSafeFetcher, type RemoteFetcher } from "../safe-fetch";
import { maxUploadBytes, publicMediaUrl, uploadMedia } from "./media";
import { readingMinutes, slugify, stripHtml, truncate } from "@/lib/utils";

// Imports blog posts from a WordPress export file (WXR), produced by
// WordPress → Tools → Export → Posts. Pages, comments and other post types
// are not imported.

export const WXR_MAX_BYTES = 25 * 1024 * 1024;
const MAX_IMAGES = 300;

export type WxrPost = {
  wpId: string;
  title: string;
  slug: string;
  status: string;
  date: Date | null;
  content: string;
  excerpt: string;
  categories: { name: string; slug: string }[];
  tags: { name: string; slug: string }[];
  thumbnailId: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
};

export type ParsedWxr = { siteTitle: string; siteUrl: string; posts: WxrPost[]; attachments: Map<string, string>; otherItems: number };

const text = (v: unknown): string => {
  if (v === undefined || v === null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "object" && "#text" in (v as Record<string, unknown>)) return text((v as Record<string, unknown>)["#text"]);
  return "";
};
const list = <T,>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

/** WordPress stores GMT dates as "YYYY-MM-DD HH:MM:SS"; "0000-00-00 00:00:00" means none. */
function wpDate(gmt: string, local: string, pubDate: string): Date | null {
  for (const v of [gmt, local]) {
    const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(v.trim());
    if (m && m[1] !== "0000") return new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!, +m[6]!));
  }
  const d = pubDate ? new Date(pubDate) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

export function parseWxr(xml: string): ParsedWxr {
  // fast-xml-parser never resolves external entities or DTDs (no XXE).
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseTagValue: false,
    trimValues: false,
    processEntities: true,
    htmlEntities: true,
    isArray: (name) => ["item", "category", "wp:postmeta"].includes(name),
  });
  let doc: Record<string, unknown>;
  try {
    doc = parser.parse(xml) as Record<string, unknown>;
  } catch {
    throw new ValidationError("The file could not be read as XML. Upload the .xml file exported from WordPress (Tools → Export).");
  }
  const channel = (doc.rss as Record<string, unknown> | undefined)?.channel as Record<string, unknown> | undefined;
  if (!channel || !text(channel["wp:wxr_version"])) {
    throw new ValidationError("This is not a WordPress export file (WXR). In WordPress, use Tools → Export → Posts.");
  }
  const items = list(channel.item as Record<string, unknown>[] | undefined);
  const attachments = new Map<string, string>();
  const posts: WxrPost[] = [];
  let otherItems = 0;
  for (const item of items) {
    const type = text(item["wp:post_type"]).trim();
    const id = text(item["wp:post_id"]).trim();
    if (type === "attachment") {
      const url = text(item["wp:attachment_url"]).trim();
      if (id && url) attachments.set(id, url);
      continue;
    }
    if (type !== "post") {
      otherItems++;
      continue;
    }
    const meta = new Map<string, string>();
    for (const m of list(item["wp:postmeta"] as Record<string, unknown>[] | undefined)) meta.set(text(m["wp:meta_key"]), text(m["wp:meta_value"]));
    const cats = list(item.category as Record<string, unknown>[] | undefined);
    const term = (domain: string) =>
      cats
        .filter((c) => typeof c === "object" && c["@_domain"] === domain)
        .map((c) => ({ name: text(c).trim().slice(0, 80), slug: slugify(text(c["@_nicename"]) || text(c)) }))
        .filter((c) => c.name && c.slug);
    const yoast = (k: string) => {
      const v = (meta.get(k) ?? "").trim();
      return v && !v.includes("%%") ? v : null; // skip Yoast templates such as %%title%%
    };
    posts.push({
      wpId: id,
      title: text(item.title).trim(),
      slug: decodeURIComponent(text(item["wp:post_name"]).trim()),
      status: text(item["wp:status"]).trim(),
      date: wpDate(text(item["wp:post_date_gmt"]), text(item["wp:post_date"]), text(item.pubDate)),
      content: text(item["content:encoded"]),
      excerpt: text(item["excerpt:encoded"]).trim(),
      categories: term("category"),
      tags: term("post_tag"),
      thumbnailId: meta.get("_thumbnail_id")?.trim() || null,
      seoTitle: yoast("_yoast_wpseo_title"),
      seoDescription: yoast("_yoast_wpseo_metadesc"),
    });
  }
  return { siteTitle: text(channel.title).trim(), siteUrl: text(channel.link).trim(), posts, attachments, otherItems };
}

const BLOCK_START = /^<(p|h[1-6]|ul|ol|li|blockquote|figure|div|table|pre|hr|img|iframe|section|header|footer|dl)\b/i;

/**
 * Converts WordPress post content to clean HTML: removes block-editor comments
 * and shortcodes, turns [caption] into <figure>, and adds paragraphs to
 * classic-editor text (WordPress' "autop"). The result is sanitised later.
 */
export function wpContentToHtml(raw: string): string {
  let html = raw.replace(/<!--[\s\S]*?-->/g, "").replace(/\r\n?/g, "\n");
  html = html.replace(/\[caption[^\]]*\]([\s\S]*?)\[\/caption\]/gi, (_m, inner: string) => {
    const media = /^\s*((?:<a\b[^>]*>\s*)?<img\b[^>]*>(?:\s*<\/a>)?)([\s\S]*)$/i.exec(inner);
    if (!media) return inner;
    const caption = media[2]!.trim();
    return `<figure>${media[1]}${caption ? `<figcaption>${caption}</figcaption>` : ""}</figure>`;
  });
  // Remove remaining shortcodes, e.g. [gallery ids="1,2"] or [/embed]; keep text like "[1]".
  html = html.replace(/\[\/?[a-z][\w-]*(?:\s[^\]]*)?\]/gi, "");
  return html
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => (BLOCK_START.test(chunk) ? chunk : `<p>${chunk.replace(/\n/g, "<br />")}</p>`))
    .join("\n");
}

function imageUrlsIn(html: string): string[] {
  return [...html.matchAll(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]!).filter((u) => /^https?:\/\//i.test(u));
}

function filenameFromUrl(url: string) {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split("/").pop() || "image");
    return /\.[a-z0-9]{2,5}$/i.test(name) ? name : `${name}.jpg`;
  } catch {
    return "image.jpg";
  }
}

function friendlyFetchError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const code = (err as { code?: string })?.code ?? "";
  if (code === "ENOTFOUND" || /ENOTFOUND/.test(msg)) return "Website not found";
  if (code === "EBLOCKED" || /Blocked address|Private network|Local host/.test(msg)) return "Blocked: points to a private or internal network address";
  if (code === "ECONNREFUSED" || code === "ECONNRESET") return "The website refused the connection";
  if (/Timed out/.test(msg)) return "Download timed out";
  return msg;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export type ImportOptions = {
  importImages: boolean;
  /** Import everything as drafts regardless of the WordPress status. */
  asDrafts: boolean;
  fetcher?: RemoteFetcher;
  now?: Date;
};

export type ImportReport = {
  siteTitle: string;
  found: number;
  imported: number;
  published: number;
  scheduled: number;
  drafts: number;
  skipped: { title: string; reason: string }[];
  images: { imported: number; failed: { url: string; reason: string }[]; skippedOverLimit: number };
  otherItems: number;
  publishingDowngraded: boolean;
};

/**
 * Imports posts from a WXR export into the context's organisation. Existing
 * posts with the same slug are skipped, so re-running an import is safe.
 * The importing user becomes the author. Without blog.publish permission,
 * every post is imported as a draft.
 */
export async function importWordPress(ctx: OrgContext, xml: string, opts: ImportOptions): Promise<ImportReport> {
  assertCan(ctx, "blog.write");
  if (opts.importImages) assertCan(ctx, "media.write");
  if (Buffer.byteLength(xml) > WXR_MAX_BYTES) throw new ValidationError("The export file is larger than 25 MB. Export a smaller date range or category from WordPress.");
  const wxr = parseWxr(xml);
  const now = opts.now ?? new Date();
  const mayPublish = can(ctx, "blog.publish") && !opts.asDrafts;
  const report: ImportReport = {
    siteTitle: wxr.siteTitle,
    found: wxr.posts.length,
    imported: 0,
    published: 0,
    scheduled: 0,
    drafts: 0,
    skipped: [],
    images: { imported: 0, failed: [], skippedOverLimit: 0 },
    otherItems: wxr.otherItems,
    publishingDowngraded: !opts.asDrafts && !can(ctx, "blog.publish"),
  };

  const fetcher = opts.fetcher ?? createSafeFetcher({ maxBytes: maxUploadBytes() });
  const imported = new Map<string, { id: string; url: string } | null>();
  const importImage = async (url: string, alt: string) => {
    if (imported.has(url)) return imported.get(url) ?? null;
    if (imported.size >= MAX_IMAGES) {
      report.images.skippedOverLimit++;
      return null;
    }
    try {
      const file = await fetcher(url);
      const asset = await uploadMedia(ctx, { filename: filenameFromUrl(url), data: file.data, visibility: "PUBLIC", altText: alt || null, imagesOnly: true });
      const result = { id: asset.id, url: publicMediaUrl(asset) };
      imported.set(url, result);
      report.images.imported++;
      return result;
    } catch (err) {
      imported.set(url, null);
      report.images.failed.push({ url, reason: friendlyFetchError(err) });
      return null;
    }
  };

  const existing = new Set((await prisma.blogPost.findMany({ where: { organisationId: ctx.organisationId }, select: { slug: true } })).map((p) => p.slug));
  const categoryIds = new Map<string, string>();
  const tagIds = new Map<string, string>();

  for (const post of wxr.posts) {
    const title = truncate(post.title || "Untitled", 200);
    if (["trash", "auto-draft", "inherit"].includes(post.status)) {
      report.skipped.push({ title, reason: `WordPress status “${post.status}”` });
      continue;
    }
    const slug = slugify(post.slug || post.title) || `wordpress-${post.wpId}`;
    if (existing.has(slug)) {
      report.skipped.push({ title, reason: `A post with the address /blog/${slug} already exists` });
      continue;
    }

    let content = wpContentToHtml(post.content);
    let featuredImageId: string | null = null;
    if (opts.importImages) {
      for (const url of [...new Set(imageUrlsIn(content))]) {
        const alt = new RegExp(`<img\\b[^>]*src=["']${escapeRe(url)}["'][^>]*alt=["']([^"']*)["']`, "i").exec(content)?.[1] ?? "";
        const img = await importImage(url, alt);
        if (img) content = content.replace(new RegExp(escapeRe(url), "g"), img.url);
      }
      const thumbUrl = post.thumbnailId ? wxr.attachments.get(post.thumbnailId) : undefined;
      if (thumbUrl) featuredImageId = (await importImage(thumbUrl, title))?.id ?? null;
    }
    content = sanitizeRichText(content);

    let status: PostStatus = "DRAFT";
    let publishedAt: Date | null = null;
    let scheduledFor: Date | null = null;
    if (mayPublish && post.status === "publish") {
      status = "PUBLISHED";
      publishedAt = post.date && post.date <= now ? post.date : now;
    } else if (mayPublish && post.status === "future" && post.date && post.date > now) {
      status = "SCHEDULED";
      scheduledFor = post.date;
    }

    try {
      await prisma.$transaction(async (tx) => {
        const connectCats: { id: string }[] = [];
        for (const c of post.categories) {
          if (!categoryIds.has(c.slug)) {
            const cat = await tx.category.upsert({
              where: { organisationId_slug: { organisationId: ctx.organisationId, slug: c.slug } },
              create: { organisationId: ctx.organisationId, name: c.name, slug: c.slug },
              update: {},
              select: { id: true },
            });
            categoryIds.set(c.slug, cat.id);
          }
          connectCats.push({ id: categoryIds.get(c.slug)! });
        }
        const connectTags: { id: string }[] = [];
        for (const t of post.tags) {
          if (!tagIds.has(t.slug)) {
            const tag = await tx.tag.upsert({
              where: { organisationId_slug: { organisationId: ctx.organisationId, slug: t.slug } },
              create: { organisationId: ctx.organisationId, name: t.name.slice(0, 60), slug: t.slug },
              update: {},
              select: { id: true },
            });
            tagIds.set(t.slug, tag.id);
          }
          connectTags.push({ id: tagIds.get(t.slug)! });
        }
        const created = await tx.blogPost.create({
          data: {
            organisationId: ctx.organisationId,
            title,
            slug,
            excerpt: truncate(stripHtml(post.excerpt), 500) || truncate(stripHtml(content), 240) || null,
            content,
            status,
            publishedAt,
            scheduledFor,
            authorId: ctx.user.id,
            featuredImageId,
            seoTitle: post.seoTitle?.slice(0, 120) ?? null,
            seoDescription: post.seoDescription?.slice(0, 300) ?? null,
            readingMinutes: readingMinutes(content),
            categories: { connect: connectCats },
            tags: { connect: connectTags },
          },
        });
        await audit(actorOf(ctx), { action: "blog.import", entityType: "BlogPost", entityId: created.id, summary: `Imported “${title}” from WordPress (${status.toLowerCase()})` }, tx);
      });
    } catch (err) {
      logger.warn("wordpress import: post failed", { err, title });
      report.skipped.push({ title, reason: "Could not be saved" });
      continue;
    }
    existing.add(slug);
    report.imported++;
    if (status === "PUBLISHED") report.published++;
    else if (status === "SCHEDULED") report.scheduled++;
    else report.drafts++;
  }

  await audit(actorOf(ctx), {
    action: "blog.import.wordpress",
    entityType: "BlogPost",
    summary: `WordPress import from “${wxr.siteTitle || "unknown site"}”: ${report.imported} of ${report.found} posts imported, ${report.images.imported} images`,
    metadata: { skipped: report.skipped.length, imageFailures: report.images.failed.length },
  });
  if (report.published || report.scheduled) invalidateSite(ctx.organisationId);
  return report;
}
