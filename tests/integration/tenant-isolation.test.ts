import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { buildOrgContext, type OrgContext } from "@/server/context";
import { createProject, getProject, listProjects, updateProject, changeProjectStatus } from "@/server/services/projects";
import { getPartner, savePartner } from "@/server/services/partners";
import { createBudgetPlan, getBudgetPlan, saveExpenditure } from "@/server/services/finance";
import { createDocument, getDocument } from "@/server/services/documents";
import { authorisePrivateFile, uploadMedia, deleteMedia } from "@/server/services/media";
import { getEnquiry, updateEnquiry } from "@/server/services/enquiries";
import { getIndicator, saveIndicator } from "@/server/services/impact";
import { saveSections, getBuilderState, restoreThemeVersion } from "@/server/services/website";
import { saveTask } from "@/server/services/tasks";
import { makeOrg, makeUser } from "../helpers";

let a: OrgContext;
let b: OrgContext;
let projectB: string;
let partnerB: string;
let planB: string;
let docB: string;
let mediaB: string;
let enquiryB: string;
let indicatorB: string;

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]);

beforeAll(async () => {
  a = (await makeOrg("Alpha")).ctx;
  b = (await makeOrg("Beta")).ctx;
  projectB = (await createProject(b, { title: "Beta secret project", notes: "internal" })).id;
  partnerB = (await savePartner(b, null, { name: "Beta partner", type: "NGO" })).id;
  planB = (await createBudgetPlan(b, { title: "Beta plan", fyStartYear: 2025, totalAmount: "1000.00" })).id;
  docB = (await createDocument(b, { title: "Beta doc", category: "OTHER", visibility: "INTERNAL" }, { filename: "a.pdf", data: Buffer.from("%PDF-1.4 beta") })).id;
  mediaB = (await uploadMedia(b, { filename: "b.png", data: PNG, visibility: "PRIVATE" })).id;
  enquiryB = (await prisma.enquiry.create({ data: { organisationId: b.organisationId, name: "x", email: "x@example.org", category: "General", message: "hello there", consent: true } })).id;
  indicatorB = (await saveIndicator(b, null, { name: "Beta indicator", unit: "people", direction: "INCREASE" })).id;
});

describe("organisation isolation", () => {
  it("lists only the caller's records", async () => {
    const list = await listProjects(a, { page: 1, pageSize: 50, dir: "desc" });
    expect(list.items.some((p) => p.id === projectB)).toBe(false);
  });

  it("returns not found for another organisation's IDs (no IDOR)", async () => {
    await expect(getProject(a, projectB)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getPartner(a, partnerB)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getBudgetPlan(a, planB)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getDocument(a, docB)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getEnquiry(a, enquiryB)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getIndicator(a, indicatorB)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("blocks writes to another organisation's records", async () => {
    await expect(updateProject(a, projectB, { title: "hijack" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(changeProjectStatus(a, projectB, "ARCHIVED", null)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(savePartner(a, partnerB, { name: "hijack", type: "NGO" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(updateEnquiry(a, enquiryB, { status: "CLOSED" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(saveExpenditure(a, planB, null, { projectId: projectB, description: "x", amount: "1", status: "INCURRED", date: "2025-05-01" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await prisma.project.findUnique({ where: { id: projectB } }))!.title).toBe("Beta secret project");
  });

  it("rejects cross-organisation references in its own records", async () => {
    await expect(createProject(a, { title: "Ref test", partnerId: partnerB })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(saveTask(a, null, { title: "x", projectId: projectB })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(createProject(a, { title: "Cover test", coverImageId: mediaB })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("protects files across organisations", async () => {
    await expect(authorisePrivateFile(a, mediaB)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(deleteMedia(a, mediaB)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(authorisePrivateFile(b, mediaB)).resolves.toBeTruthy();
  });

  it("isolates website drafts, pages and versions", async () => {
    const stateB = await getBuilderState(b);
    const homeB = stateB.pages.find((p) => p.kind === "HOME")!;
    await expect(saveSections(a, homeB.id, [])).rejects.toMatchObject({ code: "NOT_FOUND" });
    const versionB = await prisma.themeVersion.findFirst({ where: { organisationId: b.organisationId } });
    await expect(restoreThemeVersion(a, versionB!.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("does not build a context for organisations the user is not a member of", async () => {
    const { session } = await makeUser();
    expect(await buildOrgContext(session, b.organisationId)).toBeNull();
  });

  it("deactivated memberships lose access", async () => {
    const { user, session } = await makeUser();
    await prisma.membership.create({ data: { userId: user.id, organisationId: a.organisationId, role: "VIEWER", isActive: false } });
    expect(await buildOrgContext(session, a.organisationId)).toBeNull();
  });
});
