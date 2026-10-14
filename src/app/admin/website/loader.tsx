import { notFound } from "next/navigation";
import { requireOrgContext } from "@/server/auth/session";
import { getBuilderState, approvalRules } from "@/server/services/website";
import { loadSectionData, publicPosts, publicProjects } from "@/server/services/public-site";
import { can } from "@/server/context";
import { SECTION_TYPES } from "@/lib/site/sections";
import { WebsiteBuilder } from "@/components/builder/builder";
import type { Panel } from "@/components/builder/types";

/** Loads the persisted draft state and renders the three-panel builder. */
export async function BuilderPage({ panel, pageId, homepage }: { panel: Panel; pageId?: string; homepage?: boolean }) {
  const ctx = await requireOrgContext("website.edit");
  const state = await getBuilderState(ctx);
  if (pageId && !state.pages.some((p) => p.id === pageId)) notFound();
  const home = state.pages.find((p) => p.kind === "HOME");
  const allTypes = SECTION_TYPES.map((type) => ({ id: type, type, hidden: false, props: { mode: "latest" } }));
  const [sectionData, samplePosts, projects] = await Promise.all([
    loadSectionData(ctx.organisation, allTypes, { preview: true, contact: { email: state.siteConfig.footer.contact.email || ctx.organisation.email || "", phone: state.siteConfig.footer.contact.phone || ctx.organisation.phone || "", address: state.siteConfig.footer.contact.address || ctx.organisation.address || "" } }),
    publicPosts(ctx.organisationId, { take: 7 }).then((r) => r.posts),
    publicProjects(ctx.organisationId),
  ]);
  return (
    <WebsiteBuilder
      initialPanel={panel}
      initialPageId={pageId ?? (homepage ? home?.id ?? null : null)}
      templateKey={state.templateKey}
      tokens={state.tokens}
      siteConfig={state.siteConfig}
      pages={state.pages.map((p) => ({ ...p, kind: p.kind, status: p.status }))}
      navigation={state.navigation.map((n) => ({ id: n.id, location: n.location, label: n.label, type: n.type, pageId: n.pageId, systemRoute: n.systemRoute, url: n.url, parentId: n.parentId, openInNewTab: n.openInNewTab, hidden: n.hidden, sortOrder: n.sortOrder }))}
      sectionData={{ ...sectionData, enquiry: { ...sectionData.enquiry, token: "" } }}
      samplePosts={samplePosts}
      projects={projects.map((p) => ({ id: p.id, title: p.title }))}
      canPublish={can(ctx, "website.publish")}
      publishNeedsApproval={Boolean(approvalRules(ctx).websitePublish) && !can(ctx, "approval.review")}
      hasUnpublishedChanges={state.hasUnpublishedChanges}
      publishedVersion={state.publishedVersion}
      isDemo={ctx.organisation.isDemo || ctx.organisation.demoBannerEnabled}
    />
  );
}
