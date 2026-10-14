import type { ReactNode } from "react";
import type { SectionStyle } from "@/lib/site/sections";
import type { ThemeTokens } from "@/lib/theme/tokens";
import { readableOn } from "@/lib/theme/contrast";

export function sectionColors(style: SectionStyle, tokens: ThemeTokens): React.CSSProperties {
  const c = tokens.colors;
  const solid = (bg: string, fg?: string) => {
    const text = fg ?? readableOn(bg, c.heading, "#FFFFFF");
    return { background: bg, color: text, ["--section-heading" as string]: text, ["--section-link" as string]: text, ["--section-eyebrow" as string]: text } as React.CSSProperties;
  };
  switch (style.background) {
    case "surface":
      return { background: "var(--c-surface)" };
    case "alt":
      return { background: "var(--c-surface-alt)" };
    case "primary":
      return solid(c.primary);
    case "secondary":
      return solid(c.secondary);
    case "accent":
      return solid(c.accent);
    case "custom":
      return solid(style.customBg, style.customText);
    default:
      return { background: "var(--c-background)" };
  }
}

export function SectionWrapper({ style, tokens, children, id, sectionId, selected, flush }: { style: SectionStyle; tokens: ThemeTokens; children: ReactNode; id?: string; sectionId?: string; selected?: boolean; flush?: boolean }) {
  const classes = [
    flush ? "" : `section-pt-${style.paddingTop} section-pb-${style.paddingBottom}`,
    style.hideOnMobile ? "hide-mobile" : "",
    style.hideOnDesktop ? "hide-desktop" : "",
    style.align === "center" ? "text-center" : style.align === "right" ? "text-right" : "",
    selected ? "outline outline-2 outline-offset-[-2px] outline-blue-500" : "",
  ].join(" ");
  return (
    <section id={style.anchor || id} data-section-id={sectionId} className={classes} style={sectionColors(style, tokens)}>
      {flush ? children : <div className={`site-container w-${style.width}`}>{children}</div>}
    </section>
  );
}
