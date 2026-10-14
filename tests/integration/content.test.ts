import { beforeAll, describe, expect, it } from "vitest";
import type { OrgContext } from "@/server/context";
import { prisma } from "@/server/db";
import { changePostStatus, publicPostWhere, publishDueScheduledPosts, savePost } from "@/server/services/blog";
import { issueFormToken, submitEnquiry } from "@/server/services/enquiries";
import { createDocument, getDocument, getPublicDocumentFile, listDocuments, setDocumentStatus } from "@/server/services/documents";
import { authorisePrivateFile } from "@/server/services/media";
import { approveReport, getPublicReport, getReport, saveReport, submitReport, renderReportPdf } from "@/server/services/reports";
import { archiveProject, changeProjectStatus, createProject, getProject, restoreProject } from "@/server/services/projects";
import { updateApprovalRules } from "@/server/services/organisations";
import { decideApproval } from "@/server/services/approvals";
import { makeOrg, member } from "../helpers";

let ctx: OrgContext;
beforeAll(async () => {
  ctx = (await makeOrg()).ctx;
});

const isPublic = async (id: string, now = new Date()) => Boolean(await prisma.blogPost.findFirst({ where: { AND: [publicPostWhere(ctx.organisationId, now), { id }] } }));

describe("blog publishing", () => {
  it("drafts are private; published posts are public; content is sanitised", async () => {
    const p = await savePost(ctx, null, { title: "Hello world", content: "<p>Hi</p><script>x</script>" });
    expect(p.content).toBe("<p>Hi</p>");
    expect(p.slug).toBe("hello-world");
    expect(await isPublic(p.id)).toBe(false);
    await changePostStatus(ctx, p.id, { action: "publish" });
    expect(await isPublic(p.id)).toBe(true);
    await changePostStatus(ctx, p.id, { action: "unpublish" });
    expect(await isPublic(p.id)).toBe(false);
  });

  it("scheduled posts are hidden until due, then published by the job", async () => {
    const p = await savePost(ctx, null, { title: "Later", content: "<p>Soon</p>" });
    const when = new Date(Date.now() + 3600_000);
    await changePostStatus(ctx, p.id, { action: "schedule", scheduledFor: when.toISOString() });
    expect(await isPublic(p.id)).toBe(false);
    await expect(changePostStatus(ctx, p.id, { action: "schedule", scheduledFor: new Date(Date.now() - 1000).toISOString() })).rejects.toMatchObject({ code: "VALIDATION" });
    await publishDueScheduledPosts(new Date(Date.now() + 2 * 3600_000));
    const after = await prisma.blogPost.findUniqueOrThrow({ where: { id: p.id } });
    expect(after.status).toBe("PUBLISHED");
    expect(after.publishedAt?.getTime()).toBe(when.getTime());
  });
});

