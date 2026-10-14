import { createHash, randomBytes } from "node:crypto";
import { Prisma, type MediaAsset } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { actorOf, assertCan, can, ensureOwned, type OrgContext } from "../context";
import { audit } from "../audit";
import { ForbiddenError, NotFoundError, ValidationError } from "../errors";
import { parseInput } from "../validation";
import { getStorage } from "../storage";
import { invalidateSite } from "../cache";
import { paged, skipTake, type ListQuery } from "./common";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/x-icon"] as const;

const EXTENSION_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  ico: "image/x-icon",
  pdf: "application/pdf",
  csv: "text/csv",
  txt: "text/plain",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
};

export const ACCEPT_ATTRIBUTE = Object.keys(EXTENSION_TYPES).map((e) => `.${e}`).join(",");
export const IMAGE_ACCEPT = ".jpg,.jpeg,.png,.gif,.webp,.ico";

export function maxUploadBytes() {
  const mb = Math.min(Number(process.env.UPLOAD_MAX_MB ?? 15) || 15, 25);
  return mb * 1024 * 1024;
}

function startsWith(buf: Buffer, bytes: number[], offset = 0) {
  return bytes.every((b, i) => buf[offset + i] === b);
}

/**
 * Detects the real file type from its content (magic bytes) and checks that it
 * matches the file extension. SVG, HTML and executables are rejected because
 * they can carry active content.
 */
export function detectFileType(filename: string, data: Buffer): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const expected = EXTENSION_TYPES[ext];
  if (!expected) throw new ValidationError(`Files of type .${ext || "?"} are not allowed`);
  let detected: string | null = null;
  if (startsWith(data, [0xff, 0xd8, 0xff])) detected = "image/jpeg";
  else if (startsWith(data, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) detected = "image/png";
  else if (startsWith(data, [0x47, 0x49, 0x46, 0x38])) detected = "image/gif";
  else if (startsWith(data, [0x52, 0x49, 0x46, 0x46]) && startsWith(data, [0x57, 0x45, 0x42, 0x50], 8)) detected = "image/webp";
  else if (startsWith(data, [0x00, 0x00, 0x01, 0x00])) detected = "image/x-icon";
  else if (startsWith(data, [0x25, 0x50, 0x44, 0x46, 0x2d])) detected = "application/pdf";
  else if (startsWith(data, [0x50, 0x4b, 0x03, 0x04])) detected = "zip";
  else {
    const head = data.subarray(0, 4096).toString("utf8");
    const binary = data.subarray(0, 4096).includes(0);
    if (!binary && !/<\s*(script|html|svg|iframe)/i.test(head)) detected = "text";
  }
  const ok =
    detected === expected ||
    (detected === "zip" && ["docx", "xlsx", "pptx", "odt", "ods"].includes(ext)) ||
    (detected === "text" && (ext === "csv" || ext === "txt"));
  if (!ok) throw new ValidationError("The file content does not match its extension or is not an allowed type");
  return expected;
}

/** Reads width/height for common image formats (best effort). */
export function imageSize(mime: string, data: Buffer): { width: number; height: number } | null {
  try {
    if (mime === "image/png") return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
    if (mime === "image/gif") return { width: data.readUInt16LE(6), height: data.readUInt16LE(8) };
    if (mime === "image/webp") {
      const chunk = data.toString("ascii", 12, 16);
      if (chunk === "VP8X") return { width: 1 + data.readUIntLE(24, 3), height: 1 + data.readUIntLE(27, 3) };
      if (chunk === "VP8 ") return { width: data.readUInt16LE(26) & 0x3fff, height: data.readUInt16LE(28) & 0x3fff };
      if (chunk === "VP8L") {
        const b = data.readUInt32LE(21);
        return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
      }
    }
    if (mime === "image/jpeg") {
      let i = 2;
      while (i < data.length) {
        if (data[i] !== 0xff) return null;
        const marker = data[i + 1]!;
        const len = data.readUInt16BE(i + 2);
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          return { height: data.readUInt16BE(i + 5), width: data.readUInt16BE(i + 7) };
        }
        i += 2 + len;
      }
    }
  } catch {
    return null;
  }
  return null;
}

function safeFilename(name: string) {
  const base = name.split(/[\\/]/).pop() ?? "file";
  return base.normalize("NFKD").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^[-.]+/, "").slice(-100) || "file";
}

export type UploadInput = {
  filename: string;
  data: Buffer;
  visibility?: "PUBLIC" | "PRIVATE";
  altText?: string | null;
  title?: string | null;
  imagesOnly?: boolean;
};

