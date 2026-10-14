import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { actorOf, assertCan, can, ensureOwned, type OrgContext } from "../context";
import { audit } from "../audit";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../errors";
import { parseInput } from "../validation";
import { sanitizeRichText } from "../sanitize";
import { invalidateSite } from "../cache";
import { logger } from "../logger";
import { zCheckbox, zOptDate, zOptId, zOptText, zOptUrl, zSlug, zText } from "@/lib/zod-helpers";
import { readingMinutes, slugify, stripHtml, truncate } from "@/lib/utils";
import { enumOrUndefined, paged, skipTake, type ListQuery } from "./common";
import { notifyPermission } from "./notifications";

export const POST_STATUSES = ["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"] as const;

/** Prisma filter for posts visible to anonymous visitors. */
export function publicPostWhere(organisationId: string, now = new Date()): Prisma.BlogPostWhereInput {
  return {
    organisationId,
    OR: [
      { status: "PUBLISHED", publishedAt: { lte: now } },
      // Scheduled posts become visible at their time even if the job has not yet run.
      { status: "SCHEDULED", scheduledFor: { lte: now } },
    ],
  };
}

const postSchema = z.object({
  title: zText(200),
  slug: zSlug.optional().or(z.literal("")),
  excerpt: zOptText(500),
  content: z.string().max(200000).default(""),
  featuredImageId: zOptId,
  ogImageId: zOptId,
  seoTitle: zOptText(120),
  seoDescription: zOptText(300),
  canonicalUrl: zOptUrl,
  isFeatured: zCheckbox,
  categoryIds: z.array(z.string().max(60)).max(20).default([]),
  tagNames: z
    .string()
    .max(500)
    .optional()
    .transform((v) =>
      (v ?? "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 20),
    ),
});

export type PostFilters = ListQuery & { categoryId?: string; mine?: string };

export async function listPosts(ctx: OrgContext, q: PostFilters) {
  assertCan(ctx, "blog.write");
  const status = enumOrUndefined(q.status, POST_STATUSES);
  const where: Prisma.BlogPostWhereInput = {
    organisationId: ctx.organisationId,
    ...(status ? { status } : {}),
    ...(q.categoryId ? { categories: { some: { id: q.categoryId } } } : {}),
    ...(!can(ctx, "blog.edit_any") || q.mine === "1" ? { authorId: ctx.user.id } : {}),
    ...(q.q ? { title: { contains: q.q, mode: "insensitive" } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.blogPost.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      ...skipTake(q),
      include: { author: { select: { name: true } }, categories: { select: { name: true } } },
    }),
    prisma.blogPost.count({ where }),
  ]);
  return paged(items, total, q);
}

async function getEditablePost(ctx: OrgContext, id: string) {
  assertCan(ctx, "blog.write");
  const post = await prisma.blogPost.findFirst({
    where: { id, organisationId: ctx.organisationId },
    include: { categories: true, tags: true, featuredImage: true, ogImage: true, author: { select: { id: true, name: true } } },
  });
  if (!post) throw new NotFoundError("Post");
  if (post.authorId !== ctx.user.id && !can(ctx, "blog.edit_any")) throw new ForbiddenError("You can only edit your own posts");
  return post;
}

export async function getPostForEdit(ctx: OrgContext, id: string) {
  const post = await getEditablePost(ctx, id);
  const history = await prisma.auditLog.findMany({
    where: { organisationId: ctx.organisationId, entityType: "BlogPost", entityId: id },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { actor: { select: { name: true } } },
  });
  return { ...post, history };
}

async function validateImages(ctx: OrgContext, ids: (string | null | undefined)[]) {
  for (const id of ids) {
    if (!id) continue;
    const asset = await prisma.mediaAsset.findFirst({ where: { id, organisationId: ctx.organisationId, visibility: "PUBLIC", mimeType: { startsWith: "image/" } } });
    if (!asset) throw new ValidationError("Images must be public images from the media library");
  }
}

async function resolveTaxonomy(tx: Prisma.TransactionClient, ctx: OrgContext, categoryIds: string[], tagNames: string[]) {
  const categories = await tx.category.findMany({ where: { id: { in: categoryIds }, organisationId: ctx.organisationId }, select: { id: true } });
  const tags: { id: string }[] = [];
  for (const name of tagNames) {
    const slug = slugify(name);
    if (!slug) continue;
    const tag = await tx.tag.upsert({
      where: { organisationId_slug: { organisationId: ctx.organisationId, slug } },
      create: { organisationId: ctx.organisationId, name: name.slice(0, 60), slug },
      update: {},
      select: { id: true },
    });
    tags.push(tag);
  }
  return { categories, tags };
}

