"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { COLOR_GROUPS, type ColorKey, type ThemeTokens } from "@/lib/theme/tokens";
import { contrastWarnings } from "@/lib/theme/contrast";
import { DEVANAGARI_FONT_KEYS, FONTS, FONT_KEYS } from "@/lib/theme/fonts";
import { PRESET_PALETTES, getTemplate, defaultTokens } from "@/lib/theme/templates";
import { ColorInput, NumberInput, SelectInput } from "./fields";

const fontOptions = FONT_KEYS.map((k) => ({ value: k, label: FONTS[k].label }));

export function ColorsEditor({ tokens, onChange, templateKey }: { tokens: ThemeTokens; onChange: (t: ThemeTokens) => void; templateKey: string }) {
  const warnings = contrastWarnings(tokens.colors);
  const warnFor = (k: ColorKey) => warnings.find((w) => w.fg === k || w.bg === k);
  const set = (k: ColorKey, v: string) => onChange({ ...tokens, colors: { ...tokens.colors, [k]: v } });
  const base = getTemplate(templateKey)?.tokens ?? defaultTokens();
  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-xs font-semibold text-gray-700">Preset palettes</p>
        <div className="grid grid-cols-1 gap-2">
          {PRESET_PALETTES.map((p) => (
            <button key={p.key} type="button" onClick={() => onChange({ ...tokens, colors: { ...p.colors } })} className="flex items-center justify-between gap-2 rounded-md border border-gray-200 px-2 py-1.5 text-left text-xs hover:border-brand-600">
              <span>{p.name}</span>
              <span className="flex" aria-hidden>
                {(["primary", "secondary", "accent", "surfaceAlt", "footerBg"] as const).map((k) => <span key={k} className="h-4 w-4 border border-white" style={{ background: p.colors[k] }} />)}
              </span>
            </button>
          ))}
        </div>
      </div>
      {warnings.length ? (
        <div role="status" className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
          <p className="flex items-center gap-1 font-semibold"><AlertTriangle className="h-3.5 w-3.5" /> Contrast warnings ({warnings.length})</p>
          <ul className="mt-1 list-disc pl-4">
            {warnings.map((w) => <li key={`${w.fg}-${w.bg}`}>{w.label}: {w.ratio}:1 (needs {w.min}:1)</li>)}
          </ul>
        </div>
      ) : <p className="rounded-md bg-green-50 p-2 text-xs text-green-800">All checked colour pairs meet WCAG AA contrast.</p>}
      {COLOR_GROUPS.map((g) => (
        <fieldset key={g.title} className="space-y-2">
          <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{g.title}</legend>
          {g.keys.map(({ key, label }) => {
            const w = warnFor(key);
            return <ColorInput key={key} label={label} value={tokens.colors[key]} onChange={(v) => set(key, v)} warning={w ? `Low contrast (${w.ratio}:1)` : undefined} />;
          })}
        </fieldset>
      ))}
      <button type="button" onClick={() => onChange({ ...tokens, colors: { ...base.colors } })} className="flex items-center gap-1 text-xs font-medium text-gray-700 hover:underline">
        <RotateCcw className="h-3.5 w-3.5" /> Reset colours to the theme template
      </button>
    </div>
  );
}

export function TypographyEditor({ tokens, onChange }: { tokens: ThemeTokens; onChange: (t: ThemeTokens) => void }) {
  const t = tokens.typography;
  const set = <K extends keyof ThemeTokens["typography"]>(k: K, v: ThemeTokens["typography"][K]) => onChange({ ...tokens, typography: { ...t, [k]: v } });
  return (
    <div className="space-y-4">
      <SelectInput label="Heading font" value={t.headingFont} onChange={(v) => set("headingFont", v as typeof t.headingFont)} options={fontOptions} />
      <SelectInput label="Body font" value={t.bodyFont} onChange={(v) => set("bodyFont", v as typeof t.bodyFont)} options={fontOptions} />
      <SelectInput label="Devanagari (Hindi, Marathi…) font" value={t.devanagariFont} onChange={(v) => set("devanagariFont", v as typeof t.devanagariFont)} options={DEVANAGARI_FONT_KEYS.map((k) => ({ value: k, label: FONTS[k].label }))} hint="Used automatically for Devanagari characters in any text." />
      <p className="text-[11px] text-gray-500">All fonts are self-hosted and openly licensed (SIL OFL) — no external font services.</p>
      <NumberInput label="Body text size" value={t.baseSize} onChange={(v) => set("baseSize", v)} min={14} max={22} unit="px" />
      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold uppercase tracking-wide text-gray-500">Heading sizes (rem)</legend>
        {(["h1", "h2", "h3", "h4", "h5", "h6"] as const).map((h, i) => (
          <NumberInput key={h} label={h.toUpperCase()} value={t[h]} onChange={(v) => set(h, v)} min={[1.5, 1.25, 1, 0.9, 0.85, 0.8][i]!} max={[5, 4, 3, 2.5, 2, 1.6][i]!} step={0.05} />
        ))}
      </fieldset>
      <SelectInput label="Heading weight" value={String(t.headingWeight)} onChange={(v) => set("headingWeight", Number(v))} options={[400, 500, 600, 700, 800].map((w) => ({ value: String(w), label: String(w) }))} />
      <SelectInput label="Body weight" value={String(t.bodyWeight)} onChange={(v) => set("bodyWeight", Number(v))} options={[300, 400, 500].map((w) => ({ value: String(w), label: String(w) }))} />
      <NumberInput label="Line height" value={t.lineHeight} onChange={(v) => set("lineHeight", v)} min={1.2} max={2.2} step={0.05} />
      <NumberInput label="Heading line height" value={t.headingLineHeight} onChange={(v) => set("headingLineHeight", v)} min={1} max={1.6} step={0.05} />
      <NumberInput label="Letter spacing" value={t.letterSpacing} onChange={(v) => set("letterSpacing", v)} min={-0.05} max={0.2} step={0.01} unit="em" />
      <NumberInput label="Heading letter spacing" value={t.headingLetterSpacing} onChange={(v) => set("headingLetterSpacing", v)} min={-0.05} max={0.2} step={0.01} unit="em" />
      <NumberInput label="Paragraph spacing" value={t.paragraphSpacing} onChange={(v) => set("paragraphSpacing", v)} min={0} max={2.5} step={0.1} unit="em" />
      <SelectInput label="Link underline" value={t.linkUnderline} onChange={(v) => set("linkUnderline", v as typeof t.linkUnderline)} options={[{ value: "always", label: "Always" }, { value: "hover", label: "On hover" }, { value: "none", label: "Never" }]} />
      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold uppercase tracking-wide text-gray-500">Buttons</legend>
        <SelectInput label="Button weight" value={String(t.buttonWeight)} onChange={(v) => set("buttonWeight", Number(v))} options={[400, 500, 600, 700].map((w) => ({ value: String(w), label: String(w) }))} />
        <SelectInput label="Button text" value={t.buttonTransform} onChange={(v) => set("buttonTransform", v as typeof t.buttonTransform)} options={[{ value: "none", label: "Normal" }, { value: "uppercase", label: "UPPERCASE" }]} />
        <NumberInput label="Button letter spacing" value={t.buttonLetterSpacing} onChange={(v) => set("buttonLetterSpacing", v)} min={0} max={0.2} step={0.01} unit="em" />
      </fieldset>
    </div>
  );
}

