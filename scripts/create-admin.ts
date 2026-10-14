/**
 * Creates (or promotes) a platform administrator.
 *
 *   npm run admin:create -- --email admin@example.org --name "Jane Admin"
 *
 * The password is read from the ADMIN_PASSWORD environment variable, or a
 * strong random password is generated and printed once. No credentials are
 * hard-coded. Optionally create the first organisation with --org-name and
 * --org-slug (otherwise use the /setup wizard or the Organisations page).
 */
import { loadDotEnv, arg } from "./lib/env";
loadDotEnv();

import { randomBytes } from "node:crypto";
import { prisma } from "../src/server/db";
import { hashPassword, passwordProblems } from "../src/server/auth/password";
import { createOrganisation } from "../src/server/services/organisations";

async function main() {
  const email = arg("email")?.trim().toLowerCase();
  const name = arg("name")?.trim() || "Administrator";
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error("Usage: npm run admin:create -- --email you@example.org --name \"Your Name\" [--org-name \"My Foundation\" --org-slug my-foundation]");
    process.exit(1);
  }
  let password = process.env.ADMIN_PASSWORD;
  let generated = false;
  if (!password) {
    password = randomBytes(18).toString("base64url");
    generated = true;
  }
  const problems = passwordProblems(password);
  if (problems.length) {
    console.error(`ADMIN_PASSWORD is too weak: ${problems.join("; ")}`);
    process.exit(1);
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  const user = existing
    ? await prisma.user.update({ where: { email }, data: { isPlatformAdmin: true, isActive: true, ...(process.env.ADMIN_PASSWORD ? { passwordHash: await hashPassword(password) } : {}) } })
    : await prisma.user.create({ data: { email, name, passwordHash: await hashPassword(password), isPlatformAdmin: true } });
  await prisma.auditLog.create({ data: { actorId: null, action: "user.platform_admin", entityType: "User", entityId: user.id, summary: `Platform administrator ${existing ? "promoted" : "created"} via CLI: ${email}` } });

  const orgName = arg("org-name");
  const orgSlug = arg("org-slug");
  if (orgName && orgSlug) {
    const org = await createOrganisation(
      { id: user.id, email, name: user.name, isPlatformAdmin: true },
      { name: orgName, slug: orgSlug, currency: arg("currency") ?? "INR", financialYearStartMonth: Number(arg("fy-start") ?? 4), templateKey: "corporate-green" },
    );
    await prisma.siteSettings.upsert({ where: { id: 1 }, create: { id: 1, setupCompletedAt: new Date(), defaultOrganisationId: org.id }, update: { setupCompletedAt: new Date() } });
    console.log(`Created organisation “${org.name}” (/${org.slug}).`);
  } else {
    await prisma.siteSettings.upsert({ where: { id: 1 }, create: { id: 1, setupCompletedAt: new Date() }, update: {} });
  }

  console.log(`${existing ? "Promoted" : "Created"} platform administrator ${email}.`);
  if (generated && !existing) console.log(`Generated password (shown once, change it after signing in): ${password}`);
  if (existing && !process.env.ADMIN_PASSWORD) console.log("Existing password unchanged.");
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
