import { describe, expect, it } from "vitest";
import { coerceTokens, themeTokensSchema } from "@/lib/theme/tokens";
import { themeToCssVars, cssVarsToString } from "@/lib/theme/css";
import { THEME_TEMPLATES, defaultTokens } from "@/lib/theme/templates";
import { contrastRatio, contrastWarnings } from "@/lib/theme/contrast";
import { defaultSectionProps, SECTION_DEFINITIONS, validateSectionProps, mapRichText } from "@/lib/site/sections";
import { siteConfigSchema, defaultSiteConfig } from "@/lib/site/config";

describe("theme tokens", () => {
  it("every template is a complete, valid token set", () => {
    for (const t of THEME_TEMPLATES) expect(themeTokensSchema.safeParse(t.tokens).success).toBe(true);
    expect(THEME_TEMPLATES.map((t) => t.name)).toEqual(["Corporate Green", "Professional Blue", "Minimal White", "Earth & Sustainability", "Premium Charcoal"]);
  });
  it("rejects invalid colours and CSS injection attempts", () => {
    const t = defaultTokens();
    expect(themeTokensSchema.safeParse({ ...t, colors: { ...t.colors, primary: "red;}body{display:none" } }).success).toBe(false);
    expect(themeTokensSchema.safeParse({ ...t, colors: { ...t.colors, primary: "#12345" } }).success).toBe(false);
    expect(themeTokensSchema.safeParse({ ...t, typography: { ...t.typography, headingFont: "url(http://evil)" } }).success).toBe(false);
  });
  it("coerces partially invalid stored themes key by key", () => {
    const t = defaultTokens();
    const out = coerceTokens({ ...t, colors: { ...t.colors, primary: "javascript:", accent: "#ABCDEF" } }, t);
    expect(out.colors.primary).toBe(t.colors.primary);
    expect(out.colors.accent).toBe("#ABCDEF");
  });
  it("generates CSS variables only from validated values", () => {
    const vars = themeToCssVars(defaultTokens());
    expect(vars["--c-primary"]).toBe("#176B45");
    expect(vars["--font-heading"]).toContain("Noto Sans Devanagari");
    const css = cssVarsToString(vars);
    expect(css).not.toMatch(/[<>]/);
  });
  it("computes WCAG contrast", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBe(21);
    const t = defaultTokens();
    expect(contrastWarnings({ ...t.colors, text: "#FFFFFF", background: "#FFFFFF" }).length).toBeGreaterThan(0);
  });
});

describe("section registry", () => {
  it("provides valid defaults for every section type", () => {
    expect(SECTION_DEFINITIONS.length).toBeGreaterThanOrEqual(16);
    for (const d of SECTION_DEFINITIONS) expect(validateSectionProps(d.type, defaultSectionProps(d.type)).ok).toBe(true);
  });
  it("rejects unknown types and unsafe links", () => {
    expect(validateSectionProps("script", {}).ok).toBe(false);
    const props = { ...defaultSectionProps("hero"), primaryButton: { label: "x", href: "javascript:alert(1)" } };
    expect(validateSectionProps("hero", props).ok).toBe(false);
  });
  it("applies sanitisation to rich text fields including lists", () => {
    const out = mapRichText("richText", { content: "<b>x</b>" }, () => "SANITISED");
    expect(out.content).toBe("SANITISED");
  });
});

describe("site configuration", () => {
  it("defaults are valid and title templates require %s", () => {
    const c = defaultSiteConfig({ name: "Org" });
    expect(siteConfigSchema.safeParse(c).success).toBe(true);
    expect(siteConfigSchema.safeParse({ ...c, seo: { ...c.seo, titleTemplate: "no placeholder" } }).success).toBe(false);
  });
});
