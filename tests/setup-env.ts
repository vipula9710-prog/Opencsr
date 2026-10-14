// Test environment. Uses TEST_DATABASE_URL (a separate, disposable database).
import { readFileSync } from "node:fs";

process.env.DATABASE_URL = readFileSync(".vitest-db-url", "utf8").trim();
process.env.AUTH_SECRET = "test-secret-test-secret-test-secret-test-secret";
process.env.STORAGE_DRIVER = "local";
process.env.STORAGE_LOCAL_DIR = "./storage-test";
process.env.APP_URL = "http://localhost:3000";
process.env.LOG_LEVEL = "error";
(process.env as Record<string, string>).NODE_ENV = "test";
