import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { actorOf, assertCan, ensureOwned, type OrgContext, type SessionUser } from "../context";
import { audit } from "../audit";
import { ConflictError, ForbiddenError, ValidationError } from "../errors";
import { parseInput } from "../validation";
import { hashPassword, passwordProblems } from "../auth/password";
import { invalidateSite } from "../cache";
import { zCheckbox, zEmail, zOptEmail, zOptText, zOptUrl, zSlug, zText } from "@/lib/zod-helpers";
import { slugify } from "@/lib/utils";
import { bootstrapWebsite } from "./website";
import { THEME_TEMPLATES } from "@/lib/theme/templates";
import { HEX, type ThemeTokens } from "@/lib/theme/tokens";
import { getTemplate, DEFAULT_TEMPLATE_KEY } from "@/lib/theme/templates";

export const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AUD", "CAD", "SGD", "ZAR", "KES", "NGN", "BDT", "LKR", "NPR", "AED"] as const;

const orgFields = {
  name: zText(120),
  slug: zSlug,
  tagline: zOptText(200),
  description: zOptText(2000),
  email: zOptEmail,
  phone: zOptText(60),
  address: zOptText(400),
  websiteUrl: zOptUrl,
  currency: z.enum(CURRENCIES),
  financialYearStartMonth: z.coerce.number().int().min(1).max(12),
  timezone: z.string().trim().min(1).max(60).default("Asia/Kolkata"),
  locale: z.string().trim().min(2).max(20).default("en-IN"),
};

const brandFields = {
  templateKey: z.enum(THEME_TEMPLATES.map((t) => t.key) as [string, ...string[]]).default(DEFAULT_TEMPLATE_KEY),
  primaryColor: z.string().regex(HEX).optional().or(z.literal("")),
  accentColor: z.string().regex(HEX).optional().or(z.literal("")),
};

export const createOrganisationSchema = z.object({ ...orgFields, ...brandFields });

function tokensFor(templateKey: string, primary?: string, accent?: string): ThemeTokens {
  const tokens = structuredClone(getTemplate(templateKey)?.tokens ?? getTemplate(DEFAULT_TEMPLATE_KEY)!.tokens);
  if (primary) {
    tokens.colors.primary = primary;
    tokens.colors.buttonBg = primary;
    tokens.colors.link = primary;
  }
  if (accent) tokens.colors.accent = accent;
  return tokens;
}

async function createOrgRecords(
  data: z.infer<typeof createOrganisationSchema>,
  creatorId: string,
  opts: { isDemo?: boolean } = {},
) {
  try {
    return await prisma.$transaction(
      async (tx) => {
        const org = await tx.organisation.create({
          data: {
            name: data.name,
            slug: data.slug,
            tagline: data.tagline,
            description: data.description,
            email: data.email,
            phone: data.phone,
            address: data.address,
            websiteUrl: data.websiteUrl,
            currency: data.currency,
            financialYearStartMonth: data.financialYearStartMonth,
            timezone: data.timezone,
            locale: data.locale,
            isDemo: opts.isDemo ?? false,
            demoBannerEnabled: opts.isDemo ?? false,
          },
        });
        await tx.membership.create({ data: { userId: creatorId, organisationId: org.id, role: "ORG_ADMIN" } });
        await bootstrapWebsite(tx, org, {
          templateKey: data.templateKey,
          actorId: creatorId,
          tokens: tokensFor(data.templateKey, data.primaryColor || undefined, data.accentColor || undefined),
        });
        await tx.auditLog.create({
          data: { organisationId: org.id, actorId: creatorId, action: "organisation.create", entityType: "Organisation", entityId: org.id, summary: `Created organisation ${org.name}` },
        });
        return org;
      },
      { timeout: 30000 },
    );
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") throw new ConflictError("This organisation address (slug) is already in use", { slug: ["Already in use"] });
    throw err;
  }
}

/** Platform administrators can create additional organisations. */
export async function createOrganisation(user: SessionUser, input: unknown, opts: { isDemo?: boolean } = {}) {
  if (!user.isPlatformAdmin) throw new ForbiddenError("Only platform administrators can create organisations");
  const data = parseInput(createOrganisationSchema, input);
  return createOrgRecords(data, user.id, opts);
}

export async function isSetupComplete() {
  const settings = await prisma.siteSettings.findUnique({ where: { id: 1 } });
  if (settings?.setupCompletedAt) return true;
  return (await prisma.user.count()) > 0;
}

const setupSchema = createOrganisationSchema.extend({
  adminName: zText(120),
  adminEmail: zEmail,
  adminPassword: z.string().min(1, "Required").max(200),
});

/**
 * First-run setup wizard: creates the first platform administrator and the
 * first organisation. Refuses to run once any user exists.
 */