/** Store an uploaded file and create its MediaAsset record. */
export async function uploadMedia(ctx: OrgContext, input: UploadInput, opts: { permission?: "media.write" | "document.write" } = {}) {
  assertCan(ctx, opts.permission ?? "media.write");
  if (input.data.length === 0) throw new ValidationError("The file is empty");
  if (input.data.length > maxUploadBytes()) throw new ValidationError(`Files must be smaller than ${Math.round(maxUploadBytes() / 1024 / 1024)} MB`);
  const mimeType = detectFileType(input.filename, input.data);
  if (input.imagesOnly && !(IMAGE_TYPES as readonly string[]).includes(mimeType)) throw new ValidationError("Please choose an image (JPG, PNG, GIF, WebP or ICO)");
  const filename = safeFilename(input.filename);
  const now = new Date();
  const storageKey = `${ctx.organisationId}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomBytes(12).toString("hex")}-${filename}`;
  await getStorage().put(storageKey, input.data, mimeType);
  const size = (IMAGE_TYPES as readonly string[]).includes(mimeType) ? imageSize(mimeType, input.data) : null;
  try {
    const asset = await prisma.mediaAsset.create({
      data: {
        organisationId: ctx.organisationId,
        storageKey,
        filename,
        mimeType,
        size: input.data.length,
        width: size?.width ?? null,
        height: size?.height ?? null,
        altText: input.altText?.slice(0, 300) || null,
        title: input.title?.slice(0, 200) || null,
        visibility: input.visibility ?? "PUBLIC",
        checksum: createHash("sha256").update(input.data).digest("hex"),
        uploadedById: ctx.user.id,
      },
    });
    await audit(actorOf(ctx), { action: "media.upload", entityType: "MediaAsset", entityId: asset.id, summary: `Uploaded ${filename} (${asset.visibility.toLowerCase()})` });
    return asset;
  } catch (err) {
    await getStorage().delete(storageKey).catch(() => {});
    throw err;
  }
}

export function publicMediaUrl(asset: Pick<MediaAsset, "id" | "filename">) {
  return `/media/${asset.id}/${encodeURIComponent(asset.filename)}`;
}

export function privateFileUrl(asset: Pick<MediaAsset, "id">) {
  return `/api/files/${asset.id}`;
}

export type MediaFilters = ListQuery & { kind?: string; visibility?: string };

export async function listMedia(ctx: OrgContext, q: MediaFilters) {
  assertCan(ctx, "media.read");
  const where: Prisma.MediaAssetWhereInput = {
    organisationId: ctx.organisationId,
    // Files that belong to documents are managed in Reports & Documents.
    documentVersions: { none: {} },
    ...(q.kind === "image" ? { mimeType: { startsWith: "image/" } } : q.kind === "document" ? { NOT: { mimeType: { startsWith: "image/" } } } : {}),
    ...(q.visibility === "PUBLIC" || q.visibility === "PRIVATE" ? { visibility: q.visibility } : {}),
    ...(q.q ? { OR: [{ filename: { contains: q.q, mode: "insensitive" } }, { title: { contains: q.q, mode: "insensitive" } }, { altText: { contains: q.q, mode: "insensitive" } }] } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.mediaAsset.findMany({ where, orderBy: { createdAt: "desc" }, ...skipTake(q), include: { uploadedBy: { select: { name: true } } } }),
    prisma.mediaAsset.count({ where }),
  ]);
  return paged(items, total, q);
}

const metaSchema = z.object({
  altText: z.string().trim().max(300).optional().default(""),
  title: z.string().trim().max(200).optional().default(""),
  description: z.string().trim().max(1000).optional().default(""),
  visibility: z.enum(["PUBLIC", "PRIVATE"]),
});

export async function updateMediaMeta(ctx: OrgContext, id: string, input: unknown) {
  assertCan(ctx, "media.write");
  const asset = ensureOwned(ctx, await prisma.mediaAsset.findUnique({ where: { id }, include: { documentVersions: { select: { id: true } } } }), "File");
  const data = parseInput(metaSchema, input);
  if (asset.documentVersions.length && data.visibility !== asset.visibility) throw new ValidationError("Visibility of document files is controlled by the document");
  const updated = await prisma.mediaAsset.update({ where: { id }, data: { altText: data.altText || null, title: data.title || null, description: data.description || null, visibility: data.visibility } });
  await audit(actorOf(ctx), { action: "media.update", entityType: "MediaAsset", entityId: id, summary: `Updated ${asset.filename}${asset.visibility !== data.visibility ? ` (now ${data.visibility.toLowerCase()})` : ""}` });
  invalidateSite(ctx.organisationId);
  return updated;
}

