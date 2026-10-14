import type { ThemeTokens } from "@/lib/theme/tokens";
import type { SiteConfig } from "@/lib/site/config";
import type { SectionData, PublicPost } from "@/lib/site/section-data";
import type { SectionInstance } from "@/lib/site/sections";

export type BuilderPage = {
  id: string;
  title: string;
  slug: string;
  kind: "HOME" | "STANDARD" | "LEGAL";
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  seoTitle: string | null;
  seoDescription: string | null;
  hasUnpublishedChanges: boolean;
  sections: SectionInstance[];
};

export type BuilderNavItem = {
  id: string;
  location: "HEADER" | "FOOTER";
  label: string;
  type: "PAGE" | "SYSTEM" | "EXTERNAL";
  pageId: string | null;
  systemRoute: string | null;
  url: string | null;
  parentId: string | null;
  openInNewTab: boolean;
  hidden: boolean;
  sortOrder: number;
};

export type Panel = "pages" | "theme" | "typography" | "components" | "header-footer" | "navigation" | "blog-layout" | "templates";

export type BuilderProps = {
  initialPanel: Panel;
  initialPageId: string | null;
  templateKey: string;
  tokens: ThemeTokens;
  siteConfig: SiteConfig;
  pages: BuilderPage[];
  navigation: BuilderNavItem[];
  sectionData: SectionData;
  samplePosts: PublicPost[];
  projects: { id: string; title: string }[];
  canPublish: boolean;
  publishNeedsApproval: boolean;
  hasUnpublishedChanges: boolean;
  publishedVersion: number | null;
  isDemo: boolean;
};

export type SaveState = "saved" | "dirty" | "saving" | "error";
