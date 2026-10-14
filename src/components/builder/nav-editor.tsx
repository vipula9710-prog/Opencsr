"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, CornerDownRight, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { SYSTEM_ROUTES } from "@/lib/site/links";
import type { BuilderNavItem, BuilderPage } from "./types";
import { inputCls } from "./fields";
import { saveNavigationAction } from "@/app/admin/website/actions";

type Item = { key: string; label: string; type: "PAGE" | "SYSTEM" | "EXTERNAL"; pageId: string | null; systemRoute: string | null; url: string | null; openInNewTab: boolean; hidden: boolean; children: Item[] };

let counter = 0;
const key = () => `n${++counter}`;

function toTree(items: BuilderNavItem[], location: "HEADER" | "FOOTER"): Item[] {
  const mine = items.filter((i) => i.location === location).sort((a, b) => a.sortOrder - b.sortOrder);
  const map = (i: BuilderNavItem): Item => ({ key: key(), label: i.label, type: i.type, pageId: i.pageId, systemRoute: i.systemRoute, url: i.url, openInNewTab: i.openInNewTab, hidden: i.hidden, children: [] });
  return mine.filter((i) => !i.parentId).map((t) => ({ ...map(t), children: mine.filter((c) => c.parentId === t.id).map(map) }));
}

function strip(items: Item[]): unknown[] {
  return items.map(({ key: _k, children, ...rest }) => ({ ...rest, children: strip(children) }));
}

