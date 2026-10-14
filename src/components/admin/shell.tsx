"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Bell, BookOpen, Building2, ChevronsLeft, ChevronsRight, ClipboardCheck, FileText, FolderKanban, Gauge, Globe, Handshake,
  Image as ImageIcon, Inbox, ListChecks, LogOut, Menu, Newspaper, PiggyBank, ScrollText, Search, Settings, Target, User, Users, X, Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { OpenCsrMark } from "@/components/brand";

type NavItem = { href: string; label: string; icon: typeof Gauge; perms?: string[]; badgeKey?: "approvals" | "enquiries" | "notifications" };

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Overview",
    items: [{ href: "/admin", label: "Dashboard", icon: Gauge }],
  },
  {
    section: "CSR management",
    items: [
      { href: "/admin/programmes", label: "CSR Programmes", icon: Layers, perms: ["programme.read"] },
      { href: "/admin/projects", label: "Projects", icon: FolderKanban, perms: ["project.read"] },
      { href: "/admin/partners", label: "NGO & Partners", icon: Handshake, perms: ["partner.read"] },
      { href: "/admin/budgets", label: "Budgets & Expenditure", icon: PiggyBank, perms: ["finance.read"] },
      { href: "/admin/impact", label: "Impact Monitoring", icon: Target, perms: ["impact.read"] },
      { href: "/admin/tasks", label: "Tasks & Milestones", icon: ListChecks, perms: ["task.read"] },
      { href: "/admin/approvals", label: "Approvals", icon: ClipboardCheck, badgeKey: "approvals" },
      { href: "/admin/reports", label: "Reports & Documents", icon: FileText, perms: ["report.read", "document.read"] },
    ],
  },
  {
    section: "Website",
    items: [
      { href: "/admin/website", label: "Website Builder", icon: Globe, perms: ["website.edit"] },
      { href: "/admin/blog", label: "Blog CMS", icon: Newspaper, perms: ["blog.write"] },
      { href: "/admin/media", label: "Media Library", icon: ImageIcon, perms: ["media.read"] },
      { href: "/admin/enquiries", label: "Enquiries", icon: Inbox, perms: ["enquiry.read"], badgeKey: "enquiries" },
    ],
  },
  {
    section: "Administration",
    items: [
      { href: "/admin/users", label: "Users & Roles", icon: Users, perms: ["users.manage"] },
      { href: "/admin/notifications", label: "Notifications", icon: Bell, badgeKey: "notifications" },
      { href: "/admin/audit", label: "Audit Logs", icon: ScrollText, perms: ["audit.read"] },
      { href: "/admin/settings", label: "Organisation Settings", icon: Settings, perms: ["org.settings.manage"] },
    ],
  },
];

