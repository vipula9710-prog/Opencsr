"use client";

import { getSectionDefinition, SECTION_BACKGROUNDS, sectionStyleSchema, type SectionInstance, type SectionStyle } from "@/lib/site/sections";
import { ColorInput, FieldInput, SelectInput, TextInput, Toggle } from "./fields";

const PADDING = [
  { value: "none", label: "None" },
  { value: "sm", label: "Small" },
  { value: "md", label: "Medium" },
  { value: "lg", label: "Large" },
  { value: "xl", label: "Extra large" },
];

export function SectionInspector({ section, onChange, pages, projects, tab }: { section: SectionInstance; onChange: (props: Record<string, unknown>) => void; pages: { title: string; slug: string; kind: string }[]; projects: { id: string; title: string }[]; tab: "content" | "style" }) {
  const def = getSectionDefinition(section.type);
  if (!def) return <p className="text-sm text-red-700">Unknown section type.</p>;
  const style = sectionStyleSchema.parse(section.props.style ?? {});
  const setStyle = (patch: Partial<SectionStyle>) => onChange({ ...section.props, style: { ...style, ...patch } });

  if (tab === "content") {
    return (
      <div className="space-y-4">
        <p className="text-xs text-gray-500">{def.description}</p>
        {def.fields.map((f) => (
          <FieldInput key={`${section.id}-${f.key}`} field={f} value={section.props[f.key]} ctx={{ pages, projects, editorKey: section.id }} onChange={(v) => onChange({ ...section.props, [f.key]: v })} />
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <SelectInput label="Background" value={style.background} onChange={(v) => setStyle({ background: v as SectionStyle["background"] })} options={SECTION_BACKGROUNDS} hint="Theme colours update automatically when the theme changes." />
      {style.background === "custom" ? (
        <div className="space-y-2 rounded-md border border-gray-200 p-2">
          <ColorInput label="Background colour" value={style.customBg} onChange={(v) => setStyle({ customBg: v })} />
          <ColorInput label="Text colour" value={style.customText} onChange={(v) => setStyle({ customText: v })} />
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <SelectInput label="Space above" value={style.paddingTop} onChange={(v) => setStyle({ paddingTop: v as SectionStyle["paddingTop"] })} options={PADDING} />
        <SelectInput label="Space below" value={style.paddingBottom} onChange={(v) => setStyle({ paddingBottom: v as SectionStyle["paddingBottom"] })} options={PADDING} />
      </div>
      <SelectInput label="Alignment" value={style.align} onChange={(v) => setStyle({ align: v as SectionStyle["align"] })} options={[{ value: "left", label: "Left" }, { value: "center", label: "Centre" }, { value: "right", label: "Right" }]} />
      <SelectInput label="Content width" value={style.width} onChange={(v) => setStyle({ width: v as SectionStyle["width"] })} options={[{ value: "narrow", label: "Narrow" }, { value: "normal", label: "Theme width" }, { value: "wide", label: "Wide" }, { value: "full", label: "Full width" }]} />
      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold text-gray-700">Responsive visibility</legend>
        <Toggle label="Hide on mobile" value={style.hideOnMobile} onChange={(v) => setStyle({ hideOnMobile: v })} />
        <Toggle label="Hide on tablet & desktop" value={style.hideOnDesktop} onChange={(v) => setStyle({ hideOnDesktop: v })} />
      </fieldset>
      <TextInput label="Anchor ID" value={style.anchor} onChange={(v) => setStyle({ anchor: v.toLowerCase().replace(/[^a-z0-9-]/g, "") })} hint="Link to this section with #anchor-id" max={40} />
    </div>
  );
}
