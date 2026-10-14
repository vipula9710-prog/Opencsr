import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { getRequestSite } from "@/server/services/public-site";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? ((process.env.APP_URL ?? "").startsWith("https") ? "https" : "http");
  const req = await getRequestSite().catch(() => null);
  const noIndex = req?.site.config.seo.noIndex;
  return {
    rules: noIndex ? [{ userAgent: "*", disallow: "/" }] : [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/print", "/login", "/setup"] }],
    sitemap: host ? `${proto}://${host}/sitemap.xml` : undefined,
  };
}
