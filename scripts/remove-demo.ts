/**
 * Permanently deletes every organisation marked as demo (isDemo = true),
 * including all records and stored files. Requires --yes.
 *
 *   npm run demo:remove -- --yes
 */
import { loadDotEnv, flag } from "./lib/env";
loadDotEnv();

import { prisma } from "../src/server/db";
import { getStorage } from "../src/server/storage";

async function main() {
  const demos = await prisma.organisation.findMany({ where: { isDemo: true }, select: { id: true, name: true } });
  if (demos.length === 0) return console.log("No demo organisations found.");
  if (!flag("yes")) {
    console.log(`Would delete: ${demos.map((d) => d.name).join(", ")}\nRe-run with --yes to delete permanently.`);
    return;
  }
  for (const d of demos) {
    const assets = await prisma.mediaAsset.findMany({ where: { organisationId: d.id }, select: { storageKey: true } });
    await prisma.$transaction([prisma.documentVersion.deleteMany({ where: { organisationId: d.id } }), prisma.organisation.delete({ where: { id: d.id } })]);
    for (const a of assets) await getStorage().delete(a.storageKey).catch(() => {});
    await prisma.auditLog.create({ data: { action: "organisation.delete", entityType: "Organisation", entityId: d.id, summary: `Deleted demo organisation ${d.name} via CLI` } });
    const s = await prisma.siteSettings.findUnique({ where: { id: 1 } });
    if (s?.defaultOrganisationId === d.id) await prisma.siteSettings.update({ where: { id: 1 }, data: { defaultOrganisationId: null } });
    console.log(`Deleted demo organisation ${d.name}`);
  }
  // Remove fictional demo users that no longer belong to any organisation.
  const removed = await prisma.user.deleteMany({ where: { email: { endsWith: ".demo@example.org" }, memberships: { none: {} } } });
  if (removed.count) console.log(`Removed ${removed.count} fictional demo user accounts.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
