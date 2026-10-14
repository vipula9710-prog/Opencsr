import { defineConfig, devices } from "@playwright/test";

// E2E tests run against a running OpenCSR server seeded with the demo data:
//   npm run build && npm start   (with a seeded database)
//   E2E_BASE_URL=http://localhost:3000 E2E_EMAIL=... E2E_PASSWORD=... npm run test:e2e
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
