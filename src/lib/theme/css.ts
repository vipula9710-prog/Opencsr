import { fontStack, FONTS } from "./fonts";
import type { ThemeTokens } from "./tokens";
import { HEX } from "./tokens";

const SHADOWS = {
  none: "none",
  sm: "0 1px 2px rgba(0,0,0,.06), 0 1px 3px rgba(0,0,0,.08)",
  md: "0 4px 12px rgba(0,0,0,.08), 0 2px 4px rgba(0,0,0,.06)",
  lg: "0 12px 32px rgba(0,0,0,.12), 0 4px 8px rgba(0,0,0,.06)",
} as const;

const SECTION_SPACING = { compact: "3rem", normal: "5rem", relaxed: "7rem" } as const;
const CONTENT_WIDTH = { narrow: "64rem", normal: "76rem", wide: "90rem" } as const;
const BUTTON_PADDING = { sm: ["0.5rem", "1rem", "0.875rem"], md: ["0.75rem", "1.5rem", "1rem"], lg: ["1rem", "2rem", "1.125rem"] } as const;

function kebab(s: string) {
  return s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

/**
 * Converts validated theme tokens into CSS custom properties. Every value is
 * derived from validated enums, numbers or HEX colours, so no user-supplied
 * string is ever emitted into CSS directly.
 */
export function themeToCssVars(tokens: ThemeTokens): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [key, value] of Object.entries(tokens.colors)) {
    if (HEX.test(value)) vars[`--c-${kebab(key)}`] = value;
  }
  const t = tokens.typography;
  const devanagari = `'${FONTS[t.devanagariFont].stack.split(",")[0]!.replace(/'/g, "")}'`;
  vars["--font-heading"] = fontStack(t.headingFont, devanagari);
  vars["--font-body"] = fontStack(t.bodyFont, devanagari);
  vars["--fs-base"] = `${t.baseSize}px`;
  for (const h of ["h1", "h2", "h3", "h4", "h5", "h6"] as const) vars[`--fs-${h}`] = `${t[h]}rem`;
  vars["--fw-heading"] = String(t.headingWeight);
  vars["--fw-body"] = String(t.bodyWeight);
  vars["--lh-body"] = String(t.lineHeight);
  vars["--lh-heading"] = String(t.headingLineHeight);
  vars["--ls-body"] = `${t.letterSpacing}em`;
  vars["--ls-heading"] = `${t.headingLetterSpacing}em`;
  vars["--para-spacing"] = `${t.paragraphSpacing}em`;
  vars["--link-decoration"] = t.linkUnderline === "always" ? "underline" : "none";
  vars["--link-hover-decoration"] = t.linkUnderline === "none" ? "none" : "underline";
  vars["--btn-weight"] = String(t.buttonWeight);
  vars["--btn-transform"] = t.buttonTransform;
  vars["--btn-ls"] = `${t.buttonLetterSpacing}em`;

  const c = tokens.components;
  vars["--radius"] = `${c.radius}px`;
  vars["--btn-radius"] = c.buttonShape === "pill" ? "999px" : c.buttonShape === "square" ? "0px" : `${Math.min(c.radius, 12)}px`;
  const [py, px, fs] = BUTTON_PADDING[c.buttonSize];
  vars["--btn-py"] = py;
  vars["--btn-px"] = px;
  vars["--btn-fs"] = fs;
  vars["--card-border-width"] = `${c.cardBorderWidth}px`;
  vars["--card-shadow"] = SHADOWS[c.cardShadow];
  vars["--input-radius"] = `${c.inputRadius}px`;
  vars["--badge-radius"] = c.badgeShape === "pill" ? "999px" : c.badgeShape === "square" ? "0px" : "6px";
  vars["--section-py"] = SECTION_SPACING[c.sectionSpacing];
  vars["--content-max"] = CONTENT_WIDTH[c.contentWidth];
  vars["--container-mx"] = c.containerAlign === "center" ? "auto" : "0";
  vars["--img-radius"] = `${c.imageRadius}px`;
  vars["--img-aspect"] = c.imageAspect.replace("/", " / ");
  vars["--grid-cols"] = String(c.gridColumns);
  vars["--icon-radius"] = c.iconStyle === "circle" ? "999px" : c.iconStyle === "square" ? "8px" : "0px";
  vars["--icon-bg"] = c.iconStyle === "outline" ? "transparent" : "var(--c-badge-bg)";
  vars["--divider"] = c.dividerStyle === "none" ? "0 solid transparent" : `1px ${c.dividerStyle === "dotted" ? "dotted" : "solid"} var(--c-border)`;
  return vars;
}

export function cssVarsToString(vars: Record<string, string>, selector = ".site-root"): string {
  const body = Object.entries(vars)
    .map(([k, v]) => `${k}:${v.replace(/[<>{}]/g, "")};`)
    .join("");
  return `${selector}{${body}}`;
}
