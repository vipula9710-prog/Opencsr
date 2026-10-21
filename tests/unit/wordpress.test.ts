import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseWxr, wpContentToHtml } from "@/server/services/wordpress-import";
import { createSafeFetcher, isPrivateAddress } from "@/server/safe-fetch";

const xml = readFileSync("tests/fixtures/wordpress-export.xml", "utf8");

describe("WordPress export parsing", () => {
  it("reads posts, attachments, taxonomy and SEO meta", () => {
    const wxr = parseWxr(xml);
    expect(wxr.siteTitle).toBe("Example Trust Blog");
    expect(wxr.posts).toHaveLength(4);
    expect(wxr.otherItems).toBe(1);
    const first = wxr.posts[0]!;
    expect(first).toMatchObject({ title: "Tree planting & community day", slug: "tree-planting-day", status: "publish", thumbnailId: "9", seoTitle: null, seoDescription: "Our community tree planting day." });
    expect(first.date?.toISOString()).toBe("2024-06-03T10:00:00.000Z");
    expect(first.categories).toEqual([{ name: "Environment", slug: "environment" }]);
    expect(first.tags).toEqual([{ name: "Volunteering", slug: "volunteering" }]);
    expect(wxr.posts[1]!.date).toBeNull();
    expect(wxr.attachments.get("9")).toContain("trees.png");
  });

  it("rejects files that are not WordPress exports", () => {
    expect(() => parseWxr("<rss><channel><title>x</title></channel></rss>")).toThrow(/not a WordPress export/);
    expect(() => parseWxr("not xml <<<")).toThrow();
  });

  it("does not expand external entities", () => {
    const evil = `<?xml version="1.0"?><!DOCTYPE r [<!ENTITY x SYSTEM "file:///etc/passwd">]><rss><channel><wp:wxr_version>1.2</wp:wxr_version><item><title>&x;</title><wp:post_type>post</wp:post_type><wp:status>draft</wp:status></item></channel></rss>`;
    let titles: string[] = [];
    try {
      titles = parseWxr(evil).posts.map((p) => p.title);
    } catch {
      titles = [];
    }
    expect(titles.join("")).not.toContain("root:");
  });
});

describe("WordPress content conversion", () => {
  it("removes block comments and shortcodes, converts captions", () => {
    const html = wpContentToHtml(parseWxr(xml).posts[0]!.content);
    expect(html).not.toMatch(/wp:paragraph|\[gallery|\[caption/);
    expect(html).toContain('<figure><img src="https://wp.example.org/wp-content/uploads/2024/06/trees.png" alt="Volunteers planting" /><figcaption>Volunteers at work</figcaption></figure>');
  });
  it("adds paragraphs to classic-editor text and keeps bracketed numbers", () => {
    expect(wpContentToHtml("First line\nsecond line\n\nSecond paragraph with [1] reference.")).toBe("<p>First line<br />second line</p>\n<p>Second paragraph with [1] reference.</p>");
  });
});

describe("safe remote fetching", () => {
  it("classifies private and public addresses", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:7f00:1"]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
    for (const ip of ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"]) expect(isPrivateAddress(ip), ip).toBe(false);
  });
  it("refuses internal URLs, other schemes and ports before connecting", async () => {
    const fetch = createSafeFetcher({ maxBytes: 1024 });
    for (const url of ["http://127.0.0.1/x.png", "http://169.254.169.254/latest/meta-data", "http://localhost/x", "file:///etc/passwd", "https://example.org:8080/x.png", "http://[::1]/x", "http://user:pass@example.org/x"]) {
      await expect(fetch(url), url).rejects.toThrow();
    }
  });
});
