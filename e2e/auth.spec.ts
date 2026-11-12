import { expect, test, type BrowserContext } from "@playwright/test";
import {
  hasLocalSecretKey,
  makeLocalMember,
  signInAsNewLocalUser,
  supabaseState,
  supabaseUrl,
} from "./local-supabase";

/**
 * Sign-in page and session tests.
 *
 * Real Google/GitHub sign-in cannot be automated, so these cover everything
 * around it: the page, the hand-off to Supabase, the callback's failure
 * handling, and sign-out with a real session from the local Supabase stack.
 *
 * Tests that need Supabase skip themselves when it is not configured or the
 * local stack is not running (npm run supabase:start).
 */

test("login page offers only the configured OAuth providers", async ({ page, baseURL }) => {
  test.skip((await supabaseState(baseURL!)) === "unconfigured", "Supabase is not configured");

  await page.goto("/login");

  // Anonymous visitors get no sign-out control.
  await expect(page.getByRole("button", { name: "Sign out" })).toHaveCount(0);

  await expect(page.getByRole("heading", { name: "Welcome to TrainGrid" })).toBeVisible();
  await expect(page.getByText("Invite-only access")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with GitHub" })).toBeVisible();
  await expect(page.locator("form button")).toHaveCount(2);

  // No password login, no sign-up, no placeholder providers.
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await expect(page.locator('input[type="email"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: /sign up|create account/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /apple|chatgpt/i })).toHaveCount(0);
});

test("Continue with Google hands off to Supabase with a callback on this site", async ({
  page,
  baseURL,
}) => {
  test.skip((await supabaseState(baseURL!)) === "unconfigured", "Supabase is not configured");

  await page.goto("/login?next=/library");

  const authorize = page.waitForRequest((request) =>
    request.url().startsWith(`${supabaseUrl}/auth/v1/authorize`),
  );
  await page.getByRole("button", { name: "Continue with Google" }).click();
  const url = new URL((await authorize).url());

  expect(url.searchParams.get("provider")).toBe("google");
  expect(url.searchParams.get("code_challenge")).toBeTruthy();
  expect(url.searchParams.get("prompt")).toBe("select_account");
  const redirectTo = new URL(url.searchParams.get("redirect_to")!);
  expect(redirectTo.origin).toBe(new URL(baseURL!).origin);
  expect(redirectTo.pathname).toBe("/auth/callback");
  expect(redirectTo.searchParams.get("next")).toBe("/library");
});

test("Continue with GitHub hands off to Supabase with a callback on this site", async ({
  page,
  baseURL,
}) => {
  test.skip((await supabaseState(baseURL!)) === "unconfigured", "Supabase is not configured");

  await page.goto("/login");

  const authorize = page.waitForRequest((request) =>
    request.url().startsWith(`${supabaseUrl}/auth/v1/authorize`),
  );
  await page.getByRole("button", { name: "Continue with GitHub" }).click();
  const url = new URL((await authorize).url());

  expect(url.searchParams.get("provider")).toBe("github");
  expect(url.searchParams.get("code_challenge")).toBeTruthy();
  expect(url.searchParams.get("prompt")).toBe("select_account");
  const redirectTo = new URL(url.searchParams.get("redirect_to")!);
  expect(redirectTo.origin).toBe(new URL(baseURL!).origin);
  expect(redirectTo.pathname).toBe("/auth/callback");
});

test("a provider account without a usable email gets a clear explanation and no session", async ({
  page,
  context,
}) => {
  await page.goto(
    "/auth/callback?error=server_error&error_code=unexpected_failure&error_description=Error+getting+user+email+from+external+provider",
  );

  await expect(page).toHaveURL(/\/login\?error=email$/);
  await expect(page.locator('p[role="alert"]')).toContainText(
    "We could not get a verified email address from that account.",
  );
  // The raw provider message is never shown.
  await expect(page.getByText("external provider")).toHaveCount(0);

  const authCookies = (await context.cookies()).filter(
    (cookie) => cookie.name.includes("auth-token") && cookie.value !== "",
  );
  expect(authCookies).toHaveLength(0);
});

test("callback without a valid code returns to login with a generic error", async ({ page }) => {
  await page.goto("/auth/callback");
  await expect(page).toHaveURL(/\/login\?error=signin$/);
  await expect(page.locator('p[role="alert"]')).toHaveText(
    "Sign-in could not be completed. Please try again.",
  );

  await page.goto("/auth/callback?code=not-a-real-code&next=https://evil.example");
  await expect(page).toHaveURL(/\/login\?error=signin$/);
});

test("provider error details are not shown on the login page", async ({ page }) => {
  await page.goto("/login?error=<script>alert(1)</script>");
  await expect(page.locator('p[role="alert"]')).toHaveText(
    "Sign-in could not be completed. Please try again.",
  );
});

test("a signed-in user who is not a member is told it is invite-only and can sign out", async ({
  page,
  context,
  baseURL,
}) => {
  test.skip((await supabaseState(baseURL!)) !== "ok", "Local Supabase stack is not running");

  const { email } = await signInAsNewLocalUser(context, baseURL!);

  await page.goto("/login");
  await expect(page.getByText("TrainGrid is currently invite-only.")).toBeVisible();
  await expect(page.getByText(email)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Continue with Google" })).toHaveCount(0);

  await page.getByRole("button", { name: "Sign out" }).click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  expect(await authCookieCount(context)).toBe(0);
});

test("a member sees their email and can sign out", async ({ page, context, baseURL }) => {
  test.skip((await supabaseState(baseURL!)) !== "ok", "Local Supabase stack is not running");
  test.skip(!hasLocalSecretKey(), "SUPABASE_SECRET_KEY is not set for the local stack");

  const { email, userId } = await signInAsNewLocalUser(context, baseURL!);
  await makeLocalMember(userId);

  await page.goto("/login");
  await expect(page.getByText(email)).toBeVisible();
  await expect(page.getByText("TrainGrid is currently invite-only.")).toHaveCount(0);

  // Sign-out lives in the header, on every page.
  await page.getByRole("link", { name: "Go to the planner" }).click();
  await expect(page).toHaveURL(/\/week\//);
  await page.getByRole("banner").getByRole("button", { name: "Sign out" }).click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await expect(page.getByText(email)).toHaveCount(0);
  expect(await authCookieCount(context)).toBe(0);

  // A5: signing out removes access to the planner.
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});

test("the invite-only refusal uses the fixed friendly message", async ({ page }) => {
  await page.goto("/login?error=invite");
  await expect(page.locator('p[role="alert"]')).toHaveText(
    "TrainGrid is currently invite-only. Ask the person who invited you to verify the email used for your account.",
  );
});

async function authCookieCount(context: BrowserContext): Promise<number> {
  return (await context.cookies()).filter(
    (cookie) => cookie.name.includes("auth-token") && cookie.value !== "",
  ).length;
}
