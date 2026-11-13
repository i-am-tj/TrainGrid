import { expect, test } from "@playwright/test";
import {
  hasLocalSecretKey,
  signInAsLocalAdmin,
  signInAsNewLocalMember,
  signInAsNewLocalUser,
  supabaseState,
} from "./local-supabase";

/**
 * Route protection: private routes need a session, and a session alone is
 * not enough without membership.
 */

const PRIVATE_PAGES = [
  "/week/2026-W46",
  "/week/2026-W46/add",
  "/library",
  "/library/new",
  "/library/lower-a",
  "/library/lower-a/edit",
  "/session/00000000-0000-4000-8000-000000000000",
  "/session/00000000-0000-4000-8000-000000000000/edit",
  "/session/00000000-0000-4000-8000-000000000000/customize",
  "/admin/invitations",
  "/does-not-exist",
];

test("A1: an anonymous visitor is sent to login from the home page", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("link", { name: "Planner" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Library" })).toHaveCount(0);
});

test("A1: every private page redirects an anonymous visitor to login", async ({ page }) => {
  for (const path of PRIVATE_PAGES) {
    await page.goto(path);
    await expect(page, path).toHaveURL(
      new RegExp(`/login\\?next=${encodeURIComponent(path).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`),
    );
  }
});

test("A1: private pages send no planner content to an anonymous request", async ({ request }) => {
  for (const path of ["/", "/library", "/week/2026-W46"]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(307);
    expect(response.headers()["location"], path).toContain("/login");
    expect(await response.text(), path).not.toContain("Library");
  }
});

test("a legacy library link still requires sign-in", async ({ page }) => {
  await page.goto("/library/lower-a");
  await expect(page).toHaveURL(/\/login\?next=%2Flibrary%2Flower-a$/);
  await expect(page.getByText("Lower A")).toHaveCount(0);
});

test("the export API answers 401 to an anonymous request", async ({ request }) => {
  const response = await request.get("/api/export", { maxRedirects: 0 });
  expect(response.status()).toBe(401);
  expect(await response.json()).toEqual({ error: "Unauthorized" });
});

test("the health check and login page stay public", async ({ request }) => {
  expect((await request.get("/login", { maxRedirects: 0 })).status()).toBe(200);
  const health = await request.get("/api/health", { maxRedirects: 0 });
  expect([200, 503]).toContain(health.status());
});

test("the page asked for is remembered on the login form", async ({ page, baseURL }) => {
  test.skip((await supabaseState(baseURL!)) === "unconfigured", "Supabase is not configured");
  await page.goto("/library");
  await expect(page).toHaveURL(/\/login\?next=%2Flibrary$/);
  await expect(page.locator('input[name="next"]').first()).toHaveValue("/library");
});

test.describe("with a session", () => {
  test.beforeEach(async ({ baseURL }) => {
    test.skip((await supabaseState(baseURL!)) !== "ok", "Local Supabase stack is not running");
  });

  test("a signed-in user who is not a member cannot reach the planner or the export", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAsNewLocalUser(context, baseURL!);

    for (const path of ["/", "/library", "/week/2026-W46"]) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/login$/);
    }
    await expect(page.getByText("TrainGrid is currently invite-only.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Planner" })).toHaveCount(0);

    const response = await context.request.get("/api/export", { maxRedirects: 0 });
    expect(response.status()).toBe(401);
  });

  test("a member reaches the planner, the library and the export", async ({
    page,
    context,
    baseURL,
  }) => {
    test.skip(!hasLocalSecretKey(), "SUPABASE_SECRET_KEY is not set for the local stack");
    await signInAsNewLocalMember(context, baseURL!);

    await page.goto("/");
    await expect(page).toHaveURL(/\/week\//);
    await page.getByRole("link", { name: "Library" }).click();
    await expect(page).toHaveURL(/\/library$/);

    const response = await context.request.get("/api/export", { maxRedirects: 0 });
    expect(response.status()).toBe(200);
  });
});

test("the header fits a phone-width screen for an admin, the widest case", async ({
  page,
  context,
  baseURL,
}) => {
  test.skip((await supabaseState(baseURL!)) !== "ok", "Local Supabase stack is not running");
  test.skip(!hasLocalSecretKey(), "SUPABASE_SECRET_KEY is not set for the local stack");
  await signInAsLocalAdmin(context, baseURL!);

  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  // On phones the links are behind the menu button (E2-D21).
  await page.getByRole("banner").getByLabel("Open menu").click();
  await expect(page.getByRole("banner").getByRole("button", { name: "Sign out" })).toBeVisible();
  await expect(page.getByRole("banner").getByRole("link", { name: "Invitations" })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 4,
  );
  expect(overflow).toBe(false);
});
