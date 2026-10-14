"use client";

import { useId, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ImageIcon, Plus, Trash2 } from "lucide-react";
import { MediaPickerDialog } from "@/components/admin/media-picker";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { HEX } from "@/lib/theme/tokens";
import type { FieldDef } from "@/lib/site/sections";
import { SECTION_ICONS } from "@/lib/site/sections";
import type { ButtonRef, ImageRef } from "@/lib/site/links";
import { isSafeHref, SYSTEM_ROUTES } from "@/lib/site/links";
import { cn } from "@/lib/utils";

export const inputCls = "block w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20";

export function Row({ label, children, hint, htmlFor }: { label: string; children: ReactNode; hint?: string; htmlFor?: string }) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block text-xs font-semibold text-gray-700">{label}</label>
      {children}
      {hint ? <p className="text-[11px] text-gray-500">{hint}</p> : null}
    </div>
  );
}

export function TextInput({ label, value, onChange, hint, max, multiline, placeholder }: { label: string; value: string; onChange: (v: string) => void; hint?: string; max?: number; multiline?: boolean; placeholder?: string }) {
  const id = useId();
  return (
    <Row label={label} hint={hint} htmlFor={id}>
      {multiline ? (
        <textarea id={id} value={value} maxLength={max} rows={3} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={inputCls} />
      ) : (
        <input id={id} value={value} maxLength={max} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={inputCls} />
      )}
    </Row>
  );
}

export function SelectInput({ label, value, onChange, options, hint }: { label: string; value: string; onChange: (v: string) => void; options: readonly { value: string; label: string }[]; hint?: string }) {
  const id = useId();
  return (
    <Row label={label} hint={hint} htmlFor={id}>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Row>
  );
}

export function NumberInput({ label, value, onChange, min, max, step = 1, unit }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; unit?: string }) {
  const id = useId();
  return (
    <Row label={`${label}: ${value}${unit ?? ""}`} htmlFor={id}>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-brand-600" />
    </Row>
  );
}

export function Toggle({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  const id = useId();
  return (
    <div className="flex items-start gap-2">
      <input id={id} type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-brand-600" />
      <div>
        <label htmlFor={id} className="text-sm text-gray-800">{label}</label>
        {hint ? <p className="text-[11px] text-gray-500">{hint}</p> : null}
      </div>
    </div>
  );
}

/** Colour picker with an editable, validated HEX value. */
export function ColorInput({ label, value, onChange, warning }: { label: string; value: string; onChange: (v: string) => void; warning?: string }) {
  const id = useId();
  const [text, setText] = useState(value);
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setText(value);
  }
  const valid = HEX.test(text);
  return (
    <div className="flex items-center gap-2">
      <input type="color" aria-label={`${label} colour picker`} value={HEX.test(value) ? value : "#000000"} onChange={(e) => onChange(e.target.value.toUpperCase())} className="h-8 w-10 cursor-pointer rounded border border-gray-300 p-0.5" />
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="block truncate text-xs font-medium text-gray-700">{label}</label>
        <input
          id={id}
          value={text}
          aria-invalid={!valid}
          onChange={(e) => {
            const v = e.target.value.trim();
            setText(v);
            if (HEX.test(v)) onChange(v.toUpperCase());
          }}
          className={cn("w-full rounded border px-1.5 py-0.5 font-mono text-xs", valid ? "border-gray-300" : "border-red-500")}
        />
        {!valid ? <p className="text-[11px] text-red-700">Use #RRGGBB</p> : warning ? <p className="text-[11px] text-amber-700">{warning}</p> : null}
      </div>
    </div>
  );
}

export function ImageInput({ label, value, onChange }: { label: string; value: ImageRef; onChange: (v: ImageRef) => void }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="space-y-1.5">
      <span className="block text-xs font-semibold text-gray-700">{label}</span>
      <div className="flex items-center gap-2">
        {value.url ? <img src={value.url} alt="" className="h-14 w-20 rounded border border-gray-200 object-cover" /> : <div className="flex h-14 w-20 items-center justify-center rounded border border-dashed border-gray-300 text-gray-400"><ImageIcon className="h-5 w-5" /></div>}
        <div className="flex flex-col gap-1">
          <button type="button" onClick={() => setOpen(true)} className="rounded border border-gray-300 px-2 py-1 text-xs font-medium hover:bg-gray-50">{value.url ? "Change" : "Choose"}</button>
          {value.url ? <button type="button" onClick={() => onChange({ url: "", alt: "", mediaId: null })} className="text-xs text-red-700 hover:underline">Remove</button> : null}
        </div>
      </div>
      {value.url ? (
        <div>
          <label htmlFor={id} className="text-[11px] font-medium text-gray-600">Alt text</label>
          <input id={id} value={value.alt} onChange={(e) => onChange({ ...value, alt: e.target.value })} className={inputCls} placeholder="Describe the image" />
        </div>
      ) : null}
      <MediaPickerDialog open={open} onClose={() => setOpen(false)} onPick={(m) => onChange({ url: m.url, alt: m.alt || value.alt, mediaId: m.id })} />
    </div>
  );
}

