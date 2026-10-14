import { execSync } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

/**
 * Each test run gets its own fresh PostgreSQL schema (e.g. test_1712345678),
 * created with `prisma migrate deploy` and dropped afterwards. Existing
 * schemas and data are never touched.
 */
export default async function setup() {
  const base = process.env.TEST_DATABASE_URL ?? "postgresql://opencsr:opencsr@localhost:5432/opencsr_test";
  const schema = `test_${Date.now()}`;
  const url = `${base.split("?")[0]}?schema=${schema}`;
  writeFileSync(".vitest-db-url", url);
  execSync("npx prisma migrate deploy", { stdio: "ignore", env: { ...process.env, DATABASE_URL: url } });
  rmSync("./storage-test", { recursive: true, force: true });
  return async () => {
    const prisma = new PrismaClient({ datasourceUrl: url });
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await prisma.$disconnect();
    rmSync("./storage-test", { recursive: true, force: true });
    rmSync(".vitest-db-url", { force: true });
  };
}
