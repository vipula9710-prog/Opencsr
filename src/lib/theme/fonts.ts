// Font options are restricted to self-hosted, openly licensed fonts bundled via
// @fontsource packages (SIL Open Font License) plus system font stacks.
// No external font URLs are ever loaded.

export const DEVANAGARI_STACK = "'Noto Sans Devanagari'";

export const FONTS = {
  inter: { label: "Inter (sans-serif)", stack: "'Inter', system-ui, sans-serif", devanagari: false },
  "open-sans": { label: "Open Sans (sans-serif)", stack: "'Open Sans', system-ui, sans-serif", devanagari: false },
  poppins: { label: "Poppins (geometric sans)", stack: "'Poppins', system-ui, sans-serif", devanagari: false },
  lora: { label: "Lora (serif)", stack: "'Lora', Georgia, serif", devanagari: false },
  merriweather: { label: "Merriweather (serif)", stack: "'Merriweather', Georgia, serif", devanagari: false },
  "source-serif": { label: "Source Serif 4 (serif)", stack: "'Source Serif 4', Georgia, serif", devanagari: false },
  "noto-sans-devanagari": {
    label: "Noto Sans Devanagari",
    stack: "'Noto Sans Devanagari', system-ui, sans-serif",
    devanagari: true,
  },
  "system-sans": {
    label: "System sans-serif",
    stack: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    devanagari: false,
  },
  "system-serif": { label: "System serif", stack: "Georgia, 'Times New Roman', Times, serif", devanagari: false },
} as const;

export type FontKey = keyof typeof FONTS;
export const FONT_KEYS = Object.keys(FONTS) as [FontKey, ...FontKey[]];
export const DEVANAGARI_FONT_KEYS = ["noto-sans-devanagari", "system-sans"] as const;

/** Font stack with the Devanagari font inserted before generic fallbacks. */
export function fontStack(key: FontKey, devanagari: string = DEVANAGARI_STACK): string {
  const stack: string = FONTS[key]?.stack ?? FONTS["system-sans"].stack;
  const parts = stack.split(",").map((s) => s.trim());
  const generic = parts.pop()!;
  return [...parts, devanagari, generic].join(", ");
}
