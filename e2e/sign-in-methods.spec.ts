import { expect, test } from "@playwright/test";
import { hasLocalSecretKey, linkLocalGoogleIdentity, signInAsNewLocalMember, supabaseState } from "./local-supabase";

/** Sign-in methods page and the locked state (E2-D22, canonical email rule). */

test.beforeEach(async ({ baseURL }) => {
  test.skip((await supabaseState(baseURL!)) !== "ok", "Local Supabase stack is not running");
  test.skip(!hasLocalSecretKey(), "SUPABASE_SECRET_KEY is not set for the local stack");
});

test("a member sees their sign-in on the invited address, with nothing to remove", async ({ page, context, baseURL }) => {
  const { email } = await signInAsNewLocalMember(context, baseURL!);
  await page.goto("/account/sign-in-methods");
  await expect(page.getByRole("heading", { name: "Sign-in methods" })).toBeVisible();
  await expect(page.getByText(email, { exact: true }).first()).toBeVisible();
  const rows = page.locator("main li");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("Your email");
  await expect(page.getByRole("button", { name: /^Remove/ })).toHaveCount(0);
  await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
});

test("a sign-in on another address locks the account until it is removed", async ({ page, context, baseURL }) => {
  const { userId } = await signInAsNewLocalMember(context, baseURL!);
  const alias = `alias-${crypto.randomUUID()}@example.test`;
  test.skip(!linkLocalGoogleIdentity(userId, alias), "Local database container is not reachable");

  // Every member page now leads to the account page instead of showing data.
  await page.goto("/library");
  await expect(page).toHaveURL(/\/account\/sign-in-methods$/);
  await expect(page.locator("main").getByRole("alert")).toContainText("Your account is locked");
  const header = page.getByRole("banner");
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(header.getByRole("link", { name: "Library" })).toHaveCount(0);
  await expect(header.getByRole("link", { name: "Sign-in methods" })).toBeVisible();

  // The export is refused too.
  const exportResponse = await page.request.get("/api/export", { maxRedirects: 0 });
  expect(exportResponse.status()).toBe(401);

  const stray = page.locator("main li").filter({ hasText: alias });
  await expect(stray).toContainText("Different email");
  await stray.getByRole("button", { name: `Remove Google ${alias}` }).click();
  await expect(page.locator("main").getByRole("status")).toHaveText("Sign-in method removed.");
  await expect(page.locator("main li").filter({ hasText: alias })).toHaveCount(0);
  await expect(page.locator("main").getByRole("alert")).toHaveCount(0);

  await page.getByRole("button", { name: "Sign out of other devices" }).click();
  await expect(page.locator("main").getByRole("status")).toHaveText("Signed out of every other device.");

  await page.goto("/library");
  await expect(page.getByRole("heading", { name: "Library", level: 1 })).toBeVisible();
});

test("Sign-in methods is reachable from the header", async ({ page, context, baseURL }) => {
  await signInAsNewLocalMember(context, baseURL!);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/library");
  await page.getByRole("banner").getByRole("link", { name: "Sign-in methods" }).click();
  await expect(page).toHaveURL(/\/account\/sign-in-methods$/);
});

test("signed-out visitors are sent to sign in", async ({ page }) => {
  await page.goto("/account/sign-in-methods");
  await expect(page).toHaveURL(/\/login\?next=%2Faccount%2Fsign-in-methods$/);
});
