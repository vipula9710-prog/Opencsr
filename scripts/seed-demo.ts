/**
 * Seeds the FICTIONAL demo organisation "GreenFuture Foundation".
 *
 *   npm run seed:demo -- --admin admin@example.org [--reset] [--default-site]
 *
 * All organisation records, people, partners and figures created here are
 * invented for demonstration and are labelled as such. Never run this on a
 * production installation unless you explicitly want demo content; remove it
 * with `npm run demo:remove -- --yes`.
 */
import { loadDotEnv, arg, flag } from "./lib/env";
loadDotEnv();

import { randomBytes } from "node:crypto";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { prisma } from "../src/server/db";
import { buildOrgContext, type OrgContext, type SessionUser } from "../src/server/context";
import { hashPassword } from "../src/server/auth/password";
import { createOrganisation, currentFyStartYear, saveDueDiligenceField, saveFocusArea, updateApprovalRules } from "../src/server/services/organisations";
import { createProject, saveProgramme } from "../src/server/services/projects";
import { savePartner, saveContact, updateVerification, saveAgreement } from "../src/server/services/partners";
import { applyAllocation, createBudgetPlan, saveDisbursement, saveExpenditure, setBudgetPlanStatus } from "../src/server/services/finance";
import { addMeasurement, saveIndicator, verifyMeasurement } from "../src/server/services/impact";
import { saveMilestone, saveTask } from "../src/server/services/tasks";
import { createDocument, setDocumentStatus } from "../src/server/services/documents";
import { approveReport, saveReport, submitReport } from "../src/server/services/reports";
import { changePostStatus, saveCategory, savePost } from "../src/server/services/blog";
import { publicMediaUrl, uploadMedia } from "../src/server/services/media";
import { getBuilderState, publishWebsite, saveSections, updateSiteConfigDraft } from "../src/server/services/website";
import { defaultSectionProps } from "../src/lib/site/sections";
import { placeholderPng } from "./lib/placeholder";

const SLUG = "greenfuture-demo";
const NOTE = "Fictional demonstration record.";

async function demoPdf(title: string, lines: string[]) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  page.drawText("DEMO DOCUMENT - FICTIONAL CONTENT", { x: 50, y: 790, size: 10, font: bold, color: rgb(0.7, 0.4, 0) });
  page.drawText(title, { x: 50, y: 760, size: 18, font: bold });
  let y = 730;
  for (const l of lines) {
    page.drawText(l, { x: 50, y, size: 11, font });
    y -= 18;
  }
  return Buffer.from(await doc.save());
}


