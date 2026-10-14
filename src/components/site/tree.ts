import type { NavItemSnapshot } from "@/server/services/website";

export type NavSnapshotTree = { id: string; label: string; href: string | null; openInNewTab: boolean; children: NavSnapshotTree[] };

export function buildNavTree(items: Pick<NavItemSnapshot, "id" | "label" | "href" | "openInNewTab" | "parentId" | "location" | "sortOrder" | "hidden">[], location: "HEADER" | "FOOTER"): NavSnapshotTree[] {
  const visible = items.filter((i) => i.location === location && !i.hidden && i.href).sort((a, b) => a.sortOrder - b.sortOrder);
  const top = visible.filter((i) => !i.parentId);
  return top.map((t) => ({
    id: t.id,
    label: t.label,
    href: t.href,
    openInNewTab: t.openInNewTab,
    children: visible.filter((c) => c.parentId === t.id).map((c) => ({ id: c.id, label: c.label, href: c.href, openInNewTab: c.openInNewTab, children: [] })),
  }));
}
