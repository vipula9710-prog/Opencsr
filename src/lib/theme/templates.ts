import { DEFAULT_COMPONENTS, DEFAULT_TYPOGRAPHY, type ThemeColors, type ThemeTokens } from "./tokens";

function colors(base: Partial<ThemeColors> & Pick<ThemeColors, "primary" | "secondary" | "accent">): ThemeColors {
  return {
    background: "#FFFFFF",
    surface: "#FFFFFF",
    surfaceAlt: "#F5F7F6",
    heading: "#111827",
    text: "#1F2937",
    muted: "#4B5563",
    link: base.primary,
    border: "#E5E7EB",
    buttonBg: base.primary,
    buttonText: "#FFFFFF",
    buttonSecondaryBg: "#FFFFFF",
    buttonSecondaryText: base.primary,
    cardBg: "#FFFFFF",
    inputBg: "#FFFFFF",
    inputBorder: "#9CA3AF",
    inputText: "#111827",
    badgeBg: "#E5E7EB",
    badgeText: "#111827",
    navBg: "#FFFFFF",
    navText: "#111827",
    footerBg: "#111827",
    footerText: "#F3F4F6",
    success: "#15803D",
    warning: "#B45309",
    danger: "#B91C1C",
    info: "#1D4ED8",
    ...base,
  };
}

export type ThemeTemplate = { key: string; name: string; description: string; tokens: ThemeTokens };

export const THEME_TEMPLATES: ThemeTemplate[] = [
  {
    key: "corporate-green",
    name: "Corporate Green",
    description: "Forest green with a warm gold accent. Calm, trustworthy and sustainability-focused.",
    tokens: {
      schemaVersion: 1,
      colors: colors({
        primary: "#176B45",
        secondary: "#103B2B",
        accent: "#C6A15B",
        background: "#FFFFFF",
        surface: "#FFFFFF",
        surfaceAlt: "#F4F8F5",
        heading: "#103B2B",
        text: "#18231D",
        muted: "#46564D",
        link: "#176B45",
        border: "#D6E3DA",
        buttonSecondaryText: "#103B2B",
        badgeBg: "#E3EFE7",
        badgeText: "#103B2B",
        navBg: "#FFFFFF",
        navText: "#103B2B",
        footerBg: "#103B2B",
        footerText: "#F4F8F5",
        inputBorder: "#8FA698",
      }),
      typography: { ...DEFAULT_TYPOGRAPHY },
      components: { ...DEFAULT_COMPONENTS },
    },
  },
  {
    key: "professional-blue",
    name: "Professional Blue",
    description: "Navy and blue tones for a clean corporate look.",
    tokens: {
      schemaVersion: 1,
      colors: colors({
        primary: "#1D4ED8",
        secondary: "#0F1E46",
        accent: "#F59E0B",
        surfaceAlt: "#F1F5FB",
        heading: "#0F1E46",
        text: "#1E293B",
        muted: "#475569",
        border: "#D9E2F0",
        badgeBg: "#DBEAFE",
        badgeText: "#1E3A8A",
        navText: "#0F1E46",
        footerBg: "#0F1E46",
        footerText: "#E2E8F0",
      }),
      typography: { ...DEFAULT_TYPOGRAPHY, headingFont: "inter", bodyFont: "inter", headingWeight: 700 },
      components: { ...DEFAULT_COMPONENTS, radius: 8, buttonShape: "rounded", imageRadius: 8 },
    },
  },
  {
    key: "minimal-white",
    name: "Minimal White",
    description: "Lots of white space, black type and subtle borders.",
    tokens: {
      schemaVersion: 1,
      colors: colors({
        primary: "#111111",
        secondary: "#333333",
        accent: "#2563EB",
        surfaceAlt: "#FAFAFA",
        heading: "#111111",
        text: "#222222",
        muted: "#555555",
        link: "#111111",
        border: "#E6E6E6",
        buttonBg: "#111111",
        buttonSecondaryText: "#111111",
        badgeBg: "#F0F0F0",
        badgeText: "#111111",
        footerBg: "#FFFFFF",
        footerText: "#222222",
        inputBorder: "#8A8A8A",
      }),
      typography: { ...DEFAULT_TYPOGRAPHY, headingFont: "inter", bodyFont: "inter", headingWeight: 600, linkUnderline: "always" },
      components: {
        ...DEFAULT_COMPONENTS,
        radius: 0,
        buttonShape: "square",
        cardShadow: "none",
        imageRadius: 0,
        badgeShape: "square",
        inputRadius: 0,
        sectionSpacing: "relaxed",
        contentWidth: "narrow",
      },
    },
  },
  {
    key: "earth-sustainability",
    name: "Earth & Sustainability",
    description: "Earthy terracotta, olive and sand for environmental organisations.",
    tokens: {
      schemaVersion: 1,
      colors: colors({
        primary: "#7A5230",
        secondary: "#4F5D2F",
        accent: "#D9A441",
        background: "#FFFDF8",
        surface: "#FFFDF8",
        surfaceAlt: "#F4EDE1",
        heading: "#3B2A1A",
        text: "#33291F",
        muted: "#5E5143",
        link: "#7A5230",
        border: "#E5D9C6",
        cardBg: "#FFFFFF",
        buttonSecondaryText: "#4F5D2F",
        badgeBg: "#EAE3CF",
        badgeText: "#3B2A1A",
        navBg: "#FFFDF8",
        navText: "#3B2A1A",
        footerBg: "#4F5D2F",
        footerText: "#FBF7EE",
        inputBorder: "#9C8B72",
      }),
      typography: { ...DEFAULT_TYPOGRAPHY, headingFont: "lora", bodyFont: "open-sans" },
      components: { ...DEFAULT_COMPONENTS, radius: 16, buttonShape: "pill", imageRadius: 20, imageAspect: "4/3" },
    },
  },
  {
    key: "premium-charcoal",
    name: "Premium Charcoal",
    description: "Dark charcoal navigation with a refined gold accent and serif headings.",
    tokens: {
      schemaVersion: 1,
      colors: colors({
        primary: "#2B2B2B",
        secondary: "#141414",
        accent: "#B8913A",
        surfaceAlt: "#F5F3EF",
        heading: "#141414",
        text: "#262626",
        muted: "#525252",
        link: "#7A5E1E",
        border: "#E4E0D8",
        buttonBg: "#141414",
        buttonSecondaryText: "#141414",
        badgeBg: "#EFE8D8",
        badgeText: "#3D2F0C",
        navBg: "#141414",
        navText: "#F5F3EF",
        footerBg: "#141414",
        footerText: "#E7E3DA",
      }),
      typography: { ...DEFAULT_TYPOGRAPHY, headingFont: "merriweather", bodyFont: "inter", headingWeight: 700 },
      components: { ...DEFAULT_COMPONENTS, radius: 4, buttonShape: "square", cardShadow: "md", imageRadius: 4 },
    },
  },
];

export const CUSTOM_TEMPLATE_KEY = "custom";

export const DEFAULT_TEMPLATE_KEY = "corporate-green";

export function getTemplate(key: string): ThemeTemplate | undefined {
  return THEME_TEMPLATES.find((t) => t.key === key);
}

export function defaultTokens(): ThemeTokens {
  return structuredClone(getTemplate(DEFAULT_TEMPLATE_KEY)!.tokens);
}

/** Preset colour palettes for quick selection in the colour editor. */
export const PRESET_PALETTES = THEME_TEMPLATES.map((t) => ({
  key: t.key,
  name: t.name,
  colors: t.tokens.colors,
}));
