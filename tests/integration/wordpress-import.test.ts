import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import type { OrgContext } from "@/server/context";
import { importWordPress } from "@/server/services/wordpress-import";
import type { RemoteFetcher } from "@/server/safe-fetch";
import { makeOrg, member } from "../helpers";

const xml = readFileSync("tests/fixtures/wordpress-export.xml", "utf8");
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 2, 0, 0, 0, 2, 8, 2, 0, 0, 0]);
const NOW = new Date("2026-01-01T00:00:00Z");

let ctx: OrgContext;
const fetched: string[] = [];
const fakeFetcher: RemoteFetcher = async (url) => {
  fetched.push(url);
  return { data: PNG, contentType: "image/png", finalUrl: url };
};

beforeAll(async () => {
  ctx = (await makeOrg()).ctx;
});

describe("WordPress import", () => {
  it("imports posts with statuses, taxonomy, images and sanitised content", async () => {
    const report = await importWordPress(ctx, xml, { importImages: true, asDrafts: false, fetcher: fakeFetcher, now: NOW });
    expect(report).toMatchObject({ found: 4, imported: 3, published: 1, scheduled: 1, drafts: 1, otherItems: 1 });
    expect(report.skipped.map((s) => s.title)).toEqual(["Deleted post"]);
    expect(report.images.imported).toBe(1); // same URL used inline and as featured image
    expect(fetched).toHaveLength(1);

    const posts = await prisma.blogPost.findMany({ where: { organisationId: ctx.organisationId }, include: { categories: true, tags: true, featuredImage: true } });
    const tree = posts.find((p) => p.slug === "tree-planting-day")!;
    expect(tree.status).toBe("PUBLISHED");
    expect(tree.publishedAt?.toISOString()).toBe("2024-06-03T10:00:00.000Z");
    expect(tree.authorId).toBe(ctx.user.id);
    expect(tree.categories.map((c) => c.name)).toEqual(["Environment"]);
    expect(tree.tags.map((t) => t.name)).toEqual(["Volunteering"]);
    expect(tree.featuredImage?.visibility).toBe("PUBLIC");
    expect(tree.content).not.toMatch(/<script|wp\.example\.org/);
    expect(tree.content).toContain(`/media/${tree.featuredImageId}/`);
    expect(tree.seoDescription).toBe("Our community tree planting day.");
    expect(tree.seoTitle).toBeNull();
    expect(tree.excerpt).toBe("A day of planting.");

    const classic = posts.find((p) => p.title === "Classic editor post")!;
    expect(classic.slug).toBe("classic-editor-post");
    expect(classic.status).toBe("DRAFT");
    expect(classic.content).toContain("<p>First line<br />second line</p>");

    const future = posts.find((p) => p.slug === "coming-soon")!;
    expect(future.status).toBe("SCHEDULED");
    expect(future.scheduledFor?.toISOString()).toBe("2099-01-01T09:00:00.000Z");

    // Categories are shared, not duplicated.
    expect(await prisma.category.count({ where: { organisationId: ctx.organisationId, slug: "environment" } })).toBe(1);
  });

  it("is safe to run again: existing posts are skipped", async () => {
    const report = await importWordPress(ctx, xml, { importImages: false, asDrafts: false, now: NOW });
    expect(report.imported).toBe(0);
    expect(report.skipped).toHaveLength(4);
  });

  it("imports as drafts for authors without publish permission and when requested", async () => {
    const other = (await makeOrg()).ctx;
    const r1 = await importWordPress(other, xml, { importImages: false, asDrafts: true, now: NOW });
    expect(r1).toMatchObject({ published: 0, scheduled: 0, drafts: 3 });
    const third = (await makeOrg()).ctx;
    const authorInThird = await member(third.organisationId, "AUTHOR");
    const r2 = await importWordPress(authorInThird, xml, { importImages: false, asDrafts: false, now: NOW });
    expect(r2).toMatchObject({ published: 0, drafts: 3, publishingDowngraded: true });
  });

  it("requires permission and keeps imports within the organisation", async () => {
    const viewer = await member(ctx.organisationId, "VIEWER");
    await expect(importWordPress(viewer, xml, { importImages: false, asDrafts: true })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const other = (await makeOrg()).ctx;
    await importWordPress(other, xml, { importImages: false, asDrafts: true, now: NOW });
    expect(await prisma.blogPost.count({ where: { organisationId: other.organisationId } })).toBe(3);
    // The first organisation's posts are unchanged by another organisation's import.
    expect(await prisma.blogPost.count({ where: { organisationId: ctx.organisationId } })).toBe(3);
  });

  it("records failed image downloads without failing the import", async () => {
    const other = (await makeOrg()).ctx;
    const failing: RemoteFetcher = async () => {
      throw new Error("HTTP 404");
    };
    const report = await importWordPress(other, xml, { importImages: true, asDrafts: true, fetcher: failing, now: NOW });
    expect(report.imported).toBe(3);
    expect(report.images.failed[0]).toMatchObject({ reason: "HTTP 404" });
    const post = await prisma.blogPost.findFirstOrThrow({ where: { organisationId: other.organisationId, slug: "tree-planting-day" } });
    expect(post.featuredImageId).toBeNull();
    expect(post.content).toContain("https://wp.example.org/wp-content/uploads/2024/06/trees.png");
  });
});