async function main() {
  const adminEmail = arg("admin")?.toLowerCase() ?? (await prisma.user.findFirst({ where: { isPlatformAdmin: true }, orderBy: { createdAt: "asc" } }))?.email;
  if (!adminEmail) throw new Error("No administrator found. Run `npm run admin:create -- --email you@example.org` first, or pass --admin <email>.");
  const admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!admin) throw new Error(`User ${adminEmail} not found`);
  const sessionUser: SessionUser = { id: admin.id, email: admin.email, name: admin.name, isPlatformAdmin: true };
  if (!admin.isPlatformAdmin) await prisma.user.update({ where: { id: admin.id }, data: { isPlatformAdmin: true } });

  const existing = await prisma.organisation.findUnique({ where: { slug: SLUG } });
  if (existing) {
    if (!flag("reset")) throw new Error(`Demo organisation already exists. Re-run with --reset to recreate it.`);
    await prisma.$transaction([prisma.documentVersion.deleteMany({ where: { organisationId: existing.id } }), prisma.organisation.delete({ where: { id: existing.id } })]);
    console.log("Removed previous demo organisation.");
  }

  console.log("Creating GreenFuture Foundation (fictional demo organisation)…");
  const org = await createOrganisation(
    sessionUser,
    {
      name: "GreenFuture Foundation",
      slug: SLUG,
      tagline: "Creating a Better Tomorrow",
      description: "GreenFuture Foundation is a fictional organisation used to demonstrate OpenCSR. All records are invented.",
      email: "hello.demo@example.org",
      phone: "+00 0000 000 000 (fictional)",
      address: "1 Example Lane, Demo City (fictional address)",
      currency: "INR",
      financialYearStartMonth: 4,
      timezone: "Asia/Kolkata",
      locale: "en-IN",
      templateKey: "corporate-green",
    },
    { isDemo: true },
  );
  const ctx = (await buildOrgContext(sessionUser, org.id))!;

  // ---------------------------------------------------------------- users
  const people = [
    { name: "Asha Menon (demo)", email: "asha.demo@example.org", role: "CSR_MANAGER" as const },
    { name: "Rohan Desai (demo)", email: "rohan.demo@example.org", role: "FINANCE_MANAGER" as const },
    { name: "Meera Iyer (demo)", email: "meera.demo@example.org", role: "PROJECT_MANAGER" as const },
    { name: "Kabir Shah (demo)", email: "kabir.demo@example.org", role: "CONTENT_EDITOR" as const },
    { name: "Leela Nair (demo)", email: "leela.demo@example.org", role: "REVIEWER" as const },
  ];
  const users: Record<string, string> = {};
  for (const p of people) {
    // Random, undisclosed passwords: demo users cannot sign in unless an admin issues a reset link.
    const u = await prisma.user.upsert({ where: { email: p.email }, create: { email: p.email, name: p.name, passwordHash: await hashPassword(randomBytes(24).toString("hex")) }, update: {} });
    await prisma.membership.create({ data: { userId: u.id, organisationId: org.id, role: p.role } });
    users[p.role] = u.id;
  }
  const reviewerCtx = (await buildOrgContext({ id: users.REVIEWER!, email: "leela.demo@example.org", name: "Leela Nair (demo)", isPlatformAdmin: false }, org.id))!;

  // ---------------------------------------------------------------- taxonomy
  const fa: Record<string, string> = {};
  for (const [i, f] of [
    { name: "Education", icon: "book-open", description: "Learning resources and better classrooms." },
    { name: "Child Welfare", icon: "baby", description: "Health, nutrition and safe spaces for children." },
    { name: "Environment", icon: "trees", description: "Greener neighbourhoods and sustainable practices." },
    { name: "Digital Literacy", icon: "laptop", description: "Computer skills for students and adults." },
  ].entries()) {
    fa[f.name] = (await saveFocusArea(ctx, null, { ...f, sortOrder: i, isPublic: "on" })).id;
  }
  await saveDueDiligenceField(ctx, null, { label: "Registration certificate on file", type: "BOOLEAN", required: "on", sortOrder: 0 });
  await saveDueDiligenceField(ctx, null, { label: "Year established", type: "NUMBER", sortOrder: 1 });
  await saveDueDiligenceField(ctx, null, { label: "Last audited accounts (year)", type: "TEXT", sortOrder: 2, helpText: "e.g. 2024-25" });

  const progEdu = await saveProgramme(ctx, null, { name: "Learning for All", description: "Education and digital literacy programme. (Demo)", focusAreaId: fa.Education, status: "ACTIVE" });
  const progChild = await saveProgramme(ctx, null, { name: "Healthy Communities", description: "Child wellbeing programme. (Demo)", focusAreaId: fa["Child Welfare"], status: "ACTIVE" });
  const progEnv = await saveProgramme(ctx, null, { name: "Green Cities", description: "Environmental sustainability programme. (Demo)", focusAreaId: fa.Environment, status: "ACTIVE" });

  // ---------------------------------------------------------------- partners
  const partners: Record<string, string> = {};
  const partnerSpecs = [
    { key: "edu", name: "Sunrise Learning Trust (Demo)", type: "TRUST", city: "Demo City", status: "VERIFIED" },
    { key: "child", name: "Bright Steps Child Care Society (Demo)", type: "SOCIETY", city: "Example Town", status: "PENDING_REVIEW" },
    { key: "env", name: "Green Roots Community Network (Demo)", type: "NGO", city: "Demo City", status: "VERIFIED" },
    { key: "digital", name: "Digital Bridge Collective (Demo)", type: "NOT_FOR_PROFIT_COMPANY", city: "Sample Nagar", status: "INFORMATION_SUPPLIED" },
  ];
  for (const p of partnerSpecs) {
    const created = await savePartner(ctx, null, {
      name: p.name,
      type: p.type,
      email: `${p.key}.partner.demo@example.org`,
      city: p.city,
      country: "India",
      registrationNumber: `DEMO-${p.key.toUpperCase()}-0001`,
      notes: NOTE,
      dueDiligence: { registration_certificate_on_file: "yes", year_established: "2012", last_audited_accounts_year: "2024-25" },
      nextReviewDate: "2026-12-31",
    });
    partners[p.key] = created.id;
    await saveContact(ctx, created.id, null, { name: `Programme Lead (fictional) — ${p.key}`, designation: "Programme Lead", email: `${p.key}.lead.demo@example.org`, isPrimary: "on" });
    if (p.status === "VERIFIED") {
      const asset = await demoPdf(`${p.name} — due-diligence summary`, ["This fictional summary demonstrates document-based verification.", "No real organisation is described."]);
      await createDocument(ctx, { title: `${p.name} — due-diligence pack (demo)`, category: "DUE_DILIGENCE", visibility: "CONFIDENTIAL", partnerId: created.id }, { filename: "due-diligence-demo.pdf", data: asset });
      await updateVerification(ctx, created.id, { status: "VERIFIED", notes: "Demo review: internal checklist completed (fictional).", nextReviewDate: "2027-03-31" });
    } else if (p.status === "PENDING_REVIEW") {
      await updateVerification(ctx, created.id, { status: "PENDING_REVIEW", notes: "Awaiting reviewer (demo)." });
    }
  }

  // ---------------------------------------------------------------- images
  const image = async (name: string, from: string, to: string, seed: number, alt: string) =>
    uploadMedia(ctx, { filename: `${name}.png`, data: placeholderPng({ from, to, accent: "#C6A15B", seed }), visibility: "PUBLIC", altText: alt, title: `${alt} (illustration)` });
  const imgClass = await image("bright-classrooms", "#176B45", "#103B2B", 11, "Abstract green illustration representing classrooms");
  const imgChild = await image("healthy-childhood", "#C6A15B", "#176B45", 23, "Abstract warm illustration representing child wellbeing");
  const imgGreen = await image("green-neighbourhoods", "#2E8B57", "#0F3D2E", 37, "Abstract illustration representing green neighbourhoods");
  const imgDigital = await image("digital-horizons", "#1D4ED8", "#103B2B", 41, "Abstract illustration representing digital learning");
  const imgHero = await image("hero", "#103B2B", "#176B45", 5, "Abstract green and gold illustration");

  // ---------------------------------------------------------------- projects
  const projectSpecs = [
    { key: "classrooms", title: "Project Bright Classrooms", programme: progEdu.id, area: fa.Education, partner: partners.edu, owner: users.PROJECT_MANAGER, img: imgClass.id, location: "Demo City schools (fictional)", summary: "Learning resources and classroom improvements for primary schools.", start: "2025-06-01", end: "2027-03-31" },
    { key: "childhood", title: "Project Healthy Childhood", programme: progChild.id, area: fa["Child Welfare"], partner: partners.child, owner: users.CSR_MANAGER, img: imgChild.id, location: "Example Town (fictional)", summary: "Child wellbeing activities and community support sessions.", start: "2025-07-15", end: "2027-06-30" },
    { key: "green", title: "Project Green Neighbourhoods", programme: progEnv.id, area: fa.Environment, partner: partners.env, owner: users.PROJECT_MANAGER, img: imgGreen.id, location: "Demo City wards (fictional)", summary: "Community tree planting, waste segregation and green spaces.", start: "2025-04-01", end: "2026-12-31" },
    { key: "digital", title: "Project Digital Horizons", programme: progEdu.id, area: fa["Digital Literacy"], partner: partners.digital, owner: users.CSR_MANAGER, img: imgDigital.id, location: "Sample Nagar community centres (fictional)", summary: "Digital literacy and computer education for students and adults.", start: "2025-09-01", end: "2027-08-31" },
  ];
  const projects: Record<string, string> = {};
  for (const p of projectSpecs) {
    const proj = await createProject(ctx, {
      title: p.title,
      summary: p.summary,
      publicSummary: `${p.summary} (Fictional demo project.)`,
      description: `<p>${p.summary}</p><p><strong>Demo content:</strong> this project is fictional and exists only to demonstrate OpenCSR.</p>`,
      objectives: "1. Define clear, measurable outcomes.\n2. Work with a verified implementation partner.\n3. Report progress transparently.",
      programmeId: p.programme,
      focusAreaId: p.area,
      partnerId: p.partner,
      ownerId: p.owner,
      location: p.location,
      startDate: p.start,
      endDate: p.end,
      status: "ACTIVE",
      risks: "Demo risk: partner capacity during monsoon months.",
      dependencies: "Demo dependency: local authority permissions.",
      notes: NOTE,
      isPublic: "on",
      coverImageId: p.img,
      memberIds: [users.PROJECT_MANAGER!, users.CSR_MANAGER!],
    });
    projects[p.key] = proj.id;
    await saveMilestone(ctx, proj.id, null, { title: "Baseline survey completed", dueDate: "2025-10-31", status: "COMPLETED" });
    await saveMilestone(ctx, proj.id, null, { title: "Mid-term review", dueDate: new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10), status: "IN_PROGRESS" });
    await saveMilestone(ctx, proj.id, null, { title: "Final impact report", dueDate: p.end, status: "PENDING" });
    await saveTask(ctx, null, { title: `Collect quarterly data — ${p.title}`, projectId: proj.id, assigneeId: users.PROJECT_MANAGER, priority: "HIGH", dueDate: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10), status: "TODO" });
    await saveTask(ctx, null, { title: `Partner site visit — ${p.title}`, projectId: proj.id, assigneeId: users.CSR_MANAGER, priority: "MEDIUM", dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10), status: "IN_PROGRESS" });
  }
  await saveAgreement(ctx, partners.edu!, null, { title: "Implementation agreement (demo)", reference: "DEMO/AGR/001", projectId: projects.classrooms, status: "ACTIVE", startDate: "2025-06-01", endDate: "2027-03-31", amount: "1200000.00" });

  // ---------------------------------------------------------------- finance
  const fy = currentFyStartYear(4);
  const plan = await createBudgetPlan(ctx, { title: `CSR budget (demo) FY ${fy}`, fyStartYear: fy, totalAmount: "5000000.00", notes: "Fictional demonstration budget." });
  const allocs: [string, string][] = [["classrooms", "1500000.00"], ["childhood", "1100000.00"], ["green", "900000.00"], ["digital", "1000000.00"]];
  for (const [k, amt] of allocs) await applyAllocation(ctx, { planId: plan.id, allocationId: null, projectId: projects[k], amount: amt, notes: "Demo allocation" });
  await applyAllocation(ctx, { planId: plan.id, allocationId: null, programmeId: progEnv.id, amount: "250000.00", notes: "Programme reserve (demo)" });
  const spend: [string, string, string, string][] = [
    ["classrooms", "Learning kits for 12 classrooms (demo)", "420000.00", "INCURRED"],
    ["classrooms", "Teacher training workshop (demo)", "180000.00", "COMMITTED"],
    ["childhood", "Health camp supplies (demo)", "260000.00", "INCURRED"],
    ["green", "Saplings and tree guards (demo)", "310000.00", "INCURRED"],
    ["digital", "Refurbished laptops (demo)", "450000.00", "COMMITTED"],
    ["digital", "Trainer stipends Q1 (demo)", "120000.00", "INCURRED"],
  ];
  for (const [k, desc, amount, status] of spend) await saveExpenditure(ctx, plan.id, null, { projectId: projects[k], description: desc, amount, status, date: new Date().toISOString().slice(0, 10), paymentReference: `DEMO-${Math.floor(Math.random() * 9000 + 1000)}`, category: "Programme costs" });
  await saveDisbursement(ctx, plan.id, null, { projectId: projects.classrooms, partnerId: partners.edu, amount: "600000.00", status: "DISBURSED", date: new Date().toISOString().slice(0, 10), paymentReference: "DEMO-TRF-001" });
  await saveDisbursement(ctx, plan.id, null, { projectId: projects.green, partnerId: partners.env, amount: "400000.00", status: "SCHEDULED", date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10) });
  await setBudgetPlanStatus(ctx, plan.id, "APPROVED");

  // ---------------------------------------------------------------- impact
  const indicators = [
    { k: "classrooms", name: "Students using new learning kits", unit: "students", baseline: "0", target: "1200", values: ["420", "780"], def: "Students in partner schools who used the kits at least weekly during the period (fictional)." },
    { k: "childhood", name: "Children reached by health camps", unit: "children", baseline: "0", target: "2000", values: ["650", "1100"], def: "Unique children aged 0–14 screened at health camps (fictional)." },
    { k: "green", name: "Trees planted and surviving after 6 months", unit: "trees", baseline: "0", target: "5000", values: ["1800", "3100"], def: "Saplings alive at six-month survival check (fictional)." },
    { k: "digital", name: "Learners completing basic computer course", unit: "learners", baseline: "0", target: "800", values: ["160"], def: "Learners passing the end-of-course practical assessment (fictional)." },
  ];
  for (const i of indicators) {
    const ind = await saveIndicator(ctx, null, { name: i.name, unit: i.unit, baseline: i.baseline, target: i.target, direction: "INCREASE", projectId: projects[i.k], definition: i.def, dataSource: "Partner registers (fictional)", frequency: "Quarterly", isBeneficiaryMetric: "on", isPublic: "on", responsibleId: users.PROJECT_MANAGER, notes: NOTE });
    for (const [j, v] of i.values.entries()) {
      const start = new Date(Date.UTC(2025, 6 + j * 3, 1));
      const end = new Date(Date.UTC(2025, 9 + j * 3, 0));
      const m = await addMeasurement(ctx, ind.id, { periodStart: start.toISOString().slice(0, 10), periodEnd: end.toISOString().slice(0, 10), value: v, dataSource: "Partner registers (fictional)", notes: "Demo measurement" });
      // The first measurements are verified by a different (reviewer) user; the latest stays unverified.
      if (j < i.values.length - 1 || i.values.length === 1) await verifyMeasurement(reviewerCtx, m.id, "VERIFIED", "Demo verification against fictional registers");
    }
  }

  // ---------------------------------------------------------------- documents & reports
  const policyPdf = await demoPdf("GreenFuture Foundation — CSR Policy (demo)", ["This CSR policy is fictional and provided only to demonstrate OpenCSR.", "It must not be relied upon for any purpose."]);
  const policy = await createDocument(ctx, { title: "CSR Policy (demo document)", description: "Fictional policy document for demonstration.", category: "POLICY", visibility: "PUBLIC" }, { filename: "csr-policy-demo.pdf", data: policyPdf });
  await setDocumentStatus(ctx, policy.id, "IN_REVIEW");
  await setDocumentStatus(reviewerCtx, policy.id, "APPROVED");
  const report = await saveReport(ctx, null, { title: `Annual CSR report (demo) FY ${fy}`, type: "CSR_ANNUAL", fyStartYear: fy, summary: "<p>This fictional annual report demonstrates report generation from stored records. All figures are invented.</p>" });
  await submitReport(ctx, report.id);
  await approveReport(reviewerCtx, report.id, true);

  // ---------------------------------------------------------------- blog
  const catNews = await saveCategory(ctx, null, { name: "News" });
  const catStories = await saveCategory(ctx, null, { name: "Field stories" });
  const posts = [
    { title: "Welcome to the GreenFuture Foundation demo", cat: catNews.id, img: imgHero.id, tags: "demo, announcements", body: "<p>This website belongs to a <strong>fictional</strong> organisation and shows what OpenCSR can do: projects, impact reporting, a blog and a fully customisable website.</p><h2>Explore</h2><p>Browse the projects, read the reports or try the contact form.</p>" },
    { title: "Inside Project Bright Classrooms (demo story)", cat: catStories.id, img: imgClass.id, tags: "education", body: "<p>A fictional story about new learning kits in partner schools. Names and figures are invented for demonstration.</p>" },
    { title: "Planting for the future: Green Neighbourhoods update (demo)", cat: catStories.id, img: imgGreen.id, tags: "environment", body: "<p>A fictional update on community tree planting. All details are invented.</p>" },
  ];
  for (const [i, p] of posts.entries()) {
    const post = await savePost(ctx, null, { title: p.title, content: p.body, featuredImageId: p.img, categoryIds: [p.cat], tagNames: p.tags, isFeatured: i === 0 ? "on" : "" });
    await changePostStatus(ctx, post.id, { action: "publish" });
    await prisma.blogPost.update({ where: { id: post.id }, data: { publishedAt: new Date(Date.now() - (posts.length - i) * 5 * 86400000) } });
  }
  const scheduled = await savePost(ctx, null, { title: "Digital Horizons: first graduates (scheduled demo post)", content: "<p>This fictional post is scheduled and will publish automatically.</p>", featuredImageId: imgDigital.id, categoryIds: [catNews.id] });
  await changePostStatus(ctx, scheduled.id, { action: "schedule", scheduledFor: new Date(Date.now() + 3 * 86400000).toISOString() });
  await savePost(ctx, null, { title: "Draft: notes from the mid-term review (demo)", content: "<p>Draft content — not public.</p>" });

  // ---------------------------------------------------------------- enquiries
  await prisma.enquiry.createMany({
    data: [
      { organisationId: org.id, name: "Sample Visitor (fictional)", email: "visitor.demo@example.org", category: "Volunteering", message: "Hello, I would like to volunteer at a tree planting drive. (Demo enquiry)", consent: true },
      { organisationId: org.id, name: "Example Partner (fictional)", email: "partner.demo@example.org", category: "Partnership", message: "We are interested in collaborating on digital literacy. (Demo enquiry)", consent: true, status: "IN_PROGRESS" },
    ],
  });

  // ---------------------------------------------------------------- website
  const state = await getBuilderState(ctx);
  const home = state.pages.find((p) => p.kind === "HOME")!;
  const s = (type: string, overrides: Record<string, unknown> = {}) => ({ type, hidden: false, props: { ...defaultSectionProps(type), ...overrides } });
  await saveSections(ctx, home.id, [
    s("heroImage", {
      eyebrow: "GreenFuture Foundation (fictional demo)",
      heading: "Creating a Better Tomorrow",
      subheading: "We partner with communities on education, child welfare, the environment and digital literacy. This is demonstration content.",
      image: { url: publicMediaUrl(imgHero), alt: imgHero.altText ?? "", mediaId: imgHero.id },
      primaryButton: { label: "Explore our projects", href: "/projects" },
      secondaryButton: { label: "Read our reports", href: "/reports" },
      style: { ...(defaultSectionProps("heroImage").style as object), background: "alt" },
    }),
    s("about", { eyebrow: "About us", heading: "A fictional foundation for a real demo", body: "<p>GreenFuture Foundation does not exist. It shows how an organisation can present its CSR work, publish verified impact and stay transparent with OpenCSR.</p>", button: { label: "Our CSR approach", href: "/csr" } }),
    s("focusAreas", { heading: "Where we focus", intro: "Four focus areas configured in the dashboard." }),
    s("impactMetrics", { heading: "Verified results so far", intro: "Only values verified by a reviewer are shown.", source: "indicators", note: "Demo content — all figures are fictional and shown to demonstrate verified-impact reporting." }),
    s("featuredProjects", { heading: "Featured projects", count: 4 }),
    s("latestPosts", { heading: "Latest stories" }),
    s("reports", { heading: "Reports & documents" }),
    s("cta", { heading: "Work with us", body: "Interested in partnering or volunteering? Get in touch (demo form)." }),
  ]);
  const cfg = state.siteConfig;
  await updateSiteConfigDraft(ctx, {
    ...cfg,
    identity: { ...cfg.identity, siteName: "GreenFuture Foundation", tagline: "Creating a Better Tomorrow", logo: { url: "/demo/greenfuture-logo.svg", alt: "GreenFuture Foundation (fictional) logo", mediaId: null }, favicon: { url: "/demo/greenfuture-mark.svg", alt: "", mediaId: null }, showSiteName: false },
    header: { ...cfg.header, logoHeight: 48, cta: { enabled: true, label: "Get involved", href: "/contact" } },
    footer: {
      ...cfg.footer,
      about: "GreenFuture Foundation is a fictional organisation used to demonstrate OpenCSR. All content is invented.",
      contact: { email: "hello.demo@example.org", phone: "+00 0000 000 000 (fictional)", address: "1 Example Lane, Demo City (fictional)" },
      social: [{ platform: "website", url: "https://example.org" }],
      copyright: `© ${new Date().getFullYear()} GreenFuture Foundation (fictional demo organisation)`,
    },
    pages: { ...cfg.pages, projects: { title: "Our projects", intro: "Fictional demo projects across our four focus areas." } },
  });
  await publishWebsite(ctx, "Demo website");
  await updateApprovalRules(ctx, { websitePublish: "", reportPublish: "", budgetChanges: "on", projectStatus: "", impactVerification: "" });

  const settings = await prisma.siteSettings.findUnique({ where: { id: 1 } });
  if (flag("default-site") || !settings?.defaultOrganisationId) {
    await prisma.siteSettings.upsert({ where: { id: 1 }, create: { id: 1, setupCompletedAt: new Date(), defaultOrganisationId: org.id }, update: { defaultOrganisationId: org.id } });
    console.log("The public website now serves the demo organisation by default.");
  }
  console.log(`Done. Sign in as ${adminEmail} and switch to “GreenFuture Foundation”.`);
  console.log("Remove all demo data at any time with: npm run demo:remove -- --yes");
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? `${err.message}\n${(err as { fieldErrors?: unknown }).fieldErrors ? JSON.stringify((err as { fieldErrors?: unknown }).fieldErrors) : ""}` : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

export type { OrgContext };
