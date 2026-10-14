"use client";

import { Plus, Trash2 } from "lucide-react";
import type { SiteConfig } from "@/lib/site/config";
import { SOCIAL_PLATFORMS } from "@/lib/site/config";
import { ButtonInput, ImageInput, NumberInput, SelectInput, TextInput, Toggle, inputCls } from "./fields";

type Pages = { title: string; slug: string; kind: string }[];

export function HeaderFooterEditor({ config, onChange, pages }: { config: SiteConfig; onChange: (c: SiteConfig) => void; pages: Pages }) {
  const id = config.identity;
  const h = config.header;
  const f = config.footer;
  const setId = (p: Partial<SiteConfig["identity"]>) => onChange({ ...config, identity: { ...id, ...p } });
  const setH = (p: Partial<SiteConfig["header"]>) => onChange({ ...config, header: { ...h, ...p } });
  const setF = (p: Partial<SiteConfig["footer"]>) => onChange({ ...config, footer: { ...f, ...p } });
  return (
    <div className="space-y-6">
      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-wide text-gray-500">Identity</legend>
        <TextInput label="Site / organisation name" value={id.siteName} onChange={(v) => setId({ siteName: v })} max={120} />
        <TextInput label="Tagline" value={id.tagline} onChange={(v) => setId({ tagline: v })} max={200} />
        <ImageInput label="Logo" value={id.logo} onChange={(v) => setId({ logo: v })} />
        <ImageInput label="Favicon (square image or .ico)" value={id.favicon} onChange={(v) => setId({ favicon: v })} />
        <Toggle label="Show site name next to the logo" value={id.showSiteName} onChange={(v) => setId({ showSiteName: v })} />
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-wide text-gray-500">Header</legend>
        <SelectInput label="Layout" value={h.layout} onChange={(v) => setH({ layout: v as SiteConfig["header"]["layout"] })} options={[{ value: "logo-left", label: "Logo left" }, { value: "logo-center", label: "Logo centred, menu below" }, { value: "split", label: "Split menu, logo centred" }]} />
        <SelectInput label="Menu alignment" value={h.navAlign} onChange={(v) => setH({ navAlign: v as SiteConfig["header"]["navAlign"] })} options={[{ value: "left", label: "Left" }, { value: "center", label: "Centre" }, { value: "right", label: "Right" }]} />
        <NumberInput label="Logo height" value={h.logoHeight} onChange={(v) => setH({ logoHeight: v })} min={24} max={96} unit="px" />
        <Toggle label="Sticky header" value={h.sticky} onChange={(v) => setH({ sticky: v })} />
        <Toggle label="Show tagline in header" value={h.showTagline} onChange={(v) => setH({ showTagline: v })} />
        <Toggle label="Show call-to-action button" value={h.cta.enabled} onChange={(v) => setH({ cta: { ...h.cta, enabled: v } })} />
        {h.cta.enabled ? <ButtonInput label="Header button" value={{ label: h.cta.label, href: h.cta.href }} onChange={(b) => setH({ cta: { enabled: true, label: b.label, href: b.href } })} pages={pages} /> : null}
        <p className="text-[11px] text-gray-500">Menu items are edited under Navigation.</p>
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-wide text-gray-500">Footer</legend>
        <SelectInput label="Layout" value={f.layout} onChange={(v) => setF({ layout: v as SiteConfig["footer"]["layout"] })} options={[{ value: "columns", label: "Columns" }, { value: "centered", label: "Centred" }, { value: "simple", label: "Simple (one line)" }]} />
        <TextInput label="About text" value={f.about} onChange={(v) => setF({ about: v })} multiline max={600} />
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-700">Extra columns ({f.columns.length}/4)</p>
          {f.columns.map((c, i) => (
            <div key={i} className="space-y-1 rounded border border-gray-200 p-2">
              <div className="flex justify-end"><button type="button" aria-label="Remove column" onClick={() => setF({ columns: f.columns.filter((_, j) => j !== i) })} className="text-red-700"><Trash2 className="h-3.5 w-3.5" /></button></div>
              <input aria-label="Column title" placeholder="Title" value={c.title} onChange={(e) => setF({ columns: f.columns.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} className={inputCls} />
              <textarea aria-label="Column text" placeholder="Text" rows={2} value={c.body} onChange={(e) => setF({ columns: f.columns.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)) })} className={inputCls} />
            </div>
          ))}
          {f.columns.length < 4 ? <button type="button" onClick={() => setF({ columns: [...f.columns, { title: "", body: "" }] })} className="flex items-center gap-1 text-xs font-medium text-brand-700"><Plus className="h-3.5 w-3.5" /> Add column</button> : null}
        </div>
        <Toggle label="Show footer navigation" value={f.showNavigation} onChange={(v) => setF({ showNavigation: v })} />
        <Toggle label="Show contact information" value={f.showContact} onChange={(v) => setF({ showContact: v })} />
        {f.showContact ? (
          <div className="space-y-2 rounded border border-gray-200 p-2">
            <TextInput label="Email" value={f.contact.email} onChange={(v) => setF({ contact: { ...f.contact, email: v } })} />
            <TextInput label="Phone" value={f.contact.phone} onChange={(v) => setF({ contact: { ...f.contact, phone: v } })} />
            <TextInput label="Address" value={f.contact.address} onChange={(v) => setF({ contact: { ...f.contact, address: v } })} multiline />
          </div>
        ) : null}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-700">Social links</p>
          {f.social.map((s, i) => (
            <div key={i} className="flex gap-1">
              <select aria-label="Platform" value={s.platform} onChange={(e) => setF({ social: f.social.map((x, j) => (j === i ? { ...x, platform: e.target.value as typeof s.platform } : x)) })} className={`${inputCls} w-28`}>
                {SOCIAL_PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <input aria-label="URL" placeholder="https://" value={s.url} onChange={(e) => setF({ social: f.social.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })} className={inputCls} />
              <button type="button" aria-label="Remove social link" onClick={() => setF({ social: f.social.filter((_, j) => j !== i) })} className="px-1 text-red-700"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
          {f.social.length < 8 ? <button type="button" onClick={() => setF({ social: [...f.social, { platform: "linkedin", url: "" }] })} className="flex items-center gap-1 text-xs font-medium text-brand-700"><Plus className="h-3.5 w-3.5" /> Add social link</button> : null}
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-700">Legal links</p>
          {f.legalLinks.map((l, i) => (
            <div key={i} className="flex items-start gap-1">
              <div className="flex-1"><ButtonInput label={`Link ${i + 1}`} value={l} onChange={(v) => setF({ legalLinks: f.legalLinks.map((x, j) => (j === i ? v : x)) })} pages={pages} /></div>
              <button type="button" aria-label="Remove legal link" onClick={() => setF({ legalLinks: f.legalLinks.filter((_, j) => j !== i) })} className="mt-3 px-1 text-red-700"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
          {f.legalLinks.length < 6 ? <button type="button" onClick={() => setF({ legalLinks: [...f.legalLinks, { label: "", href: "" }] })} className="flex items-center gap-1 text-xs font-medium text-brand-700"><Plus className="h-3.5 w-3.5" /> Add legal link</button> : null}
        </div>
        <TextInput label="Copyright text" value={f.copyright} onChange={(v) => setF({ copyright: v })} max={200} />
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-wide text-gray-500">SEO defaults</legend>
        <TextInput label="Title template" value={config.seo.titleTemplate} onChange={(v) => onChange({ ...config, seo: { ...config.seo, titleTemplate: v } })} hint="Use %s for the page title, e.g. “%s | My Foundation”." />
        <TextInput label="Default description" value={config.seo.description} onChange={(v) => onChange({ ...config, seo: { ...config.seo, description: v } })} multiline max={300} />
        <ImageInput label="Default social sharing image" value={config.seo.ogImage} onChange={(v) => onChange({ ...config, seo: { ...config.seo, ogImage: v } })} />
        <Toggle label="Ask search engines not to index this site" value={config.seo.noIndex} onChange={(v) => onChange({ ...config, seo: { ...config.seo, noIndex: v } })} />
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-wide text-gray-500">System page headings</legend>
        {(["projects", "blog", "reports", "contact"] as const).map((k) => (
          <div key={k} className="space-y-1 rounded border border-gray-200 p-2">
            <TextInput label={`/${k} title`} value={config.pages[k].title} onChange={(v) => onChange({ ...config, pages: { ...config.pages, [k]: { ...config.pages[k], title: v } } })} />
            <TextInput label={`/${k} introduction`} value={config.pages[k].intro} onChange={(v) => onChange({ ...config, pages: { ...config.pages, [k]: { ...config.pages[k], intro: v } } })} multiline />
          </div>
        ))}
      </fieldset>
    </div>
  );
}

export function BlogLayoutEditor({ config, onChange }: { config: SiteConfig; onChange: (c: SiteConfig) => void }) {
  const b = config.blog;
  const set = (p: Partial<SiteConfig["blog"]>) => onChange({ ...config, blog: { ...b, ...p } });
  return (
    <div className="space-y-4">
      <SelectInput label="Listing layout" value={b.layout} onChange={(v) => set({ layout: v as typeof b.layout })} options={[{ value: "grid", label: "Grid" }, { value: "list", label: "List" }, { value: "featured", label: "Featured article + grid" }]} />
      <SelectInput label="Columns" value={String(b.columns)} onChange={(v) => set({ columns: Number(v) })} options={["1", "2", "3", "4"].map((v) => ({ value: v, label: v }))} />
      <SelectInput label="Card style" value={b.cardStyle} onChange={(v) => set({ cardStyle: v as typeof b.cardStyle })} options={[{ value: "elevated", label: "Elevated" }, { value: "bordered", label: "Bordered" }, { value: "minimal", label: "Minimal" }]} />
      <SelectInput label="Image aspect ratio" value={b.imageAspect} onChange={(v) => set({ imageAspect: v as typeof b.imageAspect })} options={["16/9", "4/3", "3/2", "1/1"].map((v) => ({ value: v, label: v.replace("/", ":") }))} />
      <NumberInput label="Posts per page" value={b.postsPerPage} onChange={(v) => set({ postsPerPage: v })} min={3} max={48} />
      <Toggle label="Sidebar (search & categories)" value={b.sidebar} onChange={(v) => set({ sidebar: v })} />
      <Toggle label="Category badges" value={b.showCategories} onChange={(v) => set({ showCategories: v })} />
      <Toggle label="Author" value={b.showAuthor} onChange={(v) => set({ showAuthor: v })} />
      <Toggle label="Publication date" value={b.showDate} onChange={(v) => set({ showDate: v })} />
      <Toggle label="Reading time" value={b.showReadingTime} onChange={(v) => set({ showReadingTime: v })} />
      <Toggle label="Related articles" value={b.showRelated} onChange={(v) => set({ showRelated: v })} />
      <Toggle label="Sharing links" value={b.showShare} onChange={(v) => set({ showShare: v })} />
      <SelectInput label="Article content width" value={b.articleWidth} onChange={(v) => set({ articleWidth: v as typeof b.articleWidth })} options={[{ value: "narrow", label: "Narrow (best for reading)" }, { value: "normal", label: "Normal" }, { value: "wide", label: "Wide" }]} />
      <SelectInput label="Article text size" value={b.articleFontSize} onChange={(v) => set({ articleFontSize: v as typeof b.articleFontSize })} options={[{ value: "sm", label: "Small" }, { value: "md", label: "Medium" }, { value: "lg", label: "Large" }]} />
    </div>
  );
}
