import type { ThemeColors } from "./tokens";

function channel(c: number) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

/** Readable text colour (dark or white) for a background. */
export function readableOn(bg: string, dark = "#111111", light = "#FFFFFF") {
  return contrastRatio(bg, dark) >= contrastRatio(bg, light) ? dark : light;
}

export const CONTRAST_PAIRS: { fg: keyof ThemeColors; bg: keyof ThemeColors; label: string; min: number }[] = [
  { fg: "text", bg: "background", label: "Body text on page background", min: 4.5 },
  { fg: "heading", bg: "background", label: "Headings on page background", min: 3 },
  { fg: "text", bg: "surface", label: "Body text on section background", min: 4.5 },
  { fg: "text", bg: "surfaceAlt", label: "Body text on alternate sections", min: 4.5 },
  { fg: "link", bg: "background", label: "Links on page background", min: 4.5 },
  { fg: "muted", bg: "background", label: "Muted text on page background", min: 4.5 },
  { fg: "buttonText", bg: "buttonBg", label: "Button text on button", min: 4.5 },
  { fg: "buttonSecondaryText", bg: "buttonSecondaryBg", label: "Secondary button text", min: 4.5 },
  { fg: "text", bg: "cardBg", label: "Text on cards", min: 4.5 },
  { fg: "inputText", bg: "inputBg", label: "Form field text", min: 4.5 },
  { fg: "badgeText", bg: "badgeBg", label: "Badge text", min: 4.5 },
  { fg: "navText", bg: "navBg", label: "Navigation text", min: 4.5 },
  { fg: "footerText", bg: "footerBg", label: "Footer text", min: 4.5 },
];

export function contrastWarnings(colors: ThemeColors) {
  return CONTRAST_PAIRS.map((p) => ({ ...p, ratio: contrastRatio(colors[p.fg], colors[p.bg]) })).filter(
    (p) => p.ratio < p.min,
  );
}
