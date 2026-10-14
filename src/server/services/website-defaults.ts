import { defaultSectionProps } from "@/lib/site/sections";

type DefaultSection = { type: string; overrides?: Record<string, unknown> };
type DefaultPage = {
  slug: string;
  title: string;
  kind: "HOME" | "STANDARD" | "LEGAL";
  seoDescription?: string;
  sections: DefaultSection[];
};

const LEGAL_NOTICE =
  "<p><strong>Template notice:</strong> this page contains placeholder text. Replace it with your organisation's own reviewed policy before relying on it.</p>";

export function defaultPages(orgName: string): DefaultPage[] {
  return [
    {
      slug: "home",
      title: "Home",
      kind: "HOME",
      sections: [
        {
          type: "hero",
          overrides: {
            eyebrow: orgName,
            heading: `Welcome to ${orgName}`,
            subheading: "Use the Website Builder to describe your mission and the communities you work with.",
          },
        },
        { type: "about" },
        { type: "focusAreas" },
        { type: "featuredProjects" },
        { type: "latestPosts" },
        { type: "cta" },
      ],
    },
    {
      slug: "about",
      title: "About",
      kind: "STANDARD",
      sections: [
        { type: "hero", overrides: { eyebrow: "About", heading: `About ${orgName}`, subheading: "", primaryButton: { label: "", href: "" }, secondaryButton: { label: "", href: "" }, size: "sm" } },
        { type: "richText", overrides: { content: "<h2>Our story</h2><p>Describe your organisation's history, purpose and values.</p>" } },
      ],
    },
    {
      slug: "csr",
      title: "CSR overview",
      kind: "STANDARD",
      sections: [
        { type: "hero", overrides: { eyebrow: "Corporate social responsibility", heading: "Our CSR approach", subheading: "", primaryButton: { label: "", href: "" }, secondaryButton: { label: "", href: "" }, size: "sm" } },
        { type: "richText", overrides: { content: "<h2>Our commitment</h2><p>Summarise your CSR policy, governance and how projects are selected and monitored.</p>" } },
        { type: "focusAreas" },
        { type: "reports" },
      ],
    },
    {
      slug: "focus-areas",
      title: "Focus areas",
      kind: "STANDARD",
      sections: [
        { type: "hero", overrides: { eyebrow: "", heading: "CSR focus areas", subheading: "", primaryButton: { label: "", href: "" }, secondaryButton: { label: "", href: "" }, size: "sm" } },
        { type: "focusAreas", overrides: { eyebrow: "", heading: "" } },
        { type: "projectGrid", overrides: { heading: "Related projects" } },
      ],
    },
    {
      slug: "gallery",
      title: "Gallery",
      kind: "STANDARD",
      sections: [{ type: "gallery", overrides: { heading: "Gallery" } }],
    },
    {
      slug: "privacy",
      title: "Privacy policy",
      kind: "LEGAL",
      sections: [
        {
          type: "richText",
          overrides: {
            content: `<h1>Privacy policy</h1>${LEGAL_NOTICE}<h2>Information we collect</h2><p>When you use our contact form we store the details you provide (such as your name, email address and message) so that we can respond to your enquiry.</p><h2>How we use information</h2><p>We use enquiry information only to respond to you and to manage our relationship with you.</p><h2>Contact</h2><p>Contact us if you would like to access or delete your information.</p>`,
          },
        },
      ],
    },
    {
      slug: "terms",
      title: "Terms of use",
      kind: "LEGAL",
      sections: [
        {
          type: "richText",
          overrides: {
            content: `<h1>Terms of use</h1>${LEGAL_NOTICE}<p>By using this website you agree to use it lawfully. Content is provided for general information and may change without notice.</p>`,
          },
        },
      ],
    },
  ];
}

export function buildSectionProps(section: DefaultSection) {
  const base = defaultSectionProps(section.type);
  return { ...base, ...(section.overrides ?? {}) };
}

export const DEFAULT_HEADER_NAV: { label: string; system?: string; page?: string; children?: { label: string; page: string }[] }[] = [
  { label: "Home", system: "/" },
  { label: "About", page: "about" },
  {
    label: "CSR",
    page: "csr",
    children: [
      { label: "CSR overview", page: "csr" },
      { label: "Focus areas", page: "focus-areas" },
    ],
  },
  { label: "Projects", system: "/projects" },
  { label: "Blog", system: "/blog" },
  { label: "Reports", system: "/reports" },
  { label: "Contact", system: "/contact" },
];

export const DEFAULT_FOOTER_NAV: { label: string; system?: string; page?: string }[] = [
  { label: "About", page: "about" },
  { label: "Projects", system: "/projects" },
  { label: "Gallery", page: "gallery" },
  { label: "Blog", system: "/blog" },
  { label: "Contact", system: "/contact" },
];