describe("enquiries", () => {
  const valid = (token: string) => ({ name: "Visitor", email: "v@example.org", category: "General", message: "I would like to know more.", consent: "on", formToken: token });

  it("rejects bots: honeypot, instant submission and missing consent", async () => {
    const token = issueFormToken(ctx.organisationId);
    await expect(submitEnquiry(ctx.organisationId, valid(token), { ip: "1.1.1.1", userAgent: null })).rejects.toMatchObject({ code: "VALIDATION" }); // too fast
    await expect(submitEnquiry(ctx.organisationId, { ...valid(token), consent: undefined }, { ip: "1.1.1.1", userAgent: null })).rejects.toMatchObject({ code: "VALIDATION" });
    const otherOrg = (await makeOrg()).ctx;
    await expect(submitEnquiry(ctx.organisationId, valid(issueFormToken(otherOrg.organisationId)), { ip: "1.1.1.1", userAgent: null })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("stores valid enquiries and notifies staff even without email", async () => {
    const token = issueFormToken(ctx.organisationId);
    await new Promise((r) => setTimeout(r, 2600));
    const e = await submitEnquiry(ctx.organisationId, valid(token), { ip: "2.2.2.2", userAgent: "test" });
    expect(e.status).toBe("NEW");
    expect(e.ipHash).not.toBe("2.2.2.2");
    expect(await prisma.notification.count({ where: { organisationId: ctx.organisationId, type: "enquiry.new" } })).toBeGreaterThan(0);
    await expect(submitEnquiry(ctx.organisationId, { ...valid(token), website: "spam" }, { ip: "2.2.2.2", userAgent: null })).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

describe("documents and private files", () => {
  it("confidential documents are invisible to roles without access", async () => {
    const doc = await createDocument(ctx, { title: "Confidential agreement", category: "AGREEMENT", visibility: "CONFIDENTIAL" }, { filename: "c.pdf", data: Buffer.from("%PDF-1.4 secret") });
    const viewer = await member(ctx.organisationId, "VIEWER");
    await expect(getDocument(viewer, doc.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    const list = await listDocuments(viewer, { page: 1, pageSize: 50, dir: "desc" });
    expect(list.items.some((d) => d.id === doc.id)).toBe(false);
    const full = await getDocument(ctx, doc.id);
    await expect(authorisePrivateFile(viewer, full.versions[0]!.mediaAsset.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const editor = await member(ctx.organisationId, "CONTENT_EDITOR");
    await expect(authorisePrivateFile(editor, full.versions[0]!.mediaAsset.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("public documents are downloadable only after approval", async () => {
    const doc = await createDocument(ctx, { title: "Policy", category: "POLICY", visibility: "PUBLIC" }, { filename: "p.pdf", data: Buffer.from("%PDF-1.4 policy") });
    await expect(getPublicDocumentFile(ctx.organisationId, doc.id)).rejects.toBeTruthy();
    const reviewer = await member(ctx.organisationId, "REVIEWER");
    await setDocumentStatus(reviewer, doc.id, "APPROVED");
    await expect(getPublicDocumentFile(ctx.organisationId, doc.id)).resolves.toBeTruthy();
  });
});

describe("reports", () => {
  it("generates from stored data, freezes on approval, and publishes", async () => {
    const r = await saveReport(ctx, null, { title: "Annual", type: "CSR_ANNUAL", fyStartYear: 2025 });
    const draft = await getReport(ctx, r.id);
    expect(draft.isSnapshot).toBe(false);
    expect(await getPublicReport(ctx.organisationId, r.id)).toBeNull();
    await submitReport(ctx, r.id);
    await approveReport(ctx, r.id, true);
    const published = await getPublicReport(ctx.organisationId, r.id);
    expect(published?.data.organisation.currency).toBe("INR");
    const pdf = await renderReportPdf(ctx, published!.report, published!.data);
    expect(Buffer.from(pdf).subarray(0, 5).toString()).toBe("%PDF-");
  });
});

describe("projects", () => {
  it("tracks status history, archive and restore", async () => {
    const p = await createProject(ctx, { title: "Lifecycle", status: "PLANNED" });
    await changeProjectStatus(ctx, p.id, "ACTIVE", "Kick-off");
    await archiveProject(ctx, p.id);
    await restoreProject(ctx, p.id);
    const full = await getProject(ctx, p.id);
    expect(full.status).toBe("ACTIVE");
    expect(full.statusChanges.map((s) => s.toStatus)).toEqual(["ACTIVE", "ARCHIVED", "ACTIVE", "PLANNED"]);
  });

  it("routes status changes through approval when required", async () => {
    await updateApprovalRules(ctx, { projectStatus: "on" });
    const pm = await member(ctx.organisationId, "PROJECT_MANAGER");
    const p = await createProject(pm, { title: "Needs approval", status: "PLANNED" });
    const r = await changeProjectStatus(pm, p.id, "COMPLETED", null);
    expect(r.pending).toBe(true);
    expect((await getProject(ctx, p.id)).status).toBe("PLANNED");
    const approval = await prisma.approval.findFirstOrThrow({ where: { organisationId: ctx.organisationId, entityId: p.id } });
    await expect(decideApproval(pm, approval.id, "APPROVED")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await decideApproval(ctx, approval.id, "APPROVED");
    expect((await getProject(ctx, p.id)).status).toBe("COMPLETED");
    await updateApprovalRules(ctx, {});
  });

  it("hides internal notes from roles that cannot edit projects", async () => {
    const p = await createProject(ctx, { title: "Notes", notes: "Internal only" });
    const viewer = await member(ctx.organisationId, "VIEWER");
    expect((await getProject(viewer, p.id)).notes).toBeNull();
    expect((await getProject(viewer, p.id)).finance).toBeNull();
  });
});
