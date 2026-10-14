import { z } from "zod";
import { DEVANAGARI_FONT_KEYS, FONT_KEYS } from "./fonts";

export const HEX = /^#[0-9a-fA-F]{6}$/;
export const zHex = z.string().regex(HEX, "Use a 6-digit HEX colour such as #176B45");

export const COLOR_GROUPS: { title: string; keys: { key: ColorKey; label: string }[] }[] = [
  {
    title: "Brand",
    keys: [
      { key: "primary", label: "Primary" },
      { key: "secondary", label: "Secondary" },
      { key: "accent", label: "Accent" },
    ],
  },
  {
    title: "Page & sections",
    keys: [
      { key: "background", label: "Page background" },
      { key: "surface", label: "Section background" },
      { key: "surfaceAlt", label: "Alternate section background" },
      { key: "heading", label: "Headings" },
      { key: "text", label: "Body text" },
      { key: "muted", label: "Muted text" },
      { key: "link", label: "Links" },
      { key: "border", label: "Borders" },
    ],
  },
  {
    title: "Buttons",
    keys: [
      { key: "buttonBg", label: "Button background" },
      { key: "buttonText", label: "Button text" },
      { key: "buttonSecondaryBg", label: "Secondary button background" },
      { key: "buttonSecondaryText", label: "Secondary button text" },
    ],
  },
  {
    title: "Cards & forms",
    keys: [
      { key: "cardBg", label: "Card background" },
      { key: "inputBg", label: "Form field background" },
      { key: "inputBorder", label: "Form field border" },
      { key: "inputText", label: "Form field text" },
      { key: "badgeBg", label: "Badge background" },
      { key: "badgeText", label: "Badge text" },
    ],
  },
  {
    title: "Navigation & footer",
    keys: [
      { key: "navBg", label: "Navigation background" },
      { key: "navText", label: "Navigation text" },
      { key: "footerBg", label: "Footer background" },
      { key: "footerText", label: "Footer text" },
    ],
  },
  {
    title: "Status indicators",
    keys: [
      { key: "success", label: "Success" },
      { key: "warning", label: "Warning" },
      { key: "danger", label: "Danger" },
      { key: "info", label: "Information" },
    ],
  },
];

export const COLOR_KEYS = [
  "primary", "secondary", "accent", "background", "surface", "surfaceAlt", "heading", "text", "muted", "link",
  "border", "buttonBg", "buttonText", "buttonSecondaryBg", "buttonSecondaryText", "cardBg", "inputBg", "inputBorder",
  "inputText", "badgeBg", "badgeText", "navBg", "navText", "footerBg", "footerText", "success", "warning", "danger", "info",
] as const;
export type ColorKey = (typeof COLOR_KEYS)[number];

const colorsSchema = z.object(
  Object.fromEntries(COLOR_KEYS.map((k) => [k, zHex])) as Record<ColorKey, typeof zHex>,
);

const num = (min: number, max: number) => z.coerce.number().min(min).max(max);

export const typographySchema = z.object({
  headingFont: z.enum(FONT_KEYS),
  bodyFont: z.enum(FONT_KEYS),
  devanagariFont: z.enum(DEVANAGARI_FONT_KEYS),
  baseSize: num(14, 22),
  h1: num(1.5, 5),
  h2: num(1.25, 4),
  h3: num(1, 3),
  h4: num(0.9, 2.5),
  h5: num(0.85, 2),
  h6: num(0.8, 1.6),
  headingWeight: z.coerce.number().refine((v) => [400, 500, 600, 700, 800].includes(v)),
  bodyWeight: z.coerce.number().refine((v) => [300, 400, 500].includes(v)),
  lineHeight: num(1.2, 2.2),
  headingLineHeight: num(1, 1.6),
  letterSpacing: num(-0.05, 0.2),
  headingLetterSpacing: num(-0.05, 0.2),
  paragraphSpacing: num(0, 2.5),
  linkUnderline: z.enum(["always", "hover", "none"]),
  buttonWeight: z.coerce.number().refine((v) => [400, 500, 600, 700].includes(v)),
  buttonTransform: z.enum(["none", "uppercase"]),
  buttonLetterSpacing: num(0, 0.2),
});

