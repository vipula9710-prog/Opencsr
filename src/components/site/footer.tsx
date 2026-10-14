import { Facebook, Globe, Instagram, Linkedin, Twitter, Youtube } from "lucide-react";
import type { SiteConfig } from "@/lib/site/config";
import { isSafeHref } from "@/lib/site/links";
import type { NavSnapshotTree } from "./tree";

const SOCIAL = { facebook: Facebook, x: Twitter, instagram: Instagram, linkedin: Linkedin, youtube: Youtube, website: Globe } as const;

export function SiteFooter({ config, nav }: { config: SiteConfig; nav: NavSnapshotTree[] }) {
  const f = config.footer;
  const centered = f.layout === "centered";
  const social = f.social.filter((s) => s.url && isSafeHref(s.url));
  const contact = f.showContact && (f.contact.email || f.contact.phone || f.contact.address);
  return (
    <footer style={{ background: "var(--c-footer-bg)", color: "var(--c-footer-text)", ["--section-heading" as string]: "var(--c-footer-text)", ["--section-link" as string]: "var(--c-footer-text)" }}>
      <div className={`site-container py-12 ${centered ? "text-center" : ""}`}>
        {f.layout === "simple" ? null : (
          <div className={`grid gap-10 ${centered ? "" : "@3xl:grid-cols-2 @5xl:grid-cols-4"}`}>
            <div className={centered ? "mx-auto max-w-xl" : ""}>
              <p className="site-heading text-xl font-bold">{config.identity.siteName}</p>
              {f.about ? <p className="mt-3 text-sm opacity-90">{f.about}</p> : null}
            </div>
            {f.showNavigation && nav.length ? (
              <div>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider opacity-90">Explore</h2>
                <ul className="space-y-2 text-sm">{nav.map((n) => <li key={n.id}>{n.href ? <a href={n.href} className="hover:underline">{n.label}</a> : n.label}</li>)}</ul>
              </div>
            ) : null}
            {f.columns.map((c, i) => (
              <div key={i}>
                {c.title ? <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider opacity-90">{c.title}</h2> : null}
                <p className="whitespace-pre-line text-sm opacity-90">{c.body}</p>
              </div>
            ))}
            {contact ? (
              <div>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider opacity-90">Contact</h2>
                <address className="space-y-1 text-sm not-italic opacity-90">
                  {f.contact.email ? <p><a href={`mailto:${f.contact.email}`} className="hover:underline">{f.contact.email}</a></p> : null}
                  {f.contact.phone ? <p>{f.contact.phone}</p> : null}
                  {f.contact.address ? <p className="whitespace-pre-line">{f.contact.address}</p> : null}
                </address>
              </div>
            ) : null}
          </div>
        )}
        <div className={`mt-10 flex flex-col gap-4 border-t pt-6 text-sm @3xl:flex-row @3xl:items-center @3xl:justify-between ${centered ? "items-center" : ""}`} style={{ borderColor: "color-mix(in srgb, var(--c-footer-text) 25%, transparent)" }}>
          <p className="opacity-85">{f.copyright}</p>
          <div className="flex flex-wrap items-center gap-4">
            {f.legalLinks.filter((l) => l.label && l.href && isSafeHref(l.href)).map((l) => <a key={l.href} href={l.href} className="hover:underline">{l.label}</a>)}
            {social.map((s) => {
              const Icon = SOCIAL[s.platform];
              return <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" aria-label={s.platform} className="opacity-90 hover:opacity-100"><Icon className="h-5 w-5" aria-hidden /></a>;
            })}
          </div>
        </div>
        <p className="mt-4 text-xs opacity-70">Powered by OpenCSR — free and open-source CSR software.</p>
      </div>
    </footer>
  );
}
