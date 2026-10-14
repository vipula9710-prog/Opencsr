"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import type { NavSnapshotTree } from "./tree";
import type { SiteConfig } from "@/lib/site/config";
import { isSafeHref, isSafeImageUrl } from "@/lib/site/links";

function NavLink({ item, className }: { item: NavSnapshotTree; className?: string }) {
  if (!item.href || !isSafeHref(item.href)) return <span className={className}>{item.label}</span>;
  return (
    <a href={item.href} className={className} {...(item.openInNewTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
      {item.label}
    </a>
  );
}

function Dropdown({ item }: { item: NavSnapshotTree }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <div className="flex items-center">
        <NavLink item={item} className="rounded px-3 py-2 text-sm font-medium hover:underline" />
        <button type="button" aria-expanded={open} aria-label={`${item.label} submenu`} onClick={() => setOpen((o) => !o)} className="rounded p-1">
          <ChevronDown className="h-4 w-4" aria-hidden />
        </button>
      </div>
      {open ? (
        <ul className="absolute left-0 top-full z-40 min-w-[13rem] rounded-[var(--radius)] border py-2 shadow-lg" style={{ background: "var(--c-nav-bg)", borderColor: "var(--c-border)" }}>
          {item.children.map((c) => (
            <li key={c.id}><NavLink item={c} className="block px-4 py-2 text-sm hover:underline" /></li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function SiteHeader({ config, nav, preview }: { config: SiteConfig; nav: NavSnapshotTree[]; preview?: boolean }) {
  const [open, setOpen] = useState(false);
  const h = config.header;
  const logo = config.identity.logo;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const brand = (
    <a href="/" className="flex items-center gap-3" aria-label={`${config.identity.siteName} — home`}>
      {logo.url && isSafeImageUrl(logo.url) ? <img src={logo.url} alt={logo.alt || config.identity.siteName} style={{ height: h.logoHeight }} className="w-auto" /> : null}
      {config.identity.showSiteName || !logo.url ? (
        <span className="flex flex-col leading-tight">
          <span className="site-heading text-lg font-bold" style={{ color: "var(--c-nav-text)" }}>{config.identity.siteName}</span>
          {h.showTagline && config.identity.tagline ? <span className="text-xs opacity-80">{config.identity.tagline}</span> : null}
        </span>
      ) : null}
    </a>
  );

  const navList = (
    <ul className={`hidden flex-wrap items-center gap-1 @4xl:flex ${h.navAlign === "center" ? "justify-center" : h.navAlign === "left" ? "justify-start" : "justify-end"}`}>
      {nav.map((item) =>
        item.children.length ? <Dropdown key={item.id} item={item} /> : <li key={item.id}><NavLink item={item} className="rounded px-3 py-2 text-sm font-medium hover:underline" /></li>,
      )}
    </ul>
  );
  const cta = h.cta.enabled && h.cta.label && h.cta.href ? <a href={h.cta.href} className="site-btn site-btn-primary hidden @4xl:inline-flex">{h.cta.label}</a> : null;

  return (
    <header className={`${h.sticky && !preview ? "sticky top-0" : ""} z-30 border-b`} style={{ background: "var(--c-nav-bg)", color: "var(--c-nav-text)", borderColor: "var(--c-border)" }}>
      <nav aria-label="Main" className="site-container">
        {h.layout === "logo-center" ? (
          <div className="flex flex-col items-center gap-2 py-4">
            <div className="flex w-full items-center justify-between @4xl:justify-center">{brand}<MobileToggle open={open} setOpen={setOpen} /></div>
            <div className="flex w-full items-center justify-center gap-4">{navList}{cta}</div>
          </div>
        ) : h.layout === "split" ? (
          <div className="flex items-center justify-between gap-4 py-4">
            <div className="flex-1">{navList}</div>
            {brand}
            <div className="flex flex-1 justify-end">{cta}<MobileToggle open={open} setOpen={setOpen} /></div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-6 py-4">
            {brand}
            <div className="flex flex-1 items-center justify-end gap-4">
              <div className="flex-1">{navList}</div>
              {cta}
              <MobileToggle open={open} setOpen={setOpen} />
            </div>
          </div>
        )}
        {open ? (
          <div id="mobile-menu" className="border-t py-3 @4xl:hidden" style={{ borderColor: "var(--c-border)" }}>
            <ul className="space-y-1">
              {nav.map((item) => (
                <li key={item.id}>
                  <NavLink item={item} className="block rounded px-2 py-2 font-medium" />
                  {item.children.length ? (
                    <ul className="ml-4 border-l pl-2" style={{ borderColor: "var(--c-border)" }}>
                      {item.children.map((c) => <li key={c.id}><NavLink item={c} className="block px-2 py-1.5 text-sm" /></li>)}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
            {h.cta.enabled && h.cta.label ? <a href={h.cta.href} className="site-btn site-btn-primary mt-3 w-full">{h.cta.label}</a> : null}
          </div>
        ) : null}
      </nav>
    </header>
  );
}

function MobileToggle({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  return (
    <button type="button" className="rounded p-2 @4xl:hidden" aria-expanded={open} aria-controls="mobile-menu" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen(!open)}>
      {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
    </button>
  );
}
