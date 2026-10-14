// Serializable data passed to website section renderers (shared by the public
// site and the builder's live preview).

export type PublicProject = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  status: string;
  location: string | null;
  focusArea: string | null;
  coverUrl: string | null;
  coverAlt: string;
};

export type PublicPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  publishedAt: string | null;
  imageUrl: string | null;
  imageAlt: string;
  authorName: string | null;
  categories: { name: string; slug: string }[];
  readingMinutes: number;
};

export type PublicFocusArea = { id: string; name: string; slug: string; description: string | null; icon: string | null };

export type PublicReportItem = { id: string; title: string; href: string; date: string | null; label: string; description: string | null };

export type PublicIndicator = {
  id: string;
  name: string;
  unit: string;
  value: string;
  periodEnd: string;
  definition: string | null;
};

export type SectionData = {
  organisationId: string;
  projects: PublicProject[];
  posts: PublicPost[];
  focusAreas: PublicFocusArea[];
  reports: PublicReportItem[];
  indicators: PublicIndicator[];
  contact: { email: string; phone: string; address: string };
  enquiry: { categories: string[]; token: string };
  isDemo: boolean;
  preview: boolean;
};

export const EMPTY_SECTION_DATA: SectionData = {
  organisationId: "",
  projects: [],
  posts: [],
  focusAreas: [],
  reports: [],
  indicators: [],
  contact: { email: "", phone: "", address: "" },
  enquiry: { categories: [], token: "" },
  isDemo: false,
  preview: true,
};
