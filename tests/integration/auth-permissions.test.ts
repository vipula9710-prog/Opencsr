import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import type { OrgContext } from "@/server/context";
import { authenticate, completePasswordReset, createResetLinkForMember, removeMember, updateMember, addMember } from "@/server/services/users";
import { createProject } from "@/server/services/projects";
import { listBudgetPlans, createBudgetPlan } from "@/server/services/finance";
import { savePost, changePostStatus } from "@/server/services/blog";
import { updateThemeDraft, publishWebsite } from "@/server/services/website";
import { updateOrganisationSettings, runInitialSetup } from "@/server/services/organisations";
import { defaultTokens } from "@/lib/theme/templates";
import { makeOrg, makeUser, member } from "../helpers";

let admin: OrgContext;
beforeAll(async () => {
  admin = (await makeOrg()).ctx;
});

describe("authentication", () => {
  it("accepts correct credentials and rejects wrong ones with a generic message", async () => {
    const { user } = await makeUser({ password: "Correct-Horse-1" });
    await expect(authenticate({ email: user.email, password: "Correct-Horse-1" }, "10.0.0.1")).resolves.toMatchObject({ id: user.id });
    await expect(authenticate({ email: user.email, password: "wrong" }, "10.0.0.1")).rejects.toThrow("Incorrect email or password");
    await expect(authenticate({ email: "nobody@example.org", password: "wrong" }, "10.0.0.1")).rejects.toThrow("Incorrect email or password");
  });

  it("rate limits repeated failures per account", async () => {
    const { user } = await makeUser({ password: "Correct-Horse-1" });
    for (let i = 0; i < 8; i++) await authenticate({ email: user.email, password: "bad" }, "10.0.0.2").catch(() => {});
    await expect(authenticate({ email: user.email, password: "Correct-Horse-1" }, "10.0.0.2")).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });

  it("stores only password hashes", async () => {
    const { user } = await makeUser({ password: "Correct-Horse-1" });
    expect(user.passwordHash).not.toContain("Correct-Horse-1");
    expect(user.passwordHash.startsWith("$2")).toBe(true);
  });

  it("resets passwords with a single-use token and revokes sessions", async () => {
    const { user } = await member(admin.organisationId, "VIEWER").then(async (ctx) => ({ user: ctx.user }));
    const link = await createResetLinkForMember(admin, user.id, "http://localhost:3000");
    const token = new URL(link).searchParams.get("token")!;
    await prisma.session.create({ data: { tokenHash: "x" + user.id, userId: user.id, expiresAt: new Date(Date.now() + 1e6) } });
    await completePasswordReset({ token, password: "Brand-New-Pass-9" });
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
    await expect(completePasswordReset({ token, password: "Another-Pass-9" })).rejects.toThrow(/invalid or has expired/);
    await expect(authenticate({ email: user.email, password: "Brand-New-Pass-9" }, "10.0.0.3")).resolves.toBeTruthy();
  });

  it("initial setup refuses to run once users exist", async () => {
    await expect(runInitialSetup({})).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("role-based permissions on server operations", () => {
  it("content editors cannot read or write finances", async () => {
    const editor = await member(admin.organisationId, "CONTENT_EDITOR");
    await expect(listBudgetPlans(editor)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(createBudgetPlan(editor, { title: "x", fyStartYear: 2030, totalAmount: "1" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("authors can write but not publish", async () => {
    const author = await member(admin.organisationId, "AUTHOR");
    const post = await savePost(author, null, { title: "Author post", content: "<p>Hello</p>" });
    await expect(changePostStatus(author, post.id, { action: "publish" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(updateOrganisationSettings(author, {})).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(updateThemeDraft(author, defaultTokens())).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("authors cannot edit other people's posts", async () => {
    const a1 = await member(admin.organisationId, "AUTHOR");
    const a2 = await member(admin.organisationId, "AUTHOR");
    const post = await savePost(a1, null, { title: "Mine", content: "<p>x</p>" });
    await expect(savePost(a2, post.id, { title: "Yours now", content: "" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("viewers cannot create projects or publish the website", async () => {
    const viewer = await member(admin.organisationId, "VIEWER");
    await expect(createProject(viewer, { title: "x" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(publishWebsite(viewer)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("only administrators manage members and the last admin cannot be removed", async () => {
    const csr = await member(admin.organisationId, "CSR_MANAGER");
    await expect(addMember(csr, { name: "x", email: "x@example.org", role: "VIEWER" }, "http://x")).rejects.toMatchObject({ code: "FORBIDDEN" });
    const org = await makeOrg();
    const m = await prisma.membership.findFirstOrThrow({ where: { organisationId: org.org.id, role: "ORG_ADMIN" } });
    await expect(updateMember(org.ctx, m.id, { role: "VIEWER", isActive: true })).rejects.toThrow(/at least one active administrator/);
    await expect(removeMember(org.ctx, m.id)).rejects.toThrow();
  });

  it("writes audit logs without secrets", async () => {
    const created = await addMember(admin, { name: "New Person", email: `np-${Date.now()}@example.org`, role: "VIEWER", password: "Temp-Password-1" }, "http://x");
    const log = await prisma.auditLog.findFirstOrThrow({ where: { entityId: created.membership.id } });
    expect(JSON.stringify(log)).not.toContain("Temp-Password-1");
    expect(log.actorId).toBe(admin.user.id);
  });
});