export function ComponentsEditor({ tokens, onChange }: { tokens: ThemeTokens; onChange: (t: ThemeTokens) => void }) {
  const c = tokens.components;
  const set = <K extends keyof ThemeTokens["components"]>(k: K, v: ThemeTokens["components"][K]) => onChange({ ...tokens, components: { ...c, [k]: v } });
  return (
    <div className="space-y-4">
      <SelectInput label="Button shape" value={c.buttonShape} onChange={(v) => set("buttonShape", v as typeof c.buttonShape)} options={[{ value: "square", label: "Square" }, { value: "rounded", label: "Rounded" }, { value: "pill", label: "Pill" }]} />
      <SelectInput label="Button size" value={c.buttonSize} onChange={(v) => set("buttonSize", v as typeof c.buttonSize)} options={[{ value: "sm", label: "Small" }, { value: "md", label: "Medium" }, { value: "lg", label: "Large" }]} />
      <NumberInput label="Corner radius (cards)" value={c.radius} onChange={(v) => set("radius", v)} min={0} max={32} unit="px" />
      <NumberInput label="Card border width" value={c.cardBorderWidth} onChange={(v) => set("cardBorderWidth", v)} min={0} max={4} unit="px" />
      <SelectInput label="Card shadow" value={c.cardShadow} onChange={(v) => set("cardShadow", v as typeof c.cardShadow)} options={[{ value: "none", label: "None" }, { value: "sm", label: "Subtle" }, { value: "md", label: "Medium" }, { value: "lg", label: "Strong" }]} />
      <NumberInput label="Form field radius" value={c.inputRadius} onChange={(v) => set("inputRadius", v)} min={0} max={24} unit="px" />
      <SelectInput label="Badge shape" value={c.badgeShape} onChange={(v) => set("badgeShape", v as typeof c.badgeShape)} options={[{ value: "square", label: "Square" }, { value: "rounded", label: "Rounded" }, { value: "pill", label: "Pill" }]} />
      <SelectInput label="Section spacing" value={c.sectionSpacing} onChange={(v) => set("sectionSpacing", v as typeof c.sectionSpacing)} options={[{ value: "compact", label: "Compact" }, { value: "normal", label: "Normal" }, { value: "relaxed", label: "Relaxed" }]} />
      <SelectInput label="Content width" value={c.contentWidth} onChange={(v) => set("contentWidth", v as typeof c.contentWidth)} options={[{ value: "narrow", label: "Narrow" }, { value: "normal", label: "Normal" }, { value: "wide", label: "Wide" }]} />
      <SelectInput label="Container alignment" value={c.containerAlign} onChange={(v) => set("containerAlign", v as typeof c.containerAlign)} options={[{ value: "center", label: "Centred" }, { value: "left", label: "Left" }]} />
      <NumberInput label="Image corners" value={c.imageRadius} onChange={(v) => set("imageRadius", v)} min={0} max={32} unit="px" />
      <SelectInput label="Image aspect ratio" value={c.imageAspect} onChange={(v) => set("imageAspect", v as typeof c.imageAspect)} options={["16/9", "4/3", "3/2", "1/1"].map((v) => ({ value: v, label: v.replace("/", ":") }))} />
      <SelectInput label="Grid columns (desktop)" value={String(c.gridColumns)} onChange={(v) => set("gridColumns", Number(v))} options={["2", "3", "4"].map((v) => ({ value: v, label: v }))} />
      <SelectInput label="Icon style" value={c.iconStyle} onChange={(v) => set("iconStyle", v as typeof c.iconStyle)} options={[{ value: "circle", label: "Circle background" }, { value: "square", label: "Square background" }, { value: "outline", label: "Icon only" }]} />
      <SelectInput label="Dividers" value={c.dividerStyle} onChange={(v) => set("dividerStyle", v as typeof c.dividerStyle)} options={[{ value: "line", label: "Line" }, { value: "dotted", label: "Dotted" }, { value: "none", label: "None" }]} />
    </div>
  );
}
