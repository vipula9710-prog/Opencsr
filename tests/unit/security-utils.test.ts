import { describe, expect, it } from "vitest";
import { sanitizeRichText } from "@/server/sanitize";
import { toCsv } from "@/lib/csv";
import { isSafeHref, isSafeImageUrl } from "@/lib/site/links";
import { signPayload, verifyPayload } from "@/server/auth/tokens";
import { detectFileType } from "@/server/services/media";

describe("rich text sanitisation", () => {
  it("removes scripts, handlers and javascript URLs", () => {
    const out = sanitizeRichText(`<p onclick="x()">Hi<script>alert(1)</script></p><a href="javascript:alert(1)">x</a><img src=x onerror=alert(1)><iframe src="//evil"></iframe>`);
    expect(out).not.toMatch(/script|onclick|onerror|javascript:|iframe/i);
    expect(out).toContain("<p>Hi</p>");
  });
  it("keeps safe formatting and makes external links safe", () => {
    const out = sanitizeRichText(`<h2>T</h2><a href="https://example.org">e</a><a href="/about">a</a>`);
    expect(out).toContain('rel="noopener noreferrer nofollow"');
    expect(out).toContain('href="/about"');
  });
});

describe("CSV export", () => {
  it("escapes quotes and blocks formula injection", () => {
    const csv = toCsv(["a", "b"], [["=HYPERLINK(1)", 'say "hi"'], ["-5", "@cmd"]]);
    expect(csv).toContain("'=HYPERLINK(1)");
    expect(csv).toContain('"say ""hi"""');
    expect(csv).toContain("-5,'@cmd");
  });
});

describe("link and image validation", () => {
  it("accepts safe destinations only", () => {
    expect(isSafeHref("/about")).toBe(true);
    expect(isSafeHref("#contact")).toBe(true);
    expect(isSafeHref("https://example.org/x")).toBe(true);
    expect(isSafeHref("mailto:a@example.org")).toBe(true);
    expect(isSafeHref("javascript:alert(1)")).toBe(false);
    expect(isSafeHref("//evil.example")).toBe(false);
    expect(isSafeHref("data:text/html,x")).toBe(false);
  });
  it("restricts images to media library, bundled assets or https", () => {
    expect(isSafeImageUrl("/media/abc/x.png")).toBe(true);
    expect(isSafeImageUrl("/demo/greenfuture-logo.svg")).toBe(true);
    expect(isSafeImageUrl("/media/../../etc/passwd")).toBe(false);
    expect(isSafeImageUrl("http://insecure.example/x.png")).toBe(false);
  });
});

describe("signed tokens", () => {
  it("detects tampering", () => {
    const t = signPayload({ o: "org1", t: 1 });
    expect(verifyPayload<{ o: string }>(t)?.o).toBe("org1");
    const [body] = t.split(".");
    expect(verifyPayload(`${body}.forged`)).toBeNull();
  });
});

describe("upload type detection", () => {
  it("accepts real PNG and PDF content", () => {
    expect(detectFileType("a.png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]))).toBe("image/png");
    expect(detectFileType("a.pdf", Buffer.from("%PDF-1.7 test"))).toBe("application/pdf");
  });
  it("rejects SVG, HTML and mismatched content", () => {
    expect(() => detectFileType("a.svg", Buffer.from("<svg onload=alert(1)>"))).toThrow();
    expect(() => detectFileType("a.html", Buffer.from("<html>"))).toThrow();
    expect(() => detectFileType("a.png", Buffer.from("%PDF-1.7"))).toThrow();
    expect(() => detectFileType("a.txt", Buffer.from("<script>alert(1)</script>"))).toThrow();
  });
});
