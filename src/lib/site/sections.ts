// Section registry for the website builder. Every section type is defined by a
// declarative list of fields; the validation schema, editor form and default
// values are all derived from it. Section props never contain executable code
// or raw CSS — only validated text, sanitised rich text, safe links, image
// references and enumerated layout options.

import { z } from "zod";
import { EMPTY_IMAGE, zButton, zImage } from "./links";
import { zHex } from "../theme/tokens";

export const SECTION_ICONS = [
  "book-open", "graduation-cap", "heart-handshake", "baby", "leaf", "trees", "sprout", "recycle", "droplets",
  "sun", "laptop", "monitor", "users", "home", "stethoscope", "globe", "hand-heart", "award", "target", "lightbulb",
] as const;
export type SectionIcon = (typeof SECTION_ICONS)[number];

type Base = { key: string; label: string; help?: string };
export type FieldDef =
  | (Base & { type: "text"; max?: number; placeholder?: string })
  | (Base & { type: "textarea"; max?: number })
  | (Base & { type: "richtext" })
  | (Base & { type: "image" })
  | (Base & { type: "button" })
  | (Base & { type: "select"; options: { value: string; label: string }[] })
  | (Base & { type: "number"; min: number; max: number; step?: number })
  | (Base & { type: "boolean" })
  | (Base & { type: "icon" })
  | (Base & { type: "projects"; max?: number })
  | (Base & { type: "list"; itemLabel: string; max: number; fields: FieldDef[] });

function fieldSchema(f: FieldDef): z.ZodTypeAny {
  switch (f.type) {
    case "text":
      return z.string().trim().max(f.max ?? 200).default("");
    case "textarea":
      return z.string().trim().max(f.max ?? 1500).default("");
    case "richtext":
      return z.string().max(30000).default("");
    case "image":
      return zImage.default(EMPTY_IMAGE);
    case "button":
      return zButton.default({ label: "", href: "" });
    case "select": {
      const values = f.options.map((o) => o.value) as [string, ...string[]];
      return z.enum(values).default(values[0]);
    }
    case "number":
      return z.coerce.number().min(f.min).max(f.max).default(f.min);
    case "boolean":
      return z.boolean().default(false);
    case "icon":
      return z.enum(SECTION_ICONS).default("leaf");
    case "projects":
      return z.array(z.string().min(1).max(60)).max(f.max ?? 12).default([]);
    case "list":
      return z.array(objectSchema(f.fields)).max(f.max).default([]);
  }
}

function objectSchema(fields: FieldDef[]) {
  return z.object(Object.fromEntries(fields.map((f) => [f.key, fieldSchema(f)])));
}

// ---------------------------------------------------------------------------
// Shared section style options
// ---------------------------------------------------------------------------

export const SECTION_BACKGROUNDS = [
  { value: "default", label: "Page background" },
  { value: "surface", label: "Section background" },
  { value: "alt", label: "Alternate background" },
  { value: "primary", label: "Primary colour" },
  { value: "secondary", label: "Secondary colour" },
  { value: "accent", label: "Accent colour" },
  { value: "custom", label: "Custom colour" },
] as const;

export const sectionStyleSchema = z.object({
  background: z.enum(["default", "surface", "alt", "primary", "secondary", "accent", "custom"]).default("default"),
  customBg: zHex.default("#FFFFFF"),
  customText: zHex.default("#111111"),
  paddingTop: z.enum(["none", "sm", "md", "lg", "xl"]).default("md"),
  paddingBottom: z.enum(["none", "sm", "md", "lg", "xl"]).default("md"),
  align: z.enum(["left", "center", "right"]).default("left"),
  width: z.enum(["narrow", "normal", "wide", "full"]).default("normal"),
  hideOnMobile: z.boolean().default(false),
  hideOnDesktop: z.boolean().default(false),
  anchor: z
    .string()
    .trim()
    .max(40)
    .regex(/^[a-z0-9-]*$/, "Lowercase letters, numbers and hyphens only")
    .default(""),
});
export type SectionStyle = z.infer<typeof sectionStyleSchema>;