export function ButtonInput({ label, value, onChange, pages }: { label: string; value: ButtonRef; onChange: (v: ButtonRef) => void; pages: { title: string; slug: string; kind: string }[] }) {
  const listId = useId();
  const valid = isSafeHref(value.href ?? "");
  return (
    <fieldset className="space-y-1.5 rounded-md border border-gray-200 p-2">
      <legend className="px-1 text-xs font-semibold text-gray-700">{label}</legend>
      <input aria-label={`${label} text`} placeholder="Button text (leave empty to hide)" value={value.label ?? ""} onChange={(e) => onChange({ ...value, label: e.target.value })} className={inputCls} />
      <input aria-label={`${label} link`} list={listId} placeholder="/page, #anchor or https://…" value={value.href ?? ""} onChange={(e) => onChange({ ...value, href: e.target.value })} className={cn(inputCls, !valid && "border-red-500")} />
      <datalist id={listId}>
        {SYSTEM_ROUTES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        {pages.filter((p) => p.kind !== "HOME").map((p) => <option key={p.slug} value={`/${p.slug}`}>{p.title}</option>)}
      </datalist>
      {!valid ? <p className="text-[11px] text-red-700">Use a site path like /about, an anchor, or a full https:// URL.</p> : null}
    </fieldset>
  );
}

type Ctx = { pages: { title: string; slug: string; kind: string }[]; projects: { id: string; title: string }[]; editorKey: string };

/** Renders an editor control for a registry field definition. */
export function FieldInput({ field, value, onChange, ctx }: { field: FieldDef; value: unknown; onChange: (v: unknown) => void; ctx: Ctx }) {
  switch (field.type) {
    case "text":
      return <TextInput label={field.label} value={String(value ?? "")} onChange={onChange} max={field.max} hint={field.help} placeholder={field.placeholder} />;
    case "textarea":
      return <TextInput label={field.label} value={String(value ?? "")} onChange={onChange} max={field.max} hint={field.help} multiline />;
    case "richtext":
      return (
        <div className="space-y-1">
          <span className="block text-xs font-semibold text-gray-700">{field.label}</span>
          <RichTextEditor key={`${ctx.editorKey}-${field.key}`} label={field.label} initialHtml={String(value ?? "")} onChange={onChange} />
        </div>
      );
    case "image":
      return <ImageInput label={field.label} value={(value as ImageRef) ?? { url: "", alt: "" }} onChange={onChange} />;
    case "button":
      return <ButtonInput label={field.label} value={(value as ButtonRef) ?? { label: "", href: "" }} onChange={onChange} pages={ctx.pages} />;
    case "select":
      return <SelectInput label={field.label} value={String(value ?? field.options[0]?.value)} onChange={onChange} options={field.options} hint={field.help} />;
    case "number":
      return <NumberInput label={field.label} value={Number(value ?? field.min)} onChange={onChange} min={field.min} max={field.max} step={field.step} />;
    case "boolean":
      return <Toggle label={field.label} value={value === true} onChange={onChange} hint={field.help} />;
    case "icon":
      return <SelectInput label={field.label} value={String(value ?? "leaf")} onChange={onChange} options={SECTION_ICONS.map((i) => ({ value: i, label: i }))} />;
    case "projects": {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <fieldset className="space-y-1">
          <legend className="text-xs font-semibold text-gray-700">{field.label}</legend>
          {ctx.projects.length === 0 ? <p className="text-[11px] text-gray-500">No published projects available.</p> : (
            <div className="max-h-40 space-y-1 overflow-y-auto rounded border border-gray-200 p-2">
              {ctx.projects.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={selected.includes(p.id)} onChange={(e) => onChange(e.target.checked ? [...selected, p.id].slice(0, field.max ?? 12) : selected.filter((x) => x !== p.id))} className="accent-brand-600" />
                  {p.title}
                </label>
              ))}
            </div>
          )}
        </fieldset>
      );
    }
    case "list": {
      const items = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
      const set = (next: Record<string, unknown>[]) => onChange(next);
      const blank = () => Object.fromEntries(field.fields.map((f) => [f.key, f.type === "image" ? { url: "", alt: "" } : f.type === "button" ? { label: "", href: "" } : f.type === "icon" ? "leaf" : f.type === "boolean" ? false : ""]));
      return (
        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold text-gray-700">{field.label} ({items.length}/{field.max})</legend>
          {items.map((item, i) => (
            <div key={i} className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-600">{field.itemLabel} {i + 1}</span>
                <div className="flex gap-1">
                  <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => { const n = [...items]; [n[i - 1], n[i]] = [n[i]!, n[i - 1]!]; set(n); }} className="rounded p-1 hover:bg-white disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button type="button" aria-label="Move down" disabled={i === items.length - 1} onClick={() => { const n = [...items]; [n[i + 1], n[i]] = [n[i]!, n[i + 1]!]; set(n); }} className="rounded p-1 hover:bg-white disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                  <button type="button" aria-label={`Remove ${field.itemLabel} ${i + 1}`} onClick={() => set(items.filter((_, j) => j !== i))} className="rounded p-1 text-red-700 hover:bg-white"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
              {field.fields.map((f) => (
                <FieldInput key={f.key} field={f} value={item[f.key]} ctx={{ ...ctx, editorKey: `${ctx.editorKey}-${i}` }} onChange={(v) => set(items.map((it, j) => (j === i ? { ...it, [f.key]: v } : it)))} />
              ))}
            </div>
          ))}
          {items.length < field.max ? (
            <button type="button" onClick={() => set([...items, blank()])} className="flex items-center gap-1 rounded border border-dashed border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">
              <Plus className="h-3.5 w-3.5" /> Add {field.itemLabel.toLowerCase()}
            </button>
          ) : null}
        </fieldset>
      );
    }
  }
}