/** Replace the file content while keeping the asset ID (and therefore its references). */
export async function replaceMediaFile(ctx: OrgContext, id: string, filename: string, data: Buffer) {
  assertCan(ctx, "media.write");
  const asset = ensureOwned(ctx, await prisma.mediaAsset.findUnique({ where: { id } }), "File");
  if (data.length > maxUploadBytes()) throw new ValidationError("File is too large");
  const mimeType = detectFileType(filename, data);
  if (asset.mimeType.startsWith("image/") !== mimeType.startsWith("image/")) throw new ValidationError("Replace an image with another image, or a document with another document");
  const newKey = `${ctx.organisationId}/replaced/${randomBytes(12).toString("hex")}-${safeFilename(filename)}`;
  await getStorage().put(newKey, data, mimeType);
  const size = mimeType.startsWith("image/") ? imageSize(mimeType, data) : null;
  await prisma.mediaAsset.update({
    where: { id },
    data: { storageKey: newKey, mimeType, size: data.length, width: size?.width ?? null, height: size?.height ?? null, checksum: createHash("sha256").update(data).digest("hex") },
  });
  await getStorage().delete(asset.storageKey).catch(() => {});
  await audit(actorOf(ctx), { action: "media.replace", entityType: "MediaAsset", entityId: id, summary: `Replaced file ${asset.filename}` });
  invalidateSite(ctx.organisationId);
}

/** Lists places where an asset is referenced so deletion can be blocked safely. */
export async function mediaUsage(ctx: OrgContext, id: string) {
  const usage: string[] = [];
  const asset = await prisma.mediaAsset.findFirst({
    where: { id, organisationId: ctx.organisationId },
    include: {
      _count: { select: { logoOf: true, faviconOf: true, projectCovers: true, projectMedia: true, postFeatured: true, postOg: true, documentVersions: true, authorAvatars: true, pageOgImages: true } },
    },
  });
  if (!asset) throw new NotFoundError("File");
  const c = asset._count;
  if (c.logoOf || c.faviconOf) usage.push("organisation branding");
  if (c.projectCovers || c.projectMedia) usage.push("projects");
  if (c.postFeatured || c.postOg) usage.push("blog posts");
  if (c.documentVersions) usage.push("documents");
  if (c.authorAvatars) usage.push("author profiles");
  if (c.pageOgImages) usage.push("page SEO images");
  const needle = `%${id}%`;
  const [sections, settings, posts] = await Promise.all([
    prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*)::bigint AS n FROM "PageSection" WHERE "organisationId" = ${ctx.organisationId} AND "props"::text LIKE ${needle}`,
    prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*)::bigint AS n FROM "WebsiteSettings" WHERE "organisationId" = ${ctx.organisationId} AND "draftConfig"::text LIKE ${needle}`,
    prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*)::bigint AS n FROM "BlogPost" WHERE "organisationId" = ${ctx.organisationId} AND "content" LIKE ${needle}`,
  ]);
  if (Number(sections[0]?.n ?? 0) > 0) usage.push("website pages");
  if (Number(settings[0]?.n ?? 0) > 0) usage.push("website header/footer settings");
  if (Number(posts[0]?.n ?? 0) > 0) usage.push("blog post content");
  return usage;
}

export async function deleteMedia(ctx: OrgContext, id: string) {
  assertCan(ctx, "media.write");
  const asset = ensureOwned(ctx, await prisma.mediaAsset.findUnique({ where: { id } }), "File");
  const usage = await mediaUsage(ctx, id);
  if (usage.length) throw new ValidationError(`This file is still used in: ${usage.join(", ")}. Remove it there first.`);
  await prisma.mediaAsset.delete({ where: { id } });
  await getStorage().delete(asset.storageKey).catch(() => {});
  await audit(actorOf(ctx), { action: "media.delete", entityType: "MediaAsset", entityId: id, summary: `Deleted ${asset.filename}` });
  invalidateSite(ctx.organisationId);
}

/**
 * Authorises access to a private file for a signed-in member. Files attached
 * to documents follow the document's visibility rules.
 */
export async function authorisePrivateFile(ctx: OrgContext, id: string) {
  const asset = await prisma.mediaAsset.findFirst({
    where: { id, organisationId: ctx.organisationId },
    include: { documentVersions: { include: { document: { select: { visibility: true } } } } },
  });
  if (!asset) throw new NotFoundError("File");
  const docs = asset.documentVersions.map((v) => v.document);
  if (docs.length) {
    if (!can(ctx, "document.read")) throw new ForbiddenError();
    if (docs.some((d) => d.visibility === "CONFIDENTIAL") && !can(ctx, "document.confidential")) throw new ForbiddenError();
  } else if (!can(ctx, "media.read") && !can(ctx, "document.read")) {
    throw new ForbiddenError();
  }
  return asset;
}

export async function readAsset(asset: Pick<MediaAsset, "storageKey">) {
  return getStorage().get(asset.storageKey);
}