// ---------------------------------------------------------------------------
// Section definitions
// ---------------------------------------------------------------------------

export type SectionDefinition = {
  type: string;
  label: string;
  description: string;
  category: "Hero" | "Content" | "CSR" | "Media" | "Engagement";
  fields: FieldDef[];
  defaults: Record<string, unknown>;
  defaultStyle?: Partial<SectionStyle>;
};

const headingFields: FieldDef[] = [
  { key: "eyebrow", label: "Eyebrow (small text above heading)", type: "text", max: 80 },
  { key: "heading", label: "Heading", type: "text", max: 160 },
  { key: "intro", label: "Introduction", type: "textarea", max: 600 },
];

const columnsField: FieldDef = {
  key: "columns",
  label: "Columns (desktop)",
  type: "select",
  options: [
    { value: "theme", label: "Theme default" },
    { value: "2", label: "2" },
    { value: "3", label: "3" },
    { value: "4", label: "4" },
  ],
};

export const SECTION_DEFINITIONS: SectionDefinition[] = [
  {
    type: "hero",
    label: "Hero banner",
    description: "Large heading with supporting text and buttons.",
    category: "Hero",
    fields: [
      { key: "eyebrow", label: "Eyebrow", type: "text", max: 80 },
      { key: "heading", label: "Heading", type: "text", max: 160 },
      { key: "subheading", label: "Supporting text", type: "textarea", max: 400 },
      { key: "primaryButton", label: "Primary button", type: "button" },
      { key: "secondaryButton", label: "Secondary button", type: "button" },
      {
        key: "size",
        label: "Size",
        type: "select",
        options: [
          { value: "md", label: "Medium" },
          { value: "lg", label: "Large" },
          { value: "sm", label: "Compact" },
        ],
      },
    ],
    defaults: {
      eyebrow: "Welcome",
      heading: "Creating lasting change in our communities",
      subheading: "Describe your organisation's mission in one or two sentences.",
      primaryButton: { label: "Our projects", href: "/projects" },
      secondaryButton: { label: "Contact us", href: "/contact" },
      size: "md",
    },
    defaultStyle: { background: "alt", align: "center", paddingTop: "lg", paddingBottom: "lg" },
  },
  {
    type: "heroImage",
    label: "Hero with image",
    description: "Heading and buttons beside a large image.",
    category: "Hero",
    fields: [
      { key: "eyebrow", label: "Eyebrow", type: "text", max: 80 },
      { key: "heading", label: "Heading", type: "text", max: 160 },
      { key: "subheading", label: "Supporting text", type: "textarea", max: 400 },
      { key: "image", label: "Image", type: "image" },
      {
        key: "imagePosition",
        label: "Image position",
        type: "select",
        options: [
          { value: "right", label: "Right" },
          { value: "left", label: "Left" },
        ],
      },
      { key: "primaryButton", label: "Primary button", type: "button" },
      { key: "secondaryButton", label: "Secondary button", type: "button" },
    ],
    defaults: {
      eyebrow: "",
      heading: "Working together for a better tomorrow",
      subheading: "Introduce your CSR work with a short summary.",
      image: EMPTY_IMAGE,
      imagePosition: "right",
      primaryButton: { label: "Learn more", href: "/about" },
      secondaryButton: { label: "", href: "" },
    },
    defaultStyle: { paddingTop: "lg", paddingBottom: "lg" },
  },
  {
    type: "heroBackground",
    label: "Hero with background image",
    description: "Text on top of a full-width background image with an overlay.",
    category: "Hero",
    fields: [
      { key: "eyebrow", label: "Eyebrow", type: "text", max: 80 },
      { key: "heading", label: "Heading", type: "text", max: 160 },
      { key: "subheading", label: "Supporting text", type: "textarea", max: 400 },
      { key: "image", label: "Background image", type: "image" },
      { key: "overlay", label: "Overlay darkness (%)", type: "number", min: 0, max: 90, step: 5 },
      {
        key: "height",
        label: "Height",
        type: "select",
        options: [
          { value: "md", label: "Medium" },
          { value: "lg", label: "Large" },
          { value: "screen", label: "Full screen" },
        ],
      },
      { key: "primaryButton", label: "Primary button", type: "button" },
      { key: "secondaryButton", label: "Secondary button", type: "button" },
    ],
    defaults: {
      eyebrow: "",
      heading: "Building stronger communities",
      subheading: "",
      image: EMPTY_IMAGE,
      overlay: 55,
      height: "lg",
      primaryButton: { label: "Explore our work", href: "/projects" },
      secondaryButton: { label: "", href: "" },
    },
    defaultStyle: { align: "center", width: "full", paddingTop: "none", paddingBottom: "none" },
  },
  {
    type: "about",
    label: "Introduction / about",
    description: "Heading and rich text with an optional image.",
    category: "Content",
    fields: [
      ...headingFields.slice(0, 2),
      { key: "body", label: "Text", type: "richtext" },
      { key: "image", label: "Image (optional)", type: "image" },
      {
        key: "imagePosition",
        label: "Image position",
        type: "select",
        options: [
          { value: "right", label: "Right" },
          { value: "left", label: "Left" },
        ],
      },
      { key: "button", label: "Button", type: "button" },
    ],
    defaults: {
      eyebrow: "About us",
      heading: "Who we are",
      body: "<p>Tell visitors about your organisation, its values and its approach to social responsibility.</p>",
      image: EMPTY_IMAGE,
      imagePosition: "right",
      button: { label: "", href: "" },
    },
  },
  {
    type: "focusAreas",
    label: "CSR focus areas",
    description: "Cards for your focus areas — from your configured focus areas or custom items.",
    category: "CSR",
    fields: [
      ...headingFields,
      {
        key: "source",
        label: "Content source",
        type: "select",
        options: [
          { value: "database", label: "Focus areas from CSR settings" },
          { value: "custom", label: "Custom items below" },
        ],
      },
      columnsField,
      {
        key: "items",
        label: "Custom items",
        type: "list",
        itemLabel: "Item",
        max: 12,
        fields: [
          { key: "icon", label: "Icon", type: "icon" },
          { key: "title", label: "Title", type: "text", max: 80 },
          { key: "description", label: "Description", type: "textarea", max: 400 },
          { key: "link", label: "Link (optional)", type: "button" },
        ],
      },
    ],
    defaults: {
      eyebrow: "What we focus on",
      heading: "Our focus areas",
      intro: "",
      source: "database",
      columns: "theme",
      items: [],
    },
    defaultStyle: { background: "alt", align: "center" },
  },
  {
    type: "featuredProjects",
    label: "Featured projects",
    description: "Highlight selected published projects.",
    category: "CSR",
    fields: [
      ...headingFields,
      {
        key: "mode",
        label: "Projects to show",
        type: "select",
        options: [
          { value: "latest", label: "Most recently updated" },
          { value: "manual", label: "Choose projects" },
        ],
      },
      { key: "projectIds", label: "Chosen projects", type: "projects", max: 6 },
      { key: "count", label: "Number of projects", type: "number", min: 1, max: 6 },
      { key: "showStatus", label: "Show project status", type: "boolean" },
      { key: "button", label: "Button below projects", type: "button" },
    ],
    defaults: {
      eyebrow: "Our work",
      heading: "Featured projects",
      intro: "",
      mode: "latest",
      projectIds: [],
      count: 3,
      showStatus: true,
      button: { label: "View all projects", href: "/projects" },
    },
  },
  {
    type: "projectGrid",
    label: "Project grid",
    description: "A grid of all published projects.",
    category: "CSR",
    fields: [
      ...headingFields,
      { key: "count", label: "Maximum projects", type: "number", min: 1, max: 24 },
      columnsField,
      { key: "showSummary", label: "Show summaries", type: "boolean" },
    ],
    defaults: { eyebrow: "", heading: "Projects", intro: "", count: 9, columns: "theme", showSummary: true },
  },
  {
    type: "impactMetrics",
    label: "Impact metrics",
    description: "Key figures, either entered here or taken from public impact indicators.",
    category: "CSR",
    fields: [
      ...headingFields,
      {
        key: "source",
        label: "Content source",
        type: "select",
        options: [
          { value: "manual", label: "Figures entered below" },
          { value: "indicators", label: "Public impact indicators (latest verified values)" },
        ],
      },
      {
        key: "items",
        label: "Figures",
        type: "list",
        itemLabel: "Figure",
        max: 8,
        fields: [
          { key: "value", label: "Value", type: "text", max: 40 },
          { key: "label", label: "Label", type: "text", max: 80 },
          { key: "description", label: "Definition / period", type: "text", max: 200 },
        ],
      },
      { key: "note", label: "Footnote (e.g. measurement period or source)", type: "textarea", max: 400 },
    ],
    defaults: {
      eyebrow: "Our impact",
      heading: "Impact at a glance",
      intro: "",
      source: "manual",
      items: [],
      note: "",
    },
    defaultStyle: { background: "primary", align: "center" },
  },
  {
    type: "latestPosts",
    label: "Latest blog posts",
    description: "The most recent published articles.",
    category: "Content",
    fields: [
      ...headingFields,
      { key: "count", label: "Number of posts", type: "number", min: 1, max: 9 },
      {
        key: "layout",
        label: "Layout",
        type: "select",
        options: [
          { value: "grid", label: "Grid" },
          { value: "list", label: "List" },
        ],
      },
      { key: "button", label: "Button", type: "button" },
    ],
    defaults: {
      eyebrow: "News",
      heading: "Latest stories",
      intro: "",
      count: 3,
      layout: "grid",
      button: { label: "Read the blog", href: "/blog" },
    },
  },
  {
    type: "reports",
    label: "Reports & documents",
    description: "Published reports and public documents.",
    category: "CSR",
    fields: [...headingFields, { key: "count", label: "Number of items", type: "number", min: 1, max: 12 }, { key: "button", label: "Button", type: "button" }],
    defaults: {
      eyebrow: "Transparency",
      heading: "Reports & documents",
      intro: "",
      count: 4,
      button: { label: "All reports", href: "/reports" },
    },
    defaultStyle: { background: "alt" },
  },
  {
    type: "gallery",
    label: "Image gallery",
    description: "A responsive grid of images with captions.",
    category: "Media",
    fields: [
      ...headingFields,
      columnsField,
      {
        key: "images",
        label: "Images",
        type: "list",
        itemLabel: "Image",
        max: 24,
        fields: [
          { key: "image", label: "Image", type: "image" },
          { key: "caption", label: "Caption", type: "text", max: 200 },
        ],
      },
    ],
    defaults: { eyebrow: "", heading: "Gallery", intro: "", columns: "theme", images: [] },
  },
  {
    type: "initiatives",
    label: "Community initiatives",
    description: "Cards describing initiatives, each with an optional image and link.",
    category: "CSR",
    fields: [
      ...headingFields,
      columnsField,
      {
        key: "items",
        label: "Initiatives",
        type: "list",
        itemLabel: "Initiative",
        max: 12,
        fields: [
          { key: "image", label: "Image", type: "image" },
          { key: "title", label: "Title", type: "text", max: 100 },
          { key: "description", label: "Description", type: "textarea", max: 500 },
          { key: "link", label: "Link", type: "button" },
        ],
      },
    ],
    defaults: { eyebrow: "", heading: "Community initiatives", intro: "", columns: "theme", items: [] },
  },
  {
    type: "cta",
    label: "Call to action",
    description: "A prominent banner encouraging visitors to take action.",
    category: "Engagement",
    fields: [
      { key: "heading", label: "Heading", type: "text", max: 160 },
      { key: "body", label: "Text", type: "textarea", max: 500 },
      { key: "primaryButton", label: "Primary button", type: "button" },
      { key: "secondaryButton", label: "Secondary button", type: "button" },
    ],
    defaults: {
      heading: "Partner with us",
      body: "Get in touch to learn how we can work together.",
      primaryButton: { label: "Contact us", href: "/contact" },
      secondaryButton: { label: "", href: "" },
    },
    defaultStyle: { background: "secondary", align: "center" },
  },
  {
    type: "contact",
    label: "Contact section",
    description: "Contact details and the enquiry form.",
    category: "Engagement",
    fields: [
      ...headingFields,
      { key: "showForm", label: "Show enquiry form", type: "boolean" },
      { key: "showDetails", label: "Show contact details", type: "boolean" },
    ],
    defaults: { eyebrow: "", heading: "Get in touch", intro: "", showForm: true, showDetails: true },
  },
  {
    type: "richText",
    label: "Rich text",
    description: "Free-form formatted text.",
    category: "Content",
    fields: [{ key: "content", label: "Content", type: "richtext" }],
    defaults: { content: "<h2>Heading</h2><p>Write your content here.</p>" },
    defaultStyle: { width: "narrow" },
  },
  {
    type: "imageText",
    label: "Image and text",
    description: "A split layout with an image beside text.",
    category: "Content",
    fields: [
      ...headingFields.slice(0, 2),
      { key: "body", label: "Text", type: "richtext" },
      { key: "image", label: "Image", type: "image" },
      {
        key: "imagePosition",
        label: "Image position",
        type: "select",
        options: [
          { value: "left", label: "Left" },
          { value: "right", label: "Right" },
        ],
      },
      { key: "button", label: "Button", type: "button" },
    ],
    defaults: {
      eyebrow: "",
      heading: "Heading",
      body: "<p>Describe this topic.</p>",
      image: EMPTY_IMAGE,
      imagePosition: "left",
      button: { label: "", href: "" },
    },
  },
];

