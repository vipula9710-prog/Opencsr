import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { getRequestSite } from "@/server/services/public-site";
import { buildNavTree } from "@/components/site/tree";

export const getSite = cache(async () => {
  const req = await getRequestSite();
  if (!req) return null;
  const { site, organisation, preview } = req;
  return {
    ...req,
    headerNav: buildNavTree(site.navigation, "HEADER"),
    footerNav: buildNavTree(site.navigation, "FOOTER"),
    demo: organisation.isDemo || organisation.demoBannerEnabled,
    contact: { email: site.config.footer.contact.email || organisation.email || "", phone: site.config.footer.contact.phone || organisation.phone || "", address: site.config.footer.contact.address || organisation.address || "" },
    preview,
  };
});

/** Absolute base URL for canonical links: the organisation's domain when served on it, else APP_URL. */
export async function baseUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const app = process.env.APP_URL ?? "http://localhost:3000";
  if (!host) return app;
  try {
    if (new URL(app).host === host) return app.replace(/\/$/, "");
  } catch {}
  const proto = h.get("x-forwarded-proto") ?? (app.startsWith("https") ? "https" : "http");
  return `${proto}://${host}`;
}

export function pageTitle(template: string, title: string) {
  return template && template.includes("%s") ? template.replace("%s", title) : title;
}