function ItemEditor({ item, onChange, onRemove, onUp, onDown, pages, child }: { item: Item; onChange: (i: Item) => void; onRemove: () => void; onUp?: () => void; onDown?: () => void; pages: BuilderPage[]; child?: boolean }) {
  return (
    <div className={`space-y-1.5 rounded-md border border-gray-200 bg-white p-2 ${item.hidden ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-1">
        {child ? <CornerDownRight className="h-3.5 w-3.5 text-gray-400" aria-hidden /> : null}
        <input aria-label="Label" value={item.label} onChange={(e) => onChange({ ...item, label: e.target.value })} className={inputCls} placeholder="Label" />
        <button type="button" aria-label="Move up" disabled={!onUp} onClick={onUp} className="rounded p-1 hover:bg-gray-100 disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
        <button type="button" aria-label="Move down" disabled={!onDown} onClick={onDown} className="rounded p-1 hover:bg-gray-100 disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
        <button type="button" aria-label={item.hidden ? "Show" : "Hide"} onClick={() => onChange({ ...item, hidden: !item.hidden })} className="rounded p-1 hover:bg-gray-100">{item.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</button>
        <button type="button" aria-label="Remove" onClick={onRemove} className="rounded p-1 text-red-700 hover:bg-gray-100"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
      <div className="flex gap-1">
        <select aria-label="Link type" value={item.type} onChange={(e) => onChange({ ...item, type: e.target.value as Item["type"] })} className={`${inputCls} w-28`}>
          <option value="PAGE">Page</option>
          <option value="SYSTEM">System</option>
          <option value="EXTERNAL">External</option>
        </select>
        {item.type === "PAGE" ? (
          <select aria-label="Page" value={item.pageId ?? ""} onChange={(e) => onChange({ ...item, pageId: e.target.value })} className={inputCls}>
            <option value="">Choose page…</option>
            {pages.map((p) => <option key={p.id} value={p.id}>{p.title}{p.status !== "PUBLISHED" ? " (draft)" : ""}</option>)}
          </select>
        ) : item.type === "SYSTEM" ? (
          <select aria-label="System page" value={item.systemRoute ?? ""} onChange={(e) => onChange({ ...item, systemRoute: e.target.value })} className={inputCls}>
            <option value="">Choose…</option>
            {SYSTEM_ROUTES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        ) : (
          <input aria-label="URL" value={item.url ?? ""} onChange={(e) => onChange({ ...item, url: e.target.value })} className={inputCls} placeholder="https://" />
        )}
      </div>
      {item.type === "EXTERNAL" ? <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={item.openInNewTab} onChange={(e) => onChange({ ...item, openInNewTab: e.target.checked })} /> Open in new tab</label> : null}
    </div>
  );
}

function move<T>(arr: T[], i: number, d: number) {
  const n = [...arr];
  const j = i + d;
  if (j < 0 || j >= n.length) return n;
  [n[i], n[j]] = [n[j]!, n[i]!];
  return n;
}

function flatten(items: Item[], location: "HEADER" | "FOOTER"): BuilderNavItem[] {
  const out: BuilderNavItem[] = [];
  items.forEach((it, i) => {
    const base = { location, label: it.label, type: it.type, pageId: it.pageId, systemRoute: it.systemRoute, url: it.url, openInNewTab: it.openInNewTab, hidden: it.hidden };
    out.push({ ...base, id: it.key, parentId: null, sortOrder: i });
    it.children.forEach((c, j) => out.push({ location, label: c.label, type: c.type, pageId: c.pageId, systemRoute: c.systemRoute, url: c.url, openInNewTab: c.openInNewTab, hidden: c.hidden, id: c.key, parentId: it.key, sortOrder: j }));
  });
  return out;
}

export function NavigationEditor({ initial, pages, onSaved, onPreview }: { initial: BuilderNavItem[]; pages: BuilderPage[]; onSaved: () => void; onPreview?: (items: BuilderNavItem[]) => void }) {
  const [header, setHeader] = useState(() => toTree(initial, "HEADER"));
  const [footer, setFooter] = useState(() => toTree(initial, "FOOTER"));
  useEffect(() => {
    onPreview?.([...flatten(header, "HEADER"), ...flatten(footer, "FOOTER")]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [header, footer]);
  const [status, setStatus] = useState<{ kind: "idle" | "saving" | "ok" | "error"; msg?: string }>({ kind: "idle" });
  const blank = (): Item => ({ key: key(), label: "New link", type: "SYSTEM", pageId: null, systemRoute: "/", url: null, openInNewTab: false, hidden: false, children: [] });

  async function save() {
    setStatus({ kind: "saving" });
    const a = await saveNavigationAction("HEADER", strip(header));
    if (!a.ok) return setStatus({ kind: "error", msg: a.error });
    const b = await saveNavigationAction("FOOTER", strip(footer).map((i) => ({ ...(i as object), children: [] })));
    if (!b.ok) return setStatus({ kind: "error", msg: b.error });
    setStatus({ kind: "ok", msg: "Navigation saved to the draft. Publish to make it live." });
    onSaved();
  }

  const list = (items: Item[], set: (i: Item[]) => void, allowChildren: boolean) => (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={it.key} className="space-y-1">
          <ItemEditor item={it} pages={pages} onChange={(n) => set(items.map((x, j) => (j === i ? n : x)))} onRemove={() => set(items.filter((_, j) => j !== i))} onUp={i > 0 ? () => set(move(items, i, -1)) : undefined} onDown={i < items.length - 1 ? () => set(move(items, i, 1)) : undefined} />
          {allowChildren ? (
            <div className="ml-4 space-y-1">
              {it.children.map((c, ci) => (
                <ItemEditor key={c.key} child item={c} pages={pages} onChange={(n) => set(items.map((x, j) => (j === i ? { ...x, children: x.children.map((y, k) => (k === ci ? n : y)) } : x)))} onRemove={() => set(items.map((x, j) => (j === i ? { ...x, children: x.children.filter((_, k) => k !== ci) } : x)))} onUp={ci > 0 ? () => set(items.map((x, j) => (j === i ? { ...x, children: move(x.children, ci, -1) } : x))) : undefined} onDown={ci < it.children.length - 1 ? () => set(items.map((x, j) => (j === i ? { ...x, children: move(x.children, ci, 1) } : x))) : undefined} />
              ))}
              {it.children.length < 12 ? <button type="button" onClick={() => set(items.map((x, j) => (j === i ? { ...x, children: [...x.children, blank()] } : x)))} className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900"><Plus className="h-3 w-3" /> Add dropdown item</button> : null}
            </div>
          ) : null}
        </div>
      ))}
      {items.length < 20 ? <button type="button" onClick={() => set([...items, blank()])} className="flex items-center gap-1 rounded border border-dashed border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"><Plus className="h-3.5 w-3.5" /> Add link</button> : null}
    </div>
  );

  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Header menu</h3>
        {list(header, setHeader, true)}
      </section>
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Footer menu</h3>
        {list(footer, setFooter, false)}
      </section>
      <div className="sticky bottom-0 space-y-2 border-t border-gray-200 bg-white py-3">
        <button type="button" onClick={save} disabled={status.kind === "saving"} className="w-full rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">{status.kind === "saving" ? "Saving…" : "Save navigation"}</button>
        {status.msg ? <p role={status.kind === "error" ? "alert" : "status"} className={`text-xs ${status.kind === "error" ? "text-red-700" : "text-green-700"}`}>{status.msg}</p> : null}
        <p className="text-[11px] text-gray-500">Links to draft pages are hidden on the live site until those pages are published.</p>
      </div>
    </div>
  );
}