export async function savePost(ctx: OrgContext, id: string | null, input: unknown) {
  assertCan(ctx, "blog.write");
  const data = parseInput(postSchema, input);
  await validateImages(ctx, [data.featuredImageId, data.ogImageId]);
  const content = sanitizeRichText(data.content);
  const values = {
    title: data.title,
    slug: data.slug || slugify(data.title),
    excerpt: data.excerpt || truncate(stripHtml(content), 240) || null,
    content,
    featuredImageId: data.featuredImageId ?? null,
    ogImageId: data.ogImageId ?? null,
    seoTitle: data.seoTitle,
    seoDescription: data.seoDescription,
    canonicalUrl: data.canonicalUrl,
    isFeatured: data.isFeatured,
    readingMinutes: readingMinutes(content),
  };
  if (!values.slug) throw new ValidationError("Enter a slug", { slug: ["Required"] });
  if (id) await getEditablePost(ctx, id);
  try {
    const post = await prisma.$transaction(async (tx) => {
      const { categories, tags } = await resolveTaxonomy(tx, ctx, data.categoryIds, data.tagNames);
      const p = id
        ? await tx.blogPost.update({ where: { id }, data: { ...values, categories: { set: categories }, tags: { set: tags } } })
        : await tx.blogPost.create({ data: { ...values, organisationId: ctx.organisationId, authorId: ctx.user.id, categories: { connect: categories }, tags: { connect: tags } } });
      await audit(actorOf(ctx), { action: id ? "blog.update" : "blog.create", entityType: "BlogPost", entityId: p.id, summary: `${id ? "Updated" : "Created"} post ${p.title}` }, tx);
      return p;
    });
    if (post.status === "PUBLISHED") invalidateSite(ctx.organisationId);
    return post;
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") throw new ConflictError("A post with this slug exists", { slug: ["Already in use"] });
    throw err;
  }
}

const publishSchema = z.object({
  action: z.enum(["publish", "schedule", "unpublish", "archive", "submit"]),
  scheduledFor: zOptDate,
});

export async function changePostStatus(ctx: OrgContext, id: string, input: unknown) {
  const { action, scheduledFor } = parseInput(publishSchema, input);
  const post = await getEditablePost(ctx, id);
  if (action === "submit") {
    await notifyPermission(ctx.organisationId, "blog.publish", { type: "blog.review", title: `Post ready for review: ${post.title}`, link: `/admin/blog/${id}/edit` }, ctx.user.id);
    await audit(actorOf(ctx), { action: "blog.submit", entityType: "BlogPost", entityId: id, summary: `Submitted ${post.title} for review` });
    return post;
  }
  assertCan(ctx, "blog.publish");
  let data: Prisma.BlogPostUpdateInput;
  switch (action) {
    case "publish":
      if (!post.content.trim()) throw new ValidationError("Add content before publishing");
      data = { status: "PUBLISHED", publishedAt: post.publishedAt ?? new Date(), scheduledFor: null };
      break;
    case "schedule":
      if (!scheduledFor || scheduledFor.getTime() <= Date.now() + 30_000)
        throw new ValidationError("Choose a date and time in the future", { scheduledFor: ["Must be in the future"] });
      data = { status: "SCHEDULED", scheduledFor, publishedAt: null };
      break;
    case "unpublish":
      data = { status: "DRAFT", scheduledFor: null };
      break;
    case "archive":
      data = { status: "ARCHIVED", scheduledFor: null };
      break;
  }
  const updated = await prisma.blogPost.update({ where: { id }, data });
  await audit(actorOf(ctx), {
    action: `blog.${action}`,
    entityType: "BlogPost",
    entityId: id,
    summary: `${{ publish: "Published", schedule: `Scheduled for ${scheduledFor?.toISOString()}`, unpublish: "Unpublished", archive: "Archived" }[action]}: ${post.title}`,
  });
  invalidateSite(ctx.organisationId);
  return updated;
}

export async function deletePost(ctx: OrgContext, id: string) {
  const post = await getEditablePost(ctx, id);
  if (post.status === "PUBLISHED") assertCan(ctx, "blog.publish");
  await prisma.blogPost.delete({ where: { id } });
  await audit(actorOf(ctx), { action: "blog.delete", entityType: "BlogPost", entityId: id, summary: `Deleted post ${post.title}` });
  invalidateSite(ctx.organisationId);
}

/** Background job: publish scheduled posts that are due. Idempotent. */
export async function publishDueScheduledPosts(now = new Date()) {
  const due = await prisma.blogPost.findMany({ where: { status: "SCHEDULED", scheduledFor: { lte: now } }, select: { id: true, organisationId: true, title: true, scheduledFor: true } });
  for (const p of due) {
    const res = await prisma.blogPost.updateMany({ where: { id: p.id, status: "SCHEDULED" }, data: { status: "PUBLISHED", publishedAt: p.scheduledFor, scheduledFor: null } });
    if (res.count) {
      await audit({ userId: null, organisationId: p.organisationId }, { action: "blog.publish_scheduled", entityType: "BlogPost", entityId: p.id, summary: `Scheduled post published: ${p.title}` });
      invalidateSite(p.organisationId);
      logger.info("published scheduled post", { postId: p.id });
    }
  }
  return due.length;
}