export const componentsSchema = z.object({
  radius: num(0, 32),
  buttonShape: z.enum(["square", "rounded", "pill"]),
  buttonSize: z.enum(["sm", "md", "lg"]),
  cardBorderWidth: num(0, 4),
  cardShadow: z.enum(["none", "sm", "md", "lg"]),
  inputRadius: num(0, 24),
  badgeShape: z.enum(["square", "rounded", "pill"]),
  sectionSpacing: z.enum(["compact", "normal", "relaxed"]),
  contentWidth: z.enum(["narrow", "normal", "wide"]),
  containerAlign: z.enum(["center", "left"]),
  imageRadius: num(0, 32),
  imageAspect: z.enum(["16/9", "4/3", "3/2", "1/1"]),
  gridColumns: z.coerce.number().int().min(2).max(4),
  iconStyle: z.enum(["outline", "circle", "square"]),
  dividerStyle: z.enum(["none", "line", "dotted"]),
});

export const themeTokensSchema = z.object({
  schemaVersion: z.literal(1),
  colors: colorsSchema,
  typography: typographySchema,
  components: componentsSchema,
});

export type ThemeTokens = z.infer<typeof themeTokensSchema>;
export type ThemeColors = ThemeTokens["colors"];

export const DEFAULT_TYPOGRAPHY: ThemeTokens["typography"] = {
  headingFont: "poppins",
  bodyFont: "inter",
  devanagariFont: "noto-sans-devanagari",
  baseSize: 16,
  h1: 3,
  h2: 2.25,
  h3: 1.625,
  h4: 1.3,
  h5: 1.125,
  h6: 1,
  headingWeight: 700,
  bodyWeight: 400,
  lineHeight: 1.65,
  headingLineHeight: 1.2,
  letterSpacing: 0,
  headingLetterSpacing: -0.01,
  paragraphSpacing: 1,
  linkUnderline: "hover",
  buttonWeight: 600,
  buttonTransform: "none",
  buttonLetterSpacing: 0,
};

export const DEFAULT_COMPONENTS: ThemeTokens["components"] = {
  radius: 12,
  buttonShape: "rounded",
  buttonSize: "md",
  cardBorderWidth: 1,
  cardShadow: "sm",
  inputRadius: 8,
  badgeShape: "pill",
  sectionSpacing: "normal",
  contentWidth: "normal",
  containerAlign: "center",
  imageRadius: 12,
  imageAspect: "16/9",
  gridColumns: 3,
  iconStyle: "circle",
  dividerStyle: "line",
};

/**
 * Parse stored tokens. Unknown or invalid values fall back to the supplied
 * defaults key-by-key so that a partially invalid stored theme never breaks
 * the public website.
 */
export function coerceTokens(input: unknown, fallback: ThemeTokens): ThemeTokens {
  const parsed = themeTokensSchema.safeParse(input);
  if (parsed.success) return parsed.data;
  const raw = (input ?? {}) as Partial<Record<keyof ThemeTokens, Record<string, unknown>>>;
  const pick = <T extends Record<string, unknown>>(schema: z.ZodObject<z.ZodRawShape>, base: T, given?: Record<string, unknown>): T => {
    const out: Record<string, unknown> = { ...base };
    for (const key of Object.keys(base)) {
      const fieldSchema = schema.shape[key];
      const r = fieldSchema?.safeParse(given?.[key]);
      if (r?.success) out[key] = r.data;
    }
    return out as T;
  };
  return {
    schemaVersion: 1,
    colors: pick(colorsSchema, fallback.colors, raw.colors),
    typography: pick(typographySchema, fallback.typography, raw.typography),
    components: pick(componentsSchema, fallback.components, raw.components),
  };
}
