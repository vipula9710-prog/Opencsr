"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle, ArrowDown, ArrowUp, Check, CloudUpload, Copy, Eye, EyeOff, ExternalLink, FileText, GripVertical, LayoutTemplate, Loader2, Monitor, Navigation,
  Newspaper, Palette, PanelsTopLeft, Plus, Settings2, Shapes, Smartphone, Tablet, Trash2, Type, Undo2, X,
} from "lucide-react";
import { SiteFrame } from "@/components/site/site-frame";
import { SectionList } from "@/components/site/sections";
import { PostCard } from "@/components/site/cards";
import type { NavSnapshotTree } from "@/components/site/tree";
import { defaultSectionProps, SECTION_DEFINITIONS, getSectionDefinition, type SectionInstance } from "@/lib/site/sections";
import { THEME_TEMPLATES } from "@/lib/theme/templates";
import type { ThemeTokens } from "@/lib/theme/tokens";
import type { SiteConfig } from "@/lib/site/config";
import { cn } from "@/lib/utils";
import {
  applyTemplateAction, discardAction, publishAction, saveSectionsAction, saveSiteConfigAction, saveTokensAction, setPageLiveAction, updatePageMetaAction,
} from "@/app/admin/website/actions";
import type { BuilderNavItem, BuilderPage, BuilderProps, Panel, SaveState } from "./types";
import { SectionInspector } from "./section-inspector";
import { ColorsEditor, ComponentsEditor, TypographyEditor } from "./theme-editors";
import { BlogLayoutEditor, HeaderFooterEditor } from "./site-editors";
import { NavigationEditor } from "./nav-editor";
import { inputCls, TextInput } from "./fields";

const PANELS: { key: Panel; label: string; icon: typeof Palette }[] = [
  { key: "pages", label: "Pages & sections", icon: PanelsTopLeft },
  { key: "theme", label: "Colours", icon: Palette },
  { key: "typography", label: "Typography", icon: Type },
  { key: "components", label: "Components", icon: Shapes },
  { key: "header-footer", label: "Header & footer", icon: Settings2 },
  { key: "navigation", label: "Navigation", icon: Navigation },
  { key: "blog-layout", label: "Blog layout", icon: Newspaper },
  { key: "templates", label: "Templates", icon: LayoutTemplate },
];

const DEVICES = [
  { key: "desktop", label: "Desktop", width: "100%", icon: Monitor },
  { key: "tablet", label: "Tablet", width: "768px", icon: Tablet },
  { key: "mobile", label: "Mobile", width: "390px", icon: Smartphone },
] as const;

const newId = () => (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "") : Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join(""));

function navTree(items: BuilderNavItem[], pages: BuilderPage[], location: "HEADER" | "FOOTER"): NavSnapshotTree[] {
  const href = (i: BuilderNavItem) => {
    if (i.type === "SYSTEM") return i.systemRoute;
    if (i.type === "EXTERNAL") return i.url;
    const p = pages.find((x) => x.id === i.pageId);
    return p ? (p.kind === "HOME" ? "/" : `/${p.slug}`) : null;
  };
  const mine = items.filter((i) => i.location === location && !i.hidden).sort((a, b) => a.sortOrder - b.sortOrder);
  return mine
    .filter((i) => !i.parentId)
    .map((t) => ({ id: t.id, label: t.label, href: href(t), openInNewTab: t.openInNewTab, children: mine.filter((c) => c.parentId === t.id).map((c) => ({ id: c.id, label: c.label, href: href(c), openInNewTab: c.openInNewTab, children: [] })) }));
}

