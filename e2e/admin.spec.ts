import { expect, test } from "@playwright/test";
import {
  deleteLocalInvitations,
  hasLocalSecretKey,
  makeLocalMember,
  signInAsLocalAdmin,
  signInAsNewLocalUser,
  supabaseState,
} from "./local-supabase";

/**
 * Admin invitation management.
 * Needs the local Supabase stack and its secret key in .env.local.
 */

test.beforeEach(async ({ baseURL }) => {
  test.skip((await supabaseState(baseURL!)) !== "ok", "Local Supabase stack is not running");
  test.skip(!hasLocalSecretKey(), "SUPABASE_SECRET_KEY is not set for the local stack");
});

test("M3: an anonymous visitor is sent to login from the admin page", async ({ page }) => {
  await page.goto("/admin/invitations");
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin%2Finvitations$/);
  await expect(page.getByRole("heading", { name: "Invitations" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Invitations" })).toHaveCount(0);
});

test("M4: a member who is not an admin gets a 404 and sees no admin link", async ({
  page,
  context,
  baseURL,
}) => {
  const { userId } = await signInAsNewLocalUser(context, baseURL!);
  await makeLocalMember(userId);

  const response = await page.goto("/admin/invitations");
  expect(response?.status()).toBe(404);
  await expect(page.getByLabel("Email address")).toHaveCount(0);

  await page.goto("/login");
  await expect(page.getByRole("link", { name: "Invitations" })).toHaveCount(0);
});

test("a signed-in user who is not a member gets a 404", async ({ page, context, baseURL }) => {
  await signInAsNewLocalUser(context, baseURL!);
  const response = await page.goto("/admin/invitations");
  expect(response?.status()).toBe(404);
});

test("M1: an admin can invite, sees the status, and can revoke", async ({
  page,
  context,
  baseURL,
}) => {
  const email = `invitee-${crypto.randomUUID()}@example.test`;
  await signInAsLocalAdmin(context, baseURL!);

  try {
    await page.goto("/login");
    await page.getByRole("link", { name: "Invitations" }).click();
    await expect(page.getByRole("heading", { name: "Invitations", exact: true })).toBeVisible();
    await expect(page.getByText(`${baseURL}/login`)).toBeVisible();

    // Mixed case and padding are normalised.
    await page.getByLabel("Email address").fill(`  ${email.toUpperCase()} `);
    await page.getByRole("button", { name: "Invite" }).click();
    await expect(page.getByRole("status")).toHaveText("Invitation created.");

    const row = page.getByRole("listitem").filter({ hasText: email });
    await expect(row).toBeVisible();
    await expect(row.getByText("Pending")).toBeVisible();

    // A second invitation for the same address is refused.
    await page.getByLabel("Email address").fill(email);
    await page.getByRole("button", { name: "Invite" }).click();
    await expect(page.locator('p[role="alert"]')).toHaveText(
      "That email address already has an invitation.",
    );

    // Passes the browser's own check but is refused by the server.
    await page.getByLabel("Email address").fill("friend@localhost");
    await page.getByRole("button", { name: "Invite" }).click();
    await expect(page.locator('p[role="alert"]')).toHaveText("Enter a valid email address.");

    page.once("dialog", (dialog) => dialog.accept());
    await row.getByRole("button", { name: "Revoke" }).click();
    await expect(row.getByText("Revoked")).toBeVisible();
    await expect(row.getByRole("button", { name: "Revoke" })).toHaveCount(0);
  } finally {
    await deleteLocalInvitations([email]);
  }
});