export type ShellProps = {
  user: { name: string; email: string; isPlatformAdmin: boolean };
  organisation: { id: string; name: string; isDemo: boolean; logoUrl?: string | null };
  organisations: { id: string; name: string }[];
  roleLabel: string;
  permissions: string[];
  counts: { approvals: number; enquiries: number; notifications: number };
  switchOrganisation: (formData: FormData) => Promise<void>;
  logout: () => Promise<void>;
  children: ReactNode;
};

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`) || (href === "/admin/reports" && pathname.startsWith("/admin/documents"));
}

export function AdminShell(props: ShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("opencsr.sidebar") === "collapsed");
    } catch {
      // storage unavailable
    }
  }, []);
  useEffect(() => setMobileOpen(false), [pathname]);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem("opencsr.sidebar", c ? "expanded" : "collapsed");
      } catch {}
      return !c;
    });
  };
  const perms = new Set(props.permissions);
  const visible = (i: NavItem) => !i.perms || i.perms.some((p) => perms.has(p));

  const nav = (compact: boolean) => (
    <nav aria-label="Main" className="flex-1 overflow-y-auto px-2 py-3">
      {NAV.map((group) => {
        const items = group.items.filter(visible);
        if (!items.length) return null;
        return (
          <div key={group.section} className="mb-4">
            {!compact ? <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-brand-200/80">{group.section}</p> : null}
            <ul className="space-y-0.5">
              {items.map((item) => {
                const active = isActive(pathname, item.href);
                const count = item.badgeKey ? props.counts[item.badgeKey] : 0;
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      title={compact ? item.label : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        active ? "bg-white/15 text-white" : "text-brand-100 hover:bg-white/10 hover:text-white",
                        compact && "justify-center px-2",
                      )}
                    >
                      <Icon className="h-4.5 w-4.5 h-[18px] w-[18px] shrink-0" aria-hidden />
                      {!compact ? <span className="flex-1 truncate">{item.label}</span> : <span className="sr-only">{item.label}</span>}
                      {count > 0 && !compact ? (
                        <span className="rounded-full bg-gold-500 px-1.5 py-0.5 text-[11px] font-semibold text-brand-900">
                          {count}
                          <span className="sr-only"> pending</span>
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
        Skip to content
      </a>
      {/* Desktop sidebar */}
      <aside className={cn("fixed inset-y-0 left-0 z-30 hidden flex-col bg-brand-800 transition-[width] lg:flex", collapsed ? "w-16" : "w-64")}>
        <div className={cn("flex h-16 items-center gap-2 border-b border-white/10 px-4", collapsed && "justify-center px-2")}>
          <OpenCsrMark className="h-8 w-8 shrink-0" />
          {!collapsed ? <span className="text-lg font-semibold text-white">OpenCSR</span> : null}
        </div>
        {nav(collapsed)}
        <button onClick={toggle} className="flex items-center gap-2 border-t border-white/10 px-4 py-3 text-sm text-brand-100 hover:text-white" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {collapsed ? <ChevronsRight className="mx-auto h-4 w-4" /> : <><ChevronsLeft className="h-4 w-4" /> Collapse</>}
        </button>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="relative flex h-full w-72 flex-col bg-brand-800">
            <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
              <span className="flex items-center gap-2 text-lg font-semibold text-white"><OpenCsrMark className="h-8 w-8" /> OpenCSR</span>
              <button onClick={() => setMobileOpen(false)} className="rounded p-1 text-white" aria-label="Close navigation"><X className="h-5 w-5" /></button>
            </div>
            {nav(false)}
          </aside>
        </div>
      ) : null}

      <div className={cn("transition-[padding]", collapsed ? "lg:pl-16" : "lg:pl-64")}>
        {props.organisation.isDemo ? (
          <div role="note" className="bg-gold-500 px-4 py-1.5 text-center text-xs font-semibold text-brand-900">
            DEMO ENVIRONMENT — All organisation records and impact figures are fictional.
          </div>
        ) : null}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-gray-200 bg-white/95 px-4 backdrop-blur sm:px-6">
          <button className="rounded p-2 text-gray-700 hover:bg-gray-100 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            <Menu className="h-5 w-5" />
          </button>
          {props.organisations.length > 1 ? (
            <form action={props.switchOrganisation} className="flex items-center gap-2">
              <label htmlFor="org-switcher" className="sr-only">Organisation</label>
              <Building2 className="hidden h-4 w-4 text-gray-500 sm:block" aria-hidden />
              <select
                id="org-switcher"
                name="organisationId"
                defaultValue={props.organisation.id}
                onChange={(e) => e.currentTarget.form?.requestSubmit()}
                className="h-9 max-w-[12rem] rounded-lg border border-gray-300 bg-white px-2 text-sm font-medium"
              >
                {props.organisations.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
              <noscript><button type="submit" className="text-sm">Switch</button></noscript>
            </form>
          ) : (
            <span className="flex items-center gap-2 truncate text-sm font-semibold text-gray-900">{props.organisation.logoUrl ? <img src={props.organisation.logoUrl} alt="" className="h-7 w-auto max-w-[6rem] object-contain" /> : <Building2 className="h-4 w-4 text-gray-500" aria-hidden />}{props.organisation.name}</span>
          )}
          <form action="/admin/search" method="get" role="search" className="relative ml-auto hidden max-w-sm flex-1 md:block">
            <label htmlFor="global-search" className="sr-only">Search</label>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
            <input id="global-search" name="q" type="search" placeholder="Search projects, partners, posts…" className="h-9 w-full rounded-lg border border-gray-300 bg-gray-50 pl-9 pr-3 text-sm focus:bg-white" />
          </form>
          <Link href="/admin/search" className="ml-auto rounded p-2 text-gray-700 hover:bg-gray-100 md:hidden" aria-label="Search"><Search className="h-5 w-5" /></Link>
          <Link href="/admin/notifications" className="relative rounded-lg p-2 text-gray-700 hover:bg-gray-100" aria-label={`Notifications (${props.counts.notifications} unread)`}>
            <Bell className="h-5 w-5" />
            {props.counts.notifications > 0 ? <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-red-600 ring-2 ring-white" aria-hidden /> : null}
          </Link>
          <div className="relative" ref={menuRef}>
            <button onClick={() => setMenuOpen((o) => !o)} aria-expanded={menuOpen} aria-haspopup="menu" className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-gray-100">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white" aria-hidden>
                {props.user.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="hidden text-left sm:block">
                <span className="block text-sm font-medium leading-tight text-gray-900">{props.user.name}</span>
                <span className="block text-xs leading-tight text-gray-500">{props.roleLabel}</span>
              </span>
            </button>
            {menuOpen ? (
              <div role="menu" className="absolute right-0 mt-2 w-56 rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                <p className="truncate px-4 py-2 text-xs text-gray-500">{props.user.email}</p>
                <Link role="menuitem" href="/admin/account" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"><User className="h-4 w-4" /> My account</Link>
                {props.user.isPlatformAdmin ? <Link role="menuitem" href="/admin/platform" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"><Building2 className="h-4 w-4" /> Organisations</Link> : null}
                <a role="menuitem" href="/" target="_blank" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"><Globe className="h-4 w-4" /> View website</a>
                <a role="menuitem" href="https://github.com/vipula9710-prog/opencsr" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"><BookOpen className="h-4 w-4" /> Documentation</a>
                <form action={props.logout}>
                  <button role="menuitem" type="submit" className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-700 hover:bg-red-50"><LogOut className="h-4 w-4" /> Sign out</button>
                </form>
              </div>
            ) : null}
          </div>
        </header>
        <main id="main" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{props.children}</main>
      </div>
    </div>
  );
}
