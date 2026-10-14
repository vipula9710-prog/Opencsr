import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getRequestPage, loadSectionData } from "@/server/services/public-site";
import { SectionList } from "@/components/site/sections";
import { getSite, pageTitle } from "./site-data";

export async function renderBuilderPage(slug: string | null) {
  const site = await getSite();
  if (!site) notFound();
  const page = await getRequestPage(slug);
  if (!page) notFound();
  const data = await loadSectionData(site.organisation, page.sections, { preview: site.preview, contact: site.contact });
  return (
    <>
      {slug === null ? <h1 className="sr-only">{site.site.config.identity.siteName}</h1> : page.sections[0]?.type?.startsWith("hero") ? null : <h1 className="sr-only">{page.title}</h1>}
      <SectionList sections={page.sections} data={data} tokens={site.site.tokens} />
    </>
  );
}

export async function builderPageMetadata(slug: string | null): Promise<Metadata> {
  const site = await getSite();
  if (!site) return {};
  const page = await getRequestPage(slug);
  if (!page) return {};
  const c = site.site.config;
  const title = page.seoTitle || (slug === null ? c.identity.siteName : page.title);
  return {
    title: slug === null ? { absolute: page.seoTitle || pageTitle(c.seo.titleTemplate, c.identity.tagline || c.identity.siteName) } : title,
    description: page.seoDescription || c.seo.description || undefined,
    alternates: { canonical: slug === null ? "/" : `/${slug}` },
    openGraph: { title, description: page.seoDescription || undefined, images: page.ogImageUrl ? [page.ogImageUrl] : c.seo.ogImage.url ? [c.seo.ogImage.url] : undefined },
  };
}