export const SECTION_TYPES = SECTION_DEFINITIONS.map((d) => d.type);

const schemaCache = new Map<string, z.ZodTypeAny>();

export function getSectionDefinition(type: string): SectionDefinition | undefined {
  return SECTION_DEFINITIONS.find((d) => d.type === type);
}

export function sectionPropsSchema(type: string) {
  const def = getSectionDefinition(type);
  if (!def) return null;
  if (!schemaCache.has(type)) {
    schemaCache.set(type, objectSchema(def.fields).extend({ style: sectionStyleSchema.default({}) }));
  }
  return schemaCache.get(type)!;
}

export function defaultSectionProps(type: string): Record<string, unknown> {
  const def = getSectionDefinition(type);
  if (!def) throw new Error(`Unknown section type: ${type}`);
  const schema = sectionPropsSchema(type)!;
  return schema.parse({ ...structuredClone(def.defaults), style: { ...def.defaultStyle } }) as Record<string, unknown>;
}

export type SectionValidation =
  | { ok: true; props: Record<string, unknown> }
  | { ok: false; errors: Record<string, string[]> };

export function validateSectionProps(type: string, props: unknown): SectionValidation {
  const schema = sectionPropsSchema(type);
  if (!schema) return { ok: false, errors: { type: [`Unknown section type: ${type}`] } };
  const result = schema.safeParse(props);
  if (!result.success) {
    const errors: Record<string, string[]> = {};
    for (const issue of result.error.issues) (errors[issue.path.join(".") || "_"] ??= []).push(issue.message);
    return { ok: false, errors };
  }
  return { ok: true, props: result.data as Record<string, unknown> };
}

/** Apply a transformation to every rich-text field (used for server-side sanitisation). */
export function mapRichText(
  type: string,
  props: Record<string, unknown>,
  fn: (html: string) => string,
): Record<string, unknown> {
  const def = getSectionDefinition(type);
  if (!def) return props;
  const walk = (fields: FieldDef[], obj: Record<string, unknown>): Record<string, unknown> => {
    const out = { ...obj };
    for (const f of fields) {
      if (f.type === "richtext" && typeof out[f.key] === "string") out[f.key] = fn(out[f.key] as string);
      if (f.type === "list" && Array.isArray(out[f.key])) {
        out[f.key] = (out[f.key] as Record<string, unknown>[]).map((item) => walk(f.fields, item));
      }
    }
    return out;
  };
  return walk(def.fields, props);
}

export type SectionInstance = {
  id: string;
  type: string;
  hidden: boolean;
  props: Record<string, unknown>;
};
