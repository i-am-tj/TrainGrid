import { expect, test } from "@playwright/test";
import { hasLocalSecretKey, linkLocalGoogleIdentity, signInAsNewLocalMember, supabaseState } from "./local-supabase";

/** Sign-in methods page: see, approve and remove linked identities (E2-D22). */

test.beforeEach(async ({ baseURL }) => {
  test.skip((await supabaseState(baseURL!)) !== "ok", "Local Supabase stack is not running");
  test.skip(!hasLocalSecretKey(), "SUPABASE_SECRET_KEY is not set for the local stack");
});

test("a member sees their sign-in, then approves and removes a linked one", async ({ page, context, baseURL }) => {
  const { userId } = await signInAsNewLocalMember(context, baseURL!);
  await page.goto("/account/sign-in-methods");
  await expect(page.getByRole("heading", { name: "Sign-in methods" })).toBeVisible();

  const rows = page.locator("main li");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("Email");
  await expect(rows.first()).toContainText("Approved");
  await expect(rows.first()).toContainText("This sign-in");
  await expect(page.getByRole("button", { name: /^Remove/ })).toHaveCount(0);

  // Supabase Auth linked a Google sign-in with a different address.
  const alias = `alias-${crypto.randomUUID()}@example.test`;
  test.skip(!linkLocalGoogleIdentity(userId, alias), "Local database container is not reachable");
  await page.reload();
  const linked = rows.filter({ hasText: alias });
  await expect(linked).toContainText("Google");
  await expect(linked).toContainText("Needs approval");

  await linked.getByRole("button", { name: `Approve Google ${alias}` }).click();
  await expect(page.getByRole("status")).toHaveText("Sign-in method approved.");
  await expect(rows.filter({ hasText: alias })).toContainText("Approved");

  await rows.filter({ hasText: alias }).getByRole("button", { name: `Remove Google ${alias}` }).click();
  await expect(page.getByRole("status")).toHaveText("Sign-in method removed.");
  await expect(rows.filter({ hasText: alias })).toHaveCount(0);
  await expect(rows).toHaveCount(1);

  // Still signed in and still a member: the session's own identity was never at risk.
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
