import type { ReactNode } from "react";
import type { ThemeTokens } from "@/lib/theme/tokens";
import type { SiteConfig } from "@/lib/site/config";
import { themeToCssVars } from "@/lib/theme/css";
import { SiteHeader } from "./header";
import { SiteFooter } from "./footer";
import type { NavSnapshotTree } from "./tree";

/**
 * The themed public-site frame. CSS custom properties are generated from
 * validated tokens and applied as inline style variables — no user CSS is
 * ever injected.
 */
export function SiteFrame({ tokens, config, headerNav, footerNav, demo, embedded, previewBar, children }: { tokens: ThemeTokens; config: SiteConfig; headerNav: NavSnapshotTree[]; footerNav: NavSnapshotTree[]; demo: boolean; embedded?: boolean; previewBar?: ReactNode; children: ReactNode }) {
  return (
    <div className="site-root flex min-h-screen flex-col" style={themeToCssVars(tokens) as React.CSSProperties}>
      {previewBar}
      {demo ? (
        <div role="note" className="px-4 py-1.5 text-center text-xs font-semibold" style={{ background: "#C6A15B", color: "#103B2B" }}>
          DEMO ENVIRONMENT — All organisation records and impact figures are fictional.
        </div>
      ) : null}
      {embedded ? null : <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-black">Skip to content</a>}
      <SiteHeader config={config} nav={headerNav} preview={embedded} />
      {embedded ? <div className="flex-1">{children}</div> : <main id="content" className="flex-1">{children}</main>}
      <SiteFooter config={config} nav={footerNav} />
    </div>
  );
}
