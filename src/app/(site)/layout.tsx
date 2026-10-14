import type { Metadata } from "next";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import "@fontsource/open-sans/400.css";
import "@fontsource/open-sans/600.css";
import "@fontsource/lora/400.css";
import "@fontsource/lora/700.css";
import "@fontsource/merriweather/400.css";
import "@fontsource/merriweather/700.css";
import "@fontsource/source-serif-4/400.css";
import "@fontsource/source-serif-4/700.css";
import "@fontsource/noto-sans-devanagari/400.css";
import "@fontsource/noto-sans-devanagari/700.css";
import { SiteFrame } from "@/components/site/site-frame";
import { getSite, baseUrl } from "./site-data";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSite();
  if (!site) return { title: "OpenCSR" };
  const c = site.site.config;
  const base = await baseUrl();
  return {
    metadataBase: new URL(base),
    title: { default: c.identity.siteName, template: c.seo.titleTemplate || `%s | ${c.identity.siteName}` },
    description: c.seo.description || c.identity.tagline || undefined,
    icons: c.identity.favicon.url ? { icon: c.identity.favicon.url } : { icon: "/favicon.svg" },
    robots: site.preview || c.seo.noIndex ? { index: false, follow: false } : undefined,
    openGraph: { siteName: c.identity.siteName, type: "website", images: c.seo.ogImage.url ? [{ url: c.seo.ogImage.url, alt: c.seo.ogImage.alt }] : undefined },
    alternates: { types: { "application/rss+xml": `${base}/rss.xml` } },
  };
}

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const site = await getSite();
  if (!site) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 text-center">
        <div>
          <h1 className="text-2xl font-semibold">OpenCSR is not set up yet</h1>
          <p className="mt-2 text-gray-600">An administrator needs to complete the setup wizard.</p>
          <a href="/setup" className="mt-4 inline-block rounded-lg bg-brand-600 px-4 py-2 text-white">Start setup</a>
        </div>
      </main>
    );
  }
  return (
    <SiteFrame
      tokens={site.site.tokens}
      config={site.site.config}
      headerNav={site.headerNav}
      footerNav={site.footerNav}
      demo={site.demo}
      previewBar={
        site.preview ? (
          <div role="status" className="flex flex-wrap items-center justify-center gap-3 bg-blue-700 px-4 py-2 text-center text-sm font-medium text-white">
            Draft preview — visitors still see the published website.
            <a href="/api/preview/exit" className="underline">Exit preview</a>
            <a href="/admin/website" className="underline">Back to builder</a>
          </div>
        ) : null
      }
    >
      {children}
    </SiteFrame>
  );
}