// ---------------------------------------------------------------------------
// Categories, tags and authors
// ---------------------------------------------------------------------------

const termSchema = z.object({ name: zText(80), slug: zSlug.optional().or(z.literal("")), description: zOptText(500) });

export async function listCategories(ctx: OrgContext) {
  assertCan(ctx, "blog.write");
  return prisma.category.findMany({ where: { organisationId: ctx.organisationId }, orderBy: { name: "asc" }, include: { _count: { select: { posts: true } } } });
}

export async function saveCategory(ctx: OrgContext, id: string | null, input: unknown) {
  assertCan(ctx, "blog.taxonomy");
  const data = parseInput(termSchema, input);
  const slug = data.slug || slugify(data.name);
  try {
    if (id) {
      ensureOwned(ctx, await prisma.category.findUnique({ where: { id } }), "Category");
      return await prisma.category.update({ where: { id }, data: { ...data, slug } });
    }
    return await prisma.category.create({ data: { ...data, slug, organisationId: ctx.organisationId } });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") throw new ConflictError("A category with this slug exists", { slug: ["Already in use"] });
    throw err;
  }
}

export async function deleteCategory(ctx: OrgContext, id: string) {
  assertCan(ctx, "blog.taxonomy");
  ensureOwned(ctx, await prisma.category.findUnique({ where: { id } }), "Category");
  await prisma.category.delete({ where: { id } });
  invalidateSite(ctx.organisationId);
}

export async function listTags(ctx: OrgContext) {
  assertCan(ctx, "blog.write");
  return prisma.tag.findMany({ where: { organisationId: ctx.organisationId }, orderBy: { name: "asc" }, include: { _count: { select: { posts: true } } } });
}

export async function saveTag(ctx: OrgContext, id: string | null, input: unknown) {
  assertCan(ctx, "blog.taxonomy");
  const data = parseInput(termSchema.omit({ description: true }), input);
  const slug = data.slug || slugify(data.name);
  try {
    if (id) {
      ensureOwned(ctx, await prisma.tag.findUnique({ where: { id } }), "Tag");
      return await prisma.tag.update({ where: { id }, data: { name: data.name, slug } });
    }
    return await prisma.tag.create({ data: { name: data.name, slug, organisationId: ctx.organisationId } });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") throw new ConflictError("A tag with this slug exists", { slug: ["Already in use"] });
    throw err;
  }
}

export async function deleteTag(ctx: OrgContext, id: string) {
  assertCan(ctx, "blog.taxonomy");
  ensureOwned(ctx, await prisma.tag.findUnique({ where: { id } }), "Tag");
  await prisma.tag.delete({ where: { id } });
  invalidateSite(ctx.organisationId);
}

export async function listAuthors(ctx: OrgContext) {
  assertCan(ctx, "blog.write");
  const members = await prisma.membership.findMany({
    where: { organisationId: ctx.organisationId, isActive: true },
    include: { user: { select: { id: true, name: true, _count: { select: { blogPosts: { where: { organisationId: ctx.organisationId } } } } } } },
    orderBy: { user: { name: "asc" } },
  });
  const profiles = await prisma.authorProfile.findMany({ where: { organisationId: ctx.organisationId }, include: { avatar: true } });
  return members
    .filter((m) => ["ORG_ADMIN", "CONTENT_EDITOR", "AUTHOR", "CSR_MANAGER"].includes(m.role) || m.user._count.blogPosts > 0)
    .map((m) => ({ user: m.user, role: m.role, profile: profiles.find((p) => p.userId === m.userId) ?? null }));
}

const authorSchema = z.object({ displayName: zText(120), bio: zOptText(1000), avatarId: zOptId });

export async function saveAuthorProfile(ctx: OrgContext, userId: string, input: unknown) {
  if (userId !== ctx.user.id) assertCan(ctx, "blog.edit_any");
  else assertCan(ctx, "blog.write");
  if (!(await prisma.membership.findFirst({ where: { userId, organisationId: ctx.organisationId } }))) throw new NotFoundError("Author");
  const data = parseInput(authorSchema, input);
  await validateImages(ctx, [data.avatarId]);
  await prisma.authorProfile.upsert({
    where: { organisationId_userId: { organisationId: ctx.organisationId, userId } },
    create: { ...data, organisationId: ctx.organisationId, userId },
    update: data,
  });
  invalidateSite(ctx.organisationId);
}

export async function taxonomyOptions(ctx: OrgContext) {
  const [categories, tags] = await Promise.all([
    prisma.category.findMany({ where: { organisationId: ctx.organisationId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.tag.findMany({ where: { organisationId: ctx.organisationId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return { categories, tags };
}