/** Debounced autosave helper. Returns a flush function. */
function useAutosave<T>(value: T, save: (v: T) => Promise<{ ok?: boolean; error?: string; fieldErrors?: Record<string, string[]> }>, setState: (s: SaveState, err?: string) => void, resetKey = "", delay = 1200) {
  const first = useRef(true);
  const key = useRef(resetKey);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(value);
  const pending = useRef(false);
  latest.current = value;
  const run = useCallback(async () => {
    if (!pending.current) return;
    pending.current = false;
    setState("saving");
    const res = await save(latest.current);
    if (res.ok) setState(pending.current ? "dirty" : "saved");
    else setState("error", [res.error, ...Object.values(res.fieldErrors ?? {}).flat()].filter(Boolean).join(" "));
  }, [save, setState]);
  useEffect(() => {
    if (first.current || key.current !== resetKey) {
      // Initial render or switched to another record: nothing to save.
      first.current = false;
      key.current = resetKey;
      return;
    }
    pending.current = true;
    setState("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(run, delay);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    await run();
  }, [run]);
}

export function WebsiteBuilder(props: BuilderProps) {
  const [panel, setPanel] = useState<Panel>(props.initialPanel);
  const [tokens, setTokens] = useState<ThemeTokens>(props.tokens);
  const [config, setConfig] = useState<SiteConfig>(props.siteConfig);
  const [templateKey, setTemplateKey] = useState(props.templateKey);
  const [pages, setPages] = useState<BuilderPage[]>(props.pages);
  const [navigation, setNavigation] = useState<BuilderNavItem[]>(props.navigation);
  const [pageId, setPageId] = useState<string>(props.initialPageId ?? props.pages.find((p) => p.kind === "HOME")?.id ?? props.pages[0]?.id ?? "");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState<"content" | "style">("content");
  const [showPageSettings, setShowPageSettings] = useState(false);
  const [device, setDevice] = useState<(typeof DEVICES)[number]["key"]>("desktop");
  const [previewTokens, setPreviewTokens] = useState<{ key: string; tokens: ThemeTokens } | null>(null);
  const [adding, setAdding] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [saveStates, setSaveStates] = useState<Record<string, { state: SaveState; error?: string }>>({});
  const [unpublished, setUnpublished] = useState(props.hasUnpublishedChanges);
  const [publishing, setPublishing] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const page = pages.find((p) => p.id === pageId);
  const selected = page?.sections.find((s) => s.id === selectedId) ?? null;
  const pageLinks = useMemo(() => pages.map((p) => ({ title: p.title, slug: p.slug, kind: p.kind })), [pages]);

  const setSave = useCallback((key: string) => (state: SaveState, error?: string) => {
    setSaveStates((s) => ({ ...s, [key]: { state, error } }));
    if (state === "dirty" || state === "saved") setUnpublished(true);
  }, []);
  const setTokensSave = useMemo(() => setSave("theme"), [setSave]);
  const setConfigSave = useMemo(() => setSave("site"), [setSave]);
  const setPageSave = useMemo(() => setSave(`page:${pageId}`), [setSave, pageId]);

  const flushTokens = useAutosave(tokens, saveTokensAction, setTokensSave);
  const flushConfig = useAutosave(config, saveSiteConfigAction, setConfigSave);
  const savePage = useCallback((sections: SectionInstance[]) => saveSectionsAction(pageId, sections.map((s) => ({ id: s.id, type: s.type, hidden: s.hidden, props: s.props }))), [pageId]);
  const flushPage = useAutosave(page?.sections ?? [], savePage, setPageSave, pageId);

  const anyBusy = Object.values(saveStates).some((s) => s.state === "dirty" || s.state === "saving");
  const anyError = Object.entries(saveStates).find(([, s]) => s.state === "error");

  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      if (anyBusy) e.preventDefault();
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [anyBusy]);

  const updateSections = (fn: (sections: SectionInstance[]) => SectionInstance[]) => {
    setPages((all) => all.map((p) => (p.id === pageId ? { ...p, sections: fn(p.sections), hasUnpublishedChanges: true } : p)));
  };

  const addSection = (type: string) => {
    const id = newId();
    const section: SectionInstance = { id, type, hidden: false, props: defaultSectionProps(type) };
    updateSections((list) => {
      const at = selectedId ? list.findIndex((s) => s.id === selectedId) + 1 : list.length;
      return [...list.slice(0, at), section, ...list.slice(at)];
    });
    setSelectedId(id);
    setInspectorTab("content");
    setAdding(false);
  };

  const moveSection = (from: number, to: number) => {
    updateSections((list) => {
      if (to < 0 || to >= list.length) return list;
      const n = [...list];
      const [item] = n.splice(from, 1);
      n.splice(to, 0, item!);
      return n;
    });
  };

  async function flushAll() {
    await Promise.all([flushTokens(), flushConfig(), flushPage()]);
  }

  async function publish() {
    const note = window.prompt(props.publishNeedsApproval ? "Publishing requires approval. Add a note for reviewers (optional):" : "Publish all draft changes to the live website? Add an optional note:", "");
    if (note === null) return;
    setPublishing(true);
    setNotice(null);
    await flushAll();
    const res = await publishAction(note || undefined);
    setPublishing(false);
    if (!res.ok) return setNotice({ kind: "error", text: res.error ?? "Publishing failed. Nothing was changed on the live website." });
    const d = res.data as { pending: boolean; version?: number };
    if (d.pending) setNotice({ kind: "ok", text: "Approval requested. The live website will update when a reviewer approves." });
    else {
      setUnpublished(false);
      setPages((all) => all.map((p) => ({ ...p, hasUnpublishedChanges: false })));
      setNotice({ kind: "ok", text: `Published version ${d.version}. The live website now shows your changes.` });
    }
  }

  async function discard() {
    if (!window.confirm("Discard all unpublished changes to the theme, header/footer, navigation and pages? This cannot be undone.")) return;
    const res = await discardAction();
    if (res.ok) window.location.reload();
    else setNotice({ kind: "error", text: res.error ?? "Could not discard changes" });
  }

  async function applyTemplate(key: string) {
    const t = THEME_TEMPLATES.find((x) => x.key === key);
    if (!t || !window.confirm(`Apply “${t.name}” to the draft theme? Your current draft theme is saved as a backup version you can restore.`)) return;
    await flushTokens();
    const res = await applyTemplateAction(key);
    if (!res.ok) return setNotice({ kind: "error", text: res.error ?? "Could not apply template" });
    setPreviewTokens(null);
    setTemplateKey(key);
    // Replace local tokens without triggering an extra autosave cycle side-effect problem.
    setTokens(structuredClone(t.tokens));
    setNotice({ kind: "ok", text: `Applied ${t.name}. Publish to make it live.` });
  }

  const shownTokens = previewTokens?.tokens ?? tokens;
  const headerNav = useMemo(() => navTree(navigation, pages, "HEADER"), [navigation, pages]);
  const footerNav = useMemo(() => navTree(navigation, pages, "FOOTER"), [navigation, pages]);
  const deviceWidth = DEVICES.find((d) => d.key === device)!.width;
  const pageState = saveStates[`page:${pageId}`];

  const statusPill = anyError ? (
    <span className="flex items-center gap-1 text-xs font-medium text-red-700" role="alert"><AlertCircle className="h-3.5 w-3.5" /> Not saved: {anyError[1].error}</span>
  ) : anyBusy ? (
    <span className="flex items-center gap-1 text-xs text-gray-600" aria-live="polite"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving draft…</span>
  ) : (
    <span className="flex items-center gap-1 text-xs text-gray-600" aria-live="polite"><Check className="h-3.5 w-3.5 text-green-700" /> Draft saved{unpublished ? " · unpublished changes" : " · live site is up to date"}</span>
  );

  return (
    <div className="-mx-4 -my-6 flex h-[calc(100vh-4rem)] flex-col bg-gray-100 sm:-mx-6 lg:-mx-8">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-4 py-2">
        <h1 className="text-sm font-semibold text-gray-900">Website Builder</h1>
        {statusPill}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <a href={`/api/preview?path=${encodeURIComponent(page && page.kind !== "HOME" ? `/${page.slug}` : "/")}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium hover:bg-gray-50"><ExternalLink className="h-3.5 w-3.5" /> Full draft preview</a>
          <button type="button" onClick={discard} disabled={!unpublished} className="flex items-center gap-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium hover:bg-gray-50 disabled:opacity-50"><Undo2 className="h-3.5 w-3.5" /> Discard changes</button>
          {props.canPublish ? (
            <button type="button" onClick={publish} disabled={publishing || anyBusy} className="flex items-center gap-1 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
              {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CloudUpload className="h-3.5 w-3.5" />}
              {props.publishNeedsApproval ? "Request publish approval" : "Publish"}
            </button>
          ) : <span className="text-xs text-gray-500">You can edit drafts; a publisher must publish.</span>}
        </div>
      </div>
      {notice ? (
        <div role={notice.kind === "error" ? "alert" : "status"} className={cn("flex items-center justify-between px-4 py-2 text-sm", notice.kind === "error" ? "bg-red-50 text-red-800" : "bg-green-50 text-green-800")}>
          {notice.text}
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss"><X className="h-4 w-4" /></button>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* LEFT PANEL */}
        <aside className="flex max-h-[40vh] w-full shrink-0 flex-col overflow-y-auto border-b border-gray-200 bg-white lg:max-h-none lg:w-72 lg:border-b-0 lg:border-r" aria-label="Builder structure">
          <nav className="grid grid-cols-2 gap-1 border-b border-gray-100 p-2" aria-label="Builder panels">
            {PANELS.map((p) => (
              <button key={p.key} type="button" onClick={() => { setPanel(p.key); setShowPageSettings(false); }} aria-current={panel === p.key ? "page" : undefined} className={cn("flex items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs font-medium", panel === p.key ? "bg-brand-600 text-white" : "text-gray-700 hover:bg-gray-100")}>
                <p.icon className="h-3.5 w-3.5 shrink-0" aria-hidden /> {p.label}
              </button>
            ))}
          </nav>
          {panel === "pages" ? (
            <div className="flex-1 space-y-3 p-3">
              <div>
                <label htmlFor="page-select" className="mb-1 block text-xs font-semibold text-gray-700">Page</label>
                <div className="flex gap-1">
                  <select id="page-select" value={pageId} onChange={async (e) => { await flushPage(); setPageId(e.target.value); setSelectedId(null); setShowPageSettings(false); }} className={inputCls}>
                    {pages.map((p) => <option key={p.id} value={p.id}>{p.kind === "HOME" ? "🏠 " : ""}{p.title}{p.status === "DRAFT" ? " (draft)" : ""}</option>)}
                  </select>
                  <button type="button" title="Page settings" aria-label="Page settings" onClick={() => { setShowPageSettings(true); setSelectedId(null); }} className="rounded-md border border-gray-300 px-2 hover:bg-gray-50"><Settings2 className="h-4 w-4" /></button>
                </div>
                <Link href="/admin/website/pages" className="mt-1 inline-block text-[11px] font-medium text-brand-700 hover:underline">Manage pages, revisions & new pages →</Link>
              </div>
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Sections</h2>
                <button type="button" onClick={() => setAdding(true)} className="flex items-center gap-1 rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-800 hover:bg-brand-100"><Plus className="h-3.5 w-3.5" /> Add section</button>
              </div>
              {page && page.sections.length === 0 ? <p className="text-xs text-gray-500">This page has no sections yet.</p> : null}
              <ol className="space-y-1">
                {page?.sections.map((sec, i) => {
                  const def = getSectionDefinition(sec.type);
                  const label = (typeof sec.props.heading === "string" && sec.props.heading) || def?.label || sec.type;
                  return (
                    <li
                      key={sec.id}
                      draggable
                      onDragStart={() => setDragIndex(i)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => { if (dragIndex !== null && dragIndex !== i) moveSection(dragIndex, i); setDragIndex(null); }}
                      className={cn("group flex items-center gap-1 rounded-md border px-1.5 py-1.5 text-xs", selectedId === sec.id ? "border-brand-600 bg-brand-50" : "border-gray-200 bg-white hover:border-gray-300", sec.hidden && "opacity-60")}
                    >
                      <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-gray-400" aria-hidden />
                      <button type="button" onClick={() => { setSelectedId(sec.id); setShowPageSettings(false); }} className="min-w-0 flex-1 truncate text-left" aria-label={`Edit section: ${label}`}>
                        <span className="block truncate font-medium text-gray-900">{label}</span>
                        <span className="block truncate text-[10px] text-gray-500">{def?.label}{sec.hidden ? " · hidden" : ""}</span>
                      </button>
                      <button type="button" aria-label="Move section up" disabled={i === 0} onClick={() => moveSection(i, i - 1)} className="rounded p-0.5 hover:bg-gray-100 disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                      <button type="button" aria-label="Move section down" disabled={i === page.sections.length - 1} onClick={() => moveSection(i, i + 1)} className="rounded p-0.5 hover:bg-gray-100 disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                      <button type="button" aria-label={sec.hidden ? "Show section" : "Hide section"} onClick={() => updateSections((l) => l.map((x) => (x.id === sec.id ? { ...x, hidden: !x.hidden } : x)))} className="rounded p-0.5 hover:bg-gray-100">{sec.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</button>
                      <button type="button" aria-label="Duplicate section" onClick={() => updateSections((l) => [...l.slice(0, i + 1), { ...structuredClone(sec), id: newId() }, ...l.slice(i + 1)])} className="rounded p-0.5 hover:bg-gray-100"><Copy className="h-3.5 w-3.5" /></button>
                      <button type="button" aria-label="Delete section" onClick={() => { if (window.confirm("Delete this section from the draft?")) { updateSections((l) => l.filter((x) => x.id !== sec.id)); if (selectedId === sec.id) setSelectedId(null); } }} className="rounded p-0.5 text-red-700 hover:bg-gray-100"><Trash2 className="h-3.5 w-3.5" /></button>
                    </li>
                  );
                })}
              </ol>
              {pageState?.state === "error" ? <p role="alert" className="text-xs text-red-700">{pageState.error}</p> : null}
              <p className="text-[11px] text-gray-500">Drag sections or use the arrows to reorder. Changes save to the draft automatically.</p>
            </div>
          ) : (
            <div className="flex-1 p-3 text-xs text-gray-600">
              {panel === "templates" ? "Templates are complete starting points. Preview one, then apply it to your draft. Your previous theme is backed up automatically." : null}
              {panel === "theme" ? "Colours are design tokens: changing one updates every component that uses it, across all pages." : null}
              {panel === "typography" ? "Choose fonts and sizes for headings, body text and buttons. Devanagari text uses the selected Devanagari font automatically." : null}
              {panel === "components" ? "Control buttons, cards, images, forms, spacing and grids." : null}
              {panel === "header-footer" ? "Logo, favicon, header layout, footer content, SEO defaults and system page headings." : null}
              {panel === "navigation" ? "Edit header and footer menus. Save the menu, then publish." : null}
              {panel === "blog-layout" ? "Configure how the blog index and articles look. The preview shows your latest posts." : null}
            </div>
          )}
        </aside>

        {/* CENTRE PANEL — live preview */}
        <section className="flex min-h-0 min-w-0 flex-1 flex-col" aria-label="Live preview">
          <div className="flex items-center justify-between gap-2 border-b border-gray-200 bg-white px-3 py-1.5">
            <div role="group" aria-label="Preview device" className="flex gap-1">
              {DEVICES.map((d) => (
                <button key={d.key} type="button" onClick={() => setDevice(d.key)} aria-pressed={device === d.key} className={cn("flex items-center gap-1 rounded px-2 py-1 text-xs", device === d.key ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-100")}>
                  <d.icon className="h-3.5 w-3.5" aria-hidden /> {d.label}
                </button>
              ))}
            </div>
            <span className="truncate text-xs text-gray-500">{panel === "blog-layout" ? "Blog listing preview" : page ? `Previewing: ${page.title}` : ""} · draft</span>
          </div>
          {previewTokens ? (
            <div className="flex flex-wrap items-center justify-between gap-2 bg-blue-50 px-3 py-2 text-xs text-blue-900">
              <span>Previewing template <strong>{THEME_TEMPLATES.find((t) => t.key === previewTokens.key)?.name}</strong> — not applied yet.</span>
              <span className="flex gap-2">
                <button type="button" onClick={() => applyTemplate(previewTokens.key)} className="rounded bg-blue-700 px-2 py-1 font-medium text-white">Apply to draft</button>
                <button type="button" onClick={() => setPreviewTokens(null)} className="rounded border border-blue-300 px-2 py-1">Cancel</button>
              </span>
            </div>
          ) : null}
          <div className="min-h-0 flex-1 overflow-auto p-3">
            <div
              className="mx-auto overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-gray-200 transition-[width]"
              style={{ width: deviceWidth, maxWidth: "100%" }}
              onClickCapture={(e) => {
                const target = e.target as HTMLElement;
                const link = target.closest("a, button[type=submit]");
                if (link) e.preventDefault();
                const sec = target.closest("[data-section-id]") as HTMLElement | null;
                if (sec && panel === "pages") {
                  setSelectedId(sec.dataset.sectionId ?? null);
                  setShowPageSettings(false);
                }
              }}
            >
              <SiteFrame tokens={shownTokens} config={config} headerNav={headerNav} footerNav={footerNav} demo={props.isDemo} embedded>
                {panel === "blog-layout" ? (
                  <BlogPreview config={config} posts={props.samplePosts} />
                ) : page ? (
                  page.sections.length ? <SectionList sections={page.sections} data={props.sectionData} tokens={shownTokens} selectedId={panel === "pages" ? selectedId : null} /> : <div className="p-16 text-center opacity-70">Empty page — add a section.</div>
                ) : null}
              </SiteFrame>
            </div>
          </div>
        </section>

        {/* RIGHT PANEL — settings */}
        <aside className="w-full shrink-0 overflow-y-auto border-t border-gray-200 bg-white lg:w-80 lg:border-l lg:border-t-0" aria-label="Settings">
          <div className="p-3">
            {panel === "pages" ? (
              showPageSettings && page ? (
                <PageSettings key={page.id} page={page} canPublish={props.canPublish} onSaved={(meta) => setPages((all) => all.map((p) => (p.id === page.id ? { ...p, ...meta } : p)))} />
              ) : selected ? (
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-semibold">{getSectionDefinition(selected.type)?.label}</h2>
                    <button type="button" onClick={() => setSelectedId(null)} aria-label="Close section settings" className="rounded p-1 hover:bg-gray-100"><X className="h-4 w-4" /></button>
                  </div>
                  <div role="tablist" className="mb-3 grid grid-cols-2 gap-1 rounded-md bg-gray-100 p-1">
                    {(["content", "style"] as const).map((t) => (
                      <button key={t} role="tab" type="button" aria-selected={inspectorTab === t} onClick={() => setInspectorTab(t)} className={cn("rounded px-2 py-1 text-xs font-medium capitalize", inspectorTab === t ? "bg-white shadow-sm" : "text-gray-600")}>{t === "style" ? "Design & layout" : "Content"}</button>
                    ))}
                  </div>
                  <SectionInspector section={selected} tab={inspectorTab} pages={pageLinks} projects={props.projects} onChange={(newProps) => updateSections((l) => l.map((x) => (x.id === selected.id ? { ...x, props: newProps } : x)))} />
                </div>
              ) : (
                <div className="space-y-2 text-sm text-gray-600">
                  <p className="font-medium text-gray-900">Select a section</p>
                  <p>Click a section in the preview or in the list to edit its content, colours, spacing and layout.</p>
                </div>
              )
            ) : null}
            {panel === "theme" ? <ColorsEditor tokens={tokens} onChange={setTokens} templateKey={templateKey} /> : null}
            {panel === "typography" ? <TypographyEditor tokens={tokens} onChange={setTokens} /> : null}
            {panel === "components" ? <ComponentsEditor tokens={tokens} onChange={setTokens} /> : null}
            {panel === "header-footer" ? <HeaderFooterEditor config={config} onChange={setConfig} pages={pageLinks} /> : null}
            {panel === "blog-layout" ? <BlogLayoutEditor config={config} onChange={setConfig} /> : null}
            {panel === "navigation" ? <NavigationEditor initial={navigation} pages={pages} onSaved={() => setUnpublished(true)} onPreview={setNavigation} /> : null}
            {panel === "templates" ? (
              <div className="space-y-3">
                {THEME_TEMPLATES.map((t) => (
                  <div key={t.key} className={cn("rounded-lg border p-3", templateKey === t.key ? "border-brand-600" : "border-gray-200")}>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">{t.name}</p>
                      {templateKey === t.key ? <span className="text-[11px] font-medium text-brand-700">Current base</span> : null}
                    </div>
                    <p className="mt-1 text-xs text-gray-600">{t.description}</p>
                    <div className="mt-2 flex" aria-hidden>{(["primary", "secondary", "accent", "surfaceAlt", "navBg", "footerBg"] as const).map((k) => <span key={k} className="h-5 flex-1" style={{ background: t.tokens.colors[k] }} />)}</div>
                    <div className="mt-2 flex gap-2">
                      <button type="button" onClick={() => setPreviewTokens({ key: t.key, tokens: t.tokens })} className="rounded border border-gray-300 px-2 py-1 text-xs font-medium hover:bg-gray-50">Preview</button>
                      <button type="button" onClick={() => applyTemplate(t.key)} className="rounded bg-brand-600 px-2 py-1 text-xs font-medium text-white hover:bg-brand-700">Apply…</button>
                    </div>
                  </div>
                ))}
                <div className="rounded-lg border border-dashed border-gray-300 p-3 text-xs text-gray-600">
                  <p className="font-semibold text-gray-900">Custom theme</p>
                  <p className="mt-1">Any template becomes your custom theme once you edit colours, typography or components. Templates are optional.</p>
                </div>
              </div>
            ) : null}
          </div>
        </aside>
      </div>

      {adding ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Add a section">
          <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">Add a section</h2>
              <button type="button" onClick={() => setAdding(false)} aria-label="Close"><X className="h-5 w-5" /></button>
            </div>
            {(["Hero", "Content", "CSR", "Media", "Engagement"] as const).map((cat) => (
              <div key={cat} className="mb-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{cat}</h3>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {SECTION_DEFINITIONS.filter((d) => d.category === cat).map((d) => (
                    <button key={d.type} type="button" onClick={() => addSection(d.type)} className="rounded-lg border border-gray-200 p-3 text-left hover:border-brand-600 hover:bg-brand-50">
                      <p className="flex items-center gap-1 text-sm font-medium"><FileText className="h-3.5 w-3.5 text-brand-700" aria-hidden /> {d.label}</p>
                      <p className="mt-1 text-xs text-gray-600">{d.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PageSettings({ page, canPublish, onSaved }: { page: BuilderPage; canPublish: boolean; onSaved: (meta: Partial<BuilderPage>) => void }) {
  const [meta, setMeta] = useState({ title: page.title, slug: page.slug, seoTitle: page.seoTitle ?? "", seoDescription: page.seoDescription ?? "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold">Page settings</h2>
      <TextInput label="Title" value={meta.title} onChange={(v) => setMeta({ ...meta, title: v })} max={120} />
      {page.kind !== "HOME" ? <TextInput label="Address (slug)" value={meta.slug} onChange={(v) => setMeta({ ...meta, slug: v.toLowerCase() })} hint={`/${meta.slug}`} max={80} /> : <p className="text-xs text-gray-500">The homepage is always served at /.</p>}
      <TextInput label="SEO title" value={meta.seoTitle} onChange={(v) => setMeta({ ...meta, seoTitle: v })} max={120} />
      <TextInput label="SEO description" value={meta.seoDescription} onChange={(v) => setMeta({ ...meta, seoDescription: v })} multiline max={300} />
      <button
        type="button"
        onClick={async () => {
          const res = await updatePageMetaAction(page.id, meta);
          setMsg(res.ok ? { ok: true, text: "Saved to draft" } : { ok: false, text: [res.error, ...Object.values(res.fieldErrors ?? {}).flat()].join(" ") });
          if (res.ok) onSaved({ ...meta, hasUnpublishedChanges: true });
        }}
        className="w-full rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        Save page settings
      </button>
      {page.kind !== "HOME" && canPublish ? (
        <div className="space-y-1 border-t border-gray-100 pt-3 text-xs">
          <p>Status: <strong>{page.status === "PUBLISHED" ? "Live (or going live on next publish)" : "Draft — not on the website"}</strong></p>
          <button
            type="button"
            onClick={async () => {
              const live = page.status !== "PUBLISHED";
              const res = await setPageLiveAction(page.id, live);
              setMsg(res.ok ? { ok: true, text: res.message ?? "Saved" } : { ok: false, text: res.error ?? "Failed" });
              if (res.ok) onSaved({ status: live ? "PUBLISHED" : "DRAFT" });
            }}
            className="rounded border border-gray-300 px-2 py-1 font-medium hover:bg-gray-50"
          >
            {page.status === "PUBLISHED" ? "Unpublish this page now" : "Include this page in the next publish"}
          </button>
        </div>
      ) : null}
      {msg ? <p role={msg.ok ? "status" : "alert"} className={cn("text-xs", msg.ok ? "text-green-700" : "text-red-700")}>{msg.text}</p> : null}
    </div>
  );
}

function BlogPreview({ config, posts }: { config: SiteConfig; posts: BuilderProps["samplePosts"] }) {
  const b = config.blog;
  const opts = { showAuthor: b.showAuthor, showCategories: b.showCategories, showDate: b.showDate, showReadingTime: b.showReadingTime, cardStyle: b.cardStyle, imageAspect: b.imageAspect };
  const [featured, ...rest] = b.layout === "featured" ? posts : [undefined, ...posts];
  return (
    <>
      <section className="section-pt-md section-pb-sm" style={{ background: "var(--c-surface-alt)" }}>
        <div className="site-container"><h1>{config.pages.blog.title || "News & stories"}</h1>{config.pages.blog.intro ? <p className="mt-4 text-lg">{config.pages.blog.intro}</p> : null}</div>
      </section>
      <section className="section-pt-sm section-pb-md">
        <div className={`site-container grid gap-10 ${b.sidebar ? "@4xl:grid-cols-4" : ""}`}>
          <div className={b.sidebar ? "@4xl:col-span-3" : ""}>
            {posts.length === 0 ? <p>No published posts yet — this is how the layout will look once you publish posts.</p> : null}
            {featured ? <div className="mb-8"><PostCard post={featured} options={{ ...opts, horizontal: true }} /></div> : null}
            {b.layout === "list" ? (
              <div className="grid gap-6">{rest.map((p) => p && <PostCard key={p.id} post={p} options={{ ...opts, horizontal: true }} />)}</div>
            ) : (
              <div className="site-grid" style={{ ["--cols" as string]: String(b.columns) }}>{rest.map((p) => p && <PostCard key={p.id} post={p} options={opts} />)}</div>
            )}
          </div>
          {b.sidebar ? <aside className="space-y-4"><p className="text-sm font-semibold">Search</p><input className="site-input" disabled /><p className="text-sm font-semibold">Categories</p></aside> : null}
        </div>
      </section>
    </>
  );
}
