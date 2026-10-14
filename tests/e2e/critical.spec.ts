import { expect, test, type Page } from "@playwright/test";

const EMAIL = process.env.E2E_EMAIL ?? "admin@example.org";
const PASSWORD = process.env.E2E_PASSWORD ?? "DemoAdmin#2026";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin/);
}

test("public website renders with the fictional demo notice and proper 404s", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("DEMO ENVIRONMENT — All organisation records and impact figures are fictional.")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  const res = await page.goto("/this-page-does-not-exist");
  expect(res?.status()).toBe(404);
});

test("anonymous visitors cannot reach the dashboard or draft preview", async ({ page, request }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login/);
  const preview = await request.get("/api/preview?path=/", { maxRedirects: 0 });
  expect(preview.status()).toBe(403);
});

test("wrong password shows a generic error", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Password").fill("definitely-wrong");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Incorrect email or password" })).toBeVisible();
});

test("create a project from the dashboard", async ({ page }) => {
  await login(page);
  await page.goto("/admin/projects/new");
  const title = `E2E project ${Date.now()}`;
  await page.getByLabel("Title").fill(title);
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await page.goto("/admin/projects");
  await expect(page.getByRole("link", { name: title })).toBeVisible();
});

test("website builder: draft colour change stays private until published", async ({ page, browser }) => {
  await login(page);
  await page.goto("/admin/website/theme");
  const color = `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0").toUpperCase()}`;
  const field = page.getByRole("textbox", { name: "Primary", exact: true });
  await field.fill(color);
  await expect(page.getByText(/Draft saved/)).toBeVisible({ timeout: 15000 });

  const anon = await browser.newContext();
  const anonPage = await anon.newPage();
  await anonPage.goto("/");
  expect(await anonPage.content()).not.toContain(color);

  page.once("dialog", (d) => d.accept("e2e publish"));
  await page.getByRole("button", { name: /^Publish$/ }).click();
  await expect(page.getByText(/Published version \d+/)).toBeVisible({ timeout: 20000 });

  await anonPage.goto("/");
  expect(await anonPage.content()).toContain(color);
  await anon.close();
});

test("builder sections can be added and appear in the live preview", async ({ page }) => {
  await login(page);
  await page.goto("/admin/website/homepage");
  await page.getByRole("button", { name: "Add section" }).click();
  await page.getByRole("button", { name: /Call to action/ }).click();
  const heading = `E2E CTA ${Date.now()}`;
  await page.getByLabel("Heading").fill(heading);
  await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  await expect(page.getByText(/Draft saved/)).toBeVisible({ timeout: 15000 });
  await page.reload();
  await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  // Clean up: discard the unpublished change.
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Discard changes" }).click();
  await page.waitForLoadState("load");
  await expect(page.getByRole("heading", { name: heading })).toHaveCount(0);
});

test("mobile navigation opens", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.locator("#mobile-menu")).toBeVisible();
  await ctx.close();
});
