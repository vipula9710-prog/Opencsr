"use server";

import { act, str } from "@/server/page";
import type { ActionState } from "@/server/action";
import { formDataToObject } from "@/lib/zod-helpers";
import {
  applyTemplate, archivePage, createPage, discardDrafts, listPageRevisions, publishPage, publishWebsite, restoreArchivedPage, restorePageRevision, restoreThemeVersion, saveNavigation,
  saveSections, setPageLive, unpublishPage, updatePageMeta, updateSiteConfigDraft, updateThemeDraft, approvalRules,
} from "@/server/services/website";
import { requestApproval } from "@/server/services/approvals";
import { can } from "@/server/context";
import { redirect } from "next/navigation";

// Builder actions called programmatically with JSON (not FormData).
export async function saveTokensAction(tokens: unknown): Promise<ActionState> {
  return act((ctx) => updateThemeDraft(ctx, tokens));
}

export async function saveSiteConfigAction(config: unknown): Promise<ActionState> {
  return act((ctx) => updateSiteConfigDraft(ctx, config));
}

export async function saveSectionsAction(pageId: string, sections: unknown): Promise<ActionState> {
  return act((ctx) => saveSections(ctx, pageId, sections));
}

export async function saveNavigationAction(location: "HEADER" | "FOOTER", items: unknown): Promise<ActionState> {
  return act((ctx) => saveNavigation(ctx, location === "FOOTER" ? "FOOTER" : "HEADER", items), "Navigation saved");
}

export async function applyTemplateAction(key: string): Promise<ActionState> {
  return act((ctx) => applyTemplate(ctx, key), "Template applied to the draft. The previous draft was saved as a backup version.");
}

export async function updatePageMetaAction(pageId: string, meta: unknown): Promise<ActionState> {
  return act((ctx) => updatePageMeta(ctx, pageId, meta), "Page settings saved");
}

export async function setPageLiveAction(pageId: string, live: boolean): Promise<ActionState> {
  return act((ctx) => setPageLive(ctx, pageId, live), live ? "This page will go live with the next publish" : "Page unpublished");
}

/** Publish (or request approval when the organisation requires it). */
export async function publishAction(note?: string): Promise<ActionState> {
  return act(async (ctx) => {
    if (approvalRules(ctx).websitePublish && !can(ctx, "approval.review")) {
      await requestApproval(ctx, { type: "WEBSITE_PUBLISH", title: `Publish website changes${note ? `: ${note}` : ""}`, payload: { note: note ?? null } });
      return { pending: true };
    }
    const r = await publishWebsite(ctx, note ?? null);
    return { pending: false, version: r.version };
  });
}

export async function discardAction(): Promise<ActionState> {
  return act((ctx) => discardDrafts(ctx), "Unpublished changes discarded");
}

// FormData-based actions for the management pages.
export async function createPageAction(_: ActionState, fd: FormData): Promise<ActionState> {
  let id = "";
  const res = await act(async (ctx) => {
    id = (await createPage(ctx, formDataToObject(fd))).id;
  });
  if (res.ok) redirect(`/admin/website/pages/${id}`);
  return res;
}

export async function pageStatusAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = str(fd, "id");
  const op = str(fd, "op");
  return act(async (ctx) => {
    if (op === "publish") await publishPage(ctx, id);
    else if (op === "unpublish") await unpublishPage(ctx, id);
    else if (op === "archive") await archivePage(ctx, id);
    else if (op === "restore") await restoreArchivedPage(ctx, id);
  }, "Page updated");
}

export async function restoreRevisionAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return act((ctx) => restorePageRevision(ctx, str(fd, "pageId"), str(fd, "revisionId")), "Revision restored into the draft. Publish to make it live.");
}

export async function listRevisionsAction(pageId: string): Promise<ActionState> {
  return act((ctx) => listPageRevisions(ctx, pageId));
}

export async function restoreVersionAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const publish = str(fd, "publish") === "1";
  return act((ctx) => restoreThemeVersion(ctx, str(fd, "id"), { publish }), publish ? "Rolled back and published" : "Version restored into the draft");
}

export async function publishFormAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const res = await publishAction(str(fd, "note") || undefined);
  if (res.ok) {
    const d = res.data as { pending: boolean; version?: number };
    res.message = d.pending ? "Publishing requires approval — your request was sent to reviewers." : `Published version ${d.version}. The live website has been updated.`;
  }
  return res;
}

export async function discardFormAction(): Promise<ActionState> {
  return discardAction();
}