export async function runInitialSetup(input: unknown) {
  if (await isSetupComplete()) throw new ForbiddenError("Setup has already been completed");
  const data = parseInput(setupSchema, input);
  const problems = passwordProblems(data.adminPassword);
  if (problems.length) throw new ValidationError("Choose a stronger password", { adminPassword: problems });
  const user = await prisma.user.create({
    data: { email: data.adminEmail, name: data.adminName, passwordHash: await hashPassword(data.adminPassword), isPlatformAdmin: true },
  });
  try {
    const org = await createOrgRecords(data, user.id);
    await prisma.siteSettings.upsert({
      where: { id: 1 },
      create: { id: 1, setupCompletedAt: new Date(), defaultOrganisationId: org.id },
      update: { setupCompletedAt: new Date(), defaultOrganisationId: org.id },
    });
    return { user, org };
  } catch (err) {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Organisation settings
// ---------------------------------------------------------------------------

const settingsSchema = z.object({
  ...orgFields,
  slug: zSlug,
  enquiryCategories: z
    .string()
    .max(1000)
    .transform((v) =>
      v
        .split(/\r?\n|,/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 15),
    ),
});

export async function updateOrganisationSettings(ctx: OrgContext, input: unknown) {
  assertCan(ctx, "org.settings.manage");
  const data = parseInput(settingsSchema, input);
  if (data.enquiryCategories.length === 0) data.enquiryCategories = ["General"];
  try {
    const updated = await prisma.organisation.update({ where: { id: ctx.organisationId }, data });
    await audit(actorOf(ctx), { action: "organisation.update", entityType: "Organisation", entityId: ctx.organisationId, summary: "Updated organisation settings" });
    invalidateSite(ctx.organisationId);
    return updated;
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") throw new ConflictError("This slug is already in use", { slug: ["Already in use"] });
    throw err;
  }
}

export async function updateBranding(ctx: OrgContext, input: { logoId?: string | null; faviconId?: string | null }) {
  assertCan(ctx, "org.settings.manage");
  for (const id of [input.logoId, input.faviconId]) {
    if (id) {
      const asset = await prisma.mediaAsset.findFirst({ where: { id, organisationId: ctx.organisationId, visibility: "PUBLIC", mimeType: { startsWith: "image/" } } });
      if (!asset) throw new ValidationError("Choose a public image from this organisation's media library");
    }
  }
  await prisma.organisation.update({ where: { id: ctx.organisationId }, data: { logoId: input.logoId ?? null, faviconId: input.faviconId ?? null } });
  await audit(actorOf(ctx), { action: "organisation.branding", entityType: "Organisation", entityId: ctx.organisationId, summary: "Updated organisation logo/favicon" });
}

const approvalRulesSchema = z.object({
  websitePublish: zCheckbox,
  reportPublish: zCheckbox,
  budgetChanges: zCheckbox,
  projectStatus: zCheckbox,
  impactVerification: zCheckbox,
});

export async function updateApprovalRules(ctx: OrgContext, input: unknown) {
  assertCan(ctx, "org.settings.manage");
  const rules = parseInput(approvalRulesSchema, input);
  await prisma.organisation.update({ where: { id: ctx.organisationId }, data: { approvalRules: rules as Prisma.InputJsonValue } });
  await audit(actorOf(ctx), { action: "organisation.approval_rules", entityType: "Organisation", entityId: ctx.organisationId, summary: "Updated approval rules", metadata: rules });
}

export async function setDemoMode(ctx: OrgContext, enabled: boolean) {
  assertCan(ctx, "org.settings.manage");
  await prisma.organisation.update({ where: { id: ctx.organisationId }, data: { demoBannerEnabled: enabled, ...(enabled ? {} : { isDemo: false }) } });
  await audit(actorOf(ctx), { action: "organisation.demo_mode", entityType: "Organisation", entityId: ctx.organisationId, summary: `Demo mode ${enabled ? "enabled" : "disabled"}` });
  invalidateSite(ctx.organisationId);
}

// ---------------------------------------------------------------------------
// Focus areas (configurable taxonomy)
// ---------------------------------------------------------------------------

const focusAreaSchema = z.object({
  name: zText(80),
  slug: zSlug.optional().or(z.literal("")),
  description: zOptText(600),
  icon: z.string().max(40).optional(),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  isPublic: zCheckbox,
});

export async function listFocusAreas(ctx: OrgContext) {
  assertCan(ctx, "programme.read");
  return prisma.focusArea.findMany({
    where: { organisationId: ctx.organisationId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { projects: true, programmes: true } } },
  });
}

export async function saveFocusArea(ctx: OrgContext, id: string | null, input: unknown) {
  assertCan(ctx, "programme.write");
  const data = parseInput(focusAreaSchema, input);
  const slug = data.slug || slugify(data.name);
  try {
    if (id) {
      ensureOwned(ctx, await prisma.focusArea.findUnique({ where: { id } }), "Focus area");
      return await prisma.focusArea.update({ where: { id }, data: { ...data, slug } });
    }
    const fa = await prisma.focusArea.create({ data: { ...data, slug, organisationId: ctx.organisationId } });
    await audit(actorOf(ctx), { action: "focus_area.create", entityType: "FocusArea", entityId: fa.id, summary: `Created focus area ${fa.name}` });
    return fa;
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") throw new ConflictError("A focus area with this slug exists", { slug: ["Already in use"] });
    throw err;
  }
}

export async function deleteFocusArea(ctx: OrgContext, id: string) {
  assertCan(ctx, "programme.write");
  const fa = ensureOwned(ctx, await prisma.focusArea.findUnique({ where: { id } }), "Focus area");
  await prisma.focusArea.delete({ where: { id: fa.id } });
  await audit(actorOf(ctx), { action: "focus_area.delete", entityType: "FocusArea", entityId: fa.id, summary: `Deleted focus area ${fa.name}` });
}

// ---------------------------------------------------------------------------
// Configurable due-diligence fields
// ---------------------------------------------------------------------------

const ddFieldSchema = z.object({
  label: zText(120),
  key: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9_]{0,39}$/, "Lowercase letters, numbers and underscores; start with a letter")
    .optional()
    .or(z.literal("")),
  type: z.enum(["TEXT", "NUMBER", "DATE", "BOOLEAN"]),
  required: zCheckbox,
  helpText: zOptText(300),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});

