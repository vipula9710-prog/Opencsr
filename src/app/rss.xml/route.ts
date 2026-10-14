import { headers } from "next/headers";
import { resolvePublicOrganisation, publicPosts, getRequestSite } from "@/server/services/public-site";

export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function GET() {
  const org = await resolvePublicOrganisation();
  if (!org) return new Response("Not found", { status: 404 });
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost";
  const base = `${h.get("x-forwarded-proto") ?? ((process.env.APP_URL ?? "").startsWith("https") ? "https" : "http")}://${host}`;
  const req = await getRequestSite();
  const title = req?.site.config.identity.siteName ?? org.name;
  const { posts } = await publicPosts(org.id, { take: 30 });
  const items = posts
    .map((p) => `<item><title>${esc(p.title)}</title><link>${base}/blog/${p.slug}</link><guid isPermaLink="true">${base}/blog/${p.slug}</guid>${p.publishedAt ? `<pubDate>${new Date(p.publishedAt).toUTCString()}</pubDate>` : ""}${p.excerpt ? `<description>${esc(p.excerpt)}</description>` : ""}</item>`)
    .join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${esc(title)}</title><link>${base}/blog</link><description>${esc(req?.site.config.identity.tagline || title)}</description>${items}</channel></rss>`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=600" } });
}
