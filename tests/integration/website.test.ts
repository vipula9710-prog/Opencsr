import { beforeAll, describe, expect, it } from "vitest";
import type { OrgContext } from "@/server/context";
import { prisma } from "@/server/db";
import {
  applyTemplate, createPage, discardDrafts, getBuilderState, listThemeVersions, loadPublishedPage, loadPublishedSite, publishWebsite, restorePageRevision, restoreThemeVersion,
  saveNavigation, saveSections, updateThemeDraft, updateSiteConfigDraft,
} from "@/server/services/website";
import { updateApprovalRules } from "@/server/services/organisations";
import { decideApproval, listApprovals, requestApproval } from "@/server/services/approvals";
import { defaultSectionProps } from "@/lib/site/sections";
import { makeOrg, member } from "../helpers";

let ctx: OrgContext;
let homeId: string;

beforeAll(async () => {
  ctx = (await makeOrg("Site Org")).ctx;
  homeId = (await getBuilderState(ctx)).pages.find((p) => p.kind === "HOME")!.id;
});

describe("website builder persistence and publishing", () => {
  it("a new organisation has a working published website", async () => {
    const site = await loadPublishedSite(ctx.organisationId);
    expect(site?.version).toBe(1);
    expect(site?.config.identity.siteName).toBe("Site Org");
    expect(await loadPublishedPage(ctx.organisationId, null)).not.toBeNull();
    expect(await loadPublishedPage(ctx.organisationId, "privacy")).not.toBeNull();
  });

  it("draft edits do not change the live website; publishing does", async () => {
    const state = await getBuilderState(ctx);
    await updateThemeDraft(ctx, { ...state.tokens, colors: { ...state.tokens.colors, primary: "#AA0000" } });
    await updateSiteConfigDraft(ctx, { ...state.siteConfig, identity: { ...state.siteConfig.identity, tagline: "Draft tagline" } });
    await saveSections(ctx, homeId, [{ type: "hero", hidden: false, props: { ...defaultSectionProps("hero"), heading: "Draft heading" } }]);

    let live = await loadPublishedSite(ctx.organisationId);
    expect(live?.tokens.colors.primary).not.toBe("#AA0000");
    expect(live?.config.identity.tagline).not.toBe("Draft tagline");
    let home = await loadPublishedPage(ctx.organisationId, null);
    expect(JSON.stringify(home)).not.toContain("Draft heading");

    const r = await publishWebsite(ctx, "test publish");
    expect(r.version).toBe(2);
    live = await loadPublishedSite(ctx.organisationId);
    expect(live?.tokens.colors.primary).toBe("#AA0000");
    expect(live?.config.identity.tagline).toBe("Draft tagline");
    home = await loadPublishedPage(ctx.organisationId, null);
    expect(home?.sections[0]?.props.heading).toBe("Draft heading");
    expect((await getBuilderState(ctx)).hasUnpublishedChanges).toBe(false);
  });

  it("hidden sections are excluded from the published page", async () => {
    await saveSections(ctx, homeId, [
      { type: "hero", hidden: true, props: { ...defaultSectionProps("hero"), heading: "Hidden" } },
      { type: "cta", hidden: false, props: defaultSectionProps("cta") },
    ]);
    await publishWebsite(ctx);
    const home = await loadPublishedPage(ctx.organisationId, null);
    expect(home?.sections.map((s) => s.type)).toEqual(["cta"]);
  });

  it("validates section props and sanitises rich text", async () => {
    await expect(saveSections(ctx, homeId, [{ type: "evil", hidden: false, props: {} }])).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(saveSections(ctx, homeId, [{ type: "cta", hidden: false, props: { ...defaultSectionProps("cta"), primaryButton: { label: "x", href: "javascript:alert(1)" } } }])).rejects.toMatchObject({ code: "VALIDATION" });
    const saved = await saveSections(ctx, homeId, [{ type: "richText", hidden: false, props: { ...defaultSectionProps("richText"), content: '<p>ok</p><script>alert(1)</script><img src=x onerror="a()">' } }]);
    expect(saved[0]!.props.content).toBe('<p>ok</p><img src="x" loading="lazy" />');
  });

  it("rejects invalid theme tokens", async () => {
    const state = await getBuilderState(ctx);
    await expect(updateThemeDraft(ctx, { ...state.tokens, colors: { ...state.tokens.colors, primary: "url(javascript:x)" } })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("does not allow pages to override reserved routes", async () => {
    for (const slug of ["admin", "api", "blog", "projects"]) {
      await expect(createPage(ctx, { title: "x", slug })).rejects.toMatchObject({ code: "VALIDATION" });
    }
  });

  it("draft pages are not public until published, then appear", async () => {
    const page = await createPage(ctx, { title: "Our approach", slug: "our-approach" });
    expect(await loadPublishedPage(ctx.organisationId, "our-approach")).toBeNull();
    await prisma.page.update({ where: { id: page.id }, data: { status: "PUBLISHED" } });
    await publishWebsite(ctx);
    expect((await loadPublishedPage(ctx.organisationId, "our-approach"))?.title).toBe("Our approach");
  });

  it("restores page revisions into the draft", async () => {
    await saveSections(ctx, homeId, [{ type: "hero", hidden: false, props: { ...defaultSectionProps("hero"), heading: "Version A" } }]);
    await publishWebsite(ctx);
    const revA = await prisma.page.findUniqueOrThrow({ where: { id: homeId } });
    await saveSections(ctx, homeId, [{ type: "hero", hidden: false, props: { ...defaultSectionProps("hero"), heading: "Version B" } }]);
    await publishWebsite(ctx);
    await restorePageRevision(ctx, homeId, revA.publishedRevisionId!);
    expect((await getBuilderState(ctx)).pages.find((p) => p.id === homeId)!.sections[0]!.props.heading).toBe("Version A");
    expect((await loadPublishedPage(ctx.organisationId, null))!.sections[0]!.props.heading).toBe("Version B");
  });

  it("templates back up the previous theme and versions can be rolled back", async () => {
    const before = (await loadPublishedSite(ctx.organisationId))!;
    const { backupVersion } = await applyTemplate(ctx, "professional-blue");
    expect((await getBuilderState(ctx)).tokens.colors.primary).toBe("#1D4ED8");
    const backup = (await listThemeVersions(ctx)).find((v) => v.version === backupVersion)!;
    expect(backup.kind).toBe("BACKUP");
    await publishWebsite(ctx);
    expect((await loadPublishedSite(ctx.organisationId))!.tokens.colors.primary).toBe("#1D4ED8");
    const prev = (await listThemeVersions(ctx)).find((v) => v.version === before.version)!;
    await restoreThemeVersion(ctx, prev.id, { publish: true });
    expect((await loadPublishedSite(ctx.organisationId))!.tokens.colors.primary).toBe(before.tokens.colors.primary);
  });

  it("discard resets drafts to the published state", async () => {
    const state = await getBuilderState(ctx);
    await updateThemeDraft(ctx, { ...state.tokens, colors: { ...state.tokens.colors, accent: "#123456" } });
    await discardDrafts(ctx);
    const after = await getBuilderState(ctx);
    expect(after.tokens.colors.accent).toBe((await loadPublishedSite(ctx.organisationId))!.tokens.colors.accent);
    expect(after.hasUnpublishedChanges).toBe(false);
  });

  it("navigation validates destinations and publishes with the site", async () => {
    await expect(saveNavigation(ctx, "HEADER", [{ label: "Bad", type: "EXTERNAL", url: "javascript:alert(1)" }])).rejects.toMatchObject({ code: "VALIDATION" });
    await saveNavigation(ctx, "HEADER", [{ label: "Projects", type: "SYSTEM", systemRoute: "/projects", children: [{ label: "Blog", type: "SYSTEM", systemRoute: "/blog" }] }]);
    await publishWebsite(ctx);
    const nav = (await loadPublishedSite(ctx.organisationId))!.navigation.filter((n) => n.location === "HEADER");
    expect(nav.map((n) => n.label)).toEqual(["Projects", "Blog"]);
  });

  it("requires approval for publishing when the rule is enabled", async () => {
    await updateApprovalRules(ctx, { websitePublish: "on" });
    const fresh = await member(ctx.organisationId, "CONTENT_EDITOR");
    await expect(publishWebsite(fresh)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const req = await requestApproval(fresh, { type: "WEBSITE_PUBLISH", title: "Publish", payload: {} });
    const versionBefore = (await loadPublishedSite(ctx.organisationId))!.version!;
    const approver = await member(ctx.organisationId, "ORG_ADMIN");
    await decideApproval(approver, req.id, "APPROVED");
    expect((await loadPublishedSite(ctx.organisationId))!.version).toBe(versionBefore + 1);
    expect((await listApprovals(approver, "DECIDED")).find((a) => a.id === req.id)?.status).toBe("APPROVED");
    await updateApprovalRules(ctx, {});
  });
});