export async function listDueDiligenceFields(ctx: OrgContext) {
  assertCan(ctx, "partner.read");
  return prisma.dueDiligenceField.findMany({ where: { organisationId: ctx.organisationId }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }] });
}

export async function saveDueDiligenceField(ctx: OrgContext, id: string | null, input: unknown) {
  assertCan(ctx, "org.settings.manage");
  const data = parseInput(ddFieldSchema, input);
  const key = data.key || slugify(data.label).replace(/-/g, "_").replace(/^[^a-z]+/, "f_").slice(0, 40);
  try {
    if (id) {
      ensureOwned(ctx, await prisma.dueDiligenceField.findUnique({ where: { id } }), "Field");
      return await prisma.dueDiligenceField.update({ where: { id }, data: { ...data, key } });
    }
    return await prisma.dueDiligenceField.create({ data: { ...data, key, organisationId: ctx.organisationId } });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") throw new ConflictError("A field with this key exists", { key: ["Already in use"] });
    throw err;
  }
}

export async function deleteDueDiligenceField(ctx: OrgContext, id: string) {
  assertCan(ctx, "org.settings.manage");
  const f = ensureOwned(ctx, await prisma.dueDiligenceField.findUnique({ where: { id } }), "Field");
  await prisma.dueDiligenceField.delete({ where: { id: f.id } });
}

// ---------------------------------------------------------------------------
// Financial year helpers
// ---------------------------------------------------------------------------

export function currentFyStartYear(startMonth: number, now = new Date()): number {
  const month = now.getUTCMonth() + 1;
  return month >= startMonth ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
}

export function fyLabel(startYear: number, startMonth: number): string {
  if (startMonth === 1) return String(startYear);
  return `${startYear}–${String((startYear + 1) % 100).padStart(2, "0")}`;
}

export function fyRange(startYear: number, startMonth: number) {
  const start = new Date(Date.UTC(startYear, startMonth - 1, 1));
  const end = new Date(Date.UTC(startYear + 1, startMonth - 1, 1) - 1);
  return { start, end };
}

/**
 * Permanently deletes an organisation and all of its records (cascade) and
 * stored files. Platform administrators only; the exact name must be typed.
 */
export async function deleteOrganisation(user: SessionUser, organisationId: string, confirmName: string) {
  if (!user.isPlatformAdmin) throw new ForbiddenError();
  const org = await prisma.organisation.findUnique({ where: { id: organisationId } });
  if (!org) throw new ValidationError("Organisation not found");
  if (confirmName.trim() !== org.name) throw new ValidationError("Type the organisation name exactly to confirm", { confirmName: ["Does not match"] });
  const assets = await prisma.mediaAsset.findMany({ where: { organisationId }, select: { storageKey: true } });
  await prisma.$transaction([
    prisma.documentVersion.deleteMany({ where: { organisationId } }),
    prisma.organisation.delete({ where: { id: organisationId } }),
  ]);
  const { getStorage } = await import("../storage");
  for (const a of assets) await getStorage().delete(a.storageKey).catch(() => {});
  const settings = await prisma.siteSettings.findUnique({ where: { id: 1 } });
  if (settings?.defaultOrganisationId === organisationId) await prisma.siteSettings.update({ where: { id: 1 }, data: { defaultOrganisationId: null } });
  await audit({ userId: user.id, organisationId: null }, { action: "organisation.delete", entityType: "Organisation", entityId: organisationId, summary: `Deleted organisation ${org.name}${org.isDemo ? " (demo)" : ""}` });
}

export async function setDefaultOrganisation(user: SessionUser, organisationId: string) {
  if (!user.isPlatformAdmin) throw new ForbiddenError();
  await prisma.siteSettings.upsert({ where: { id: 1 }, create: { id: 1, defaultOrganisationId: organisationId, setupCompletedAt: new Date() }, update: { defaultOrganisationId: organisationId } });
}
