import { expect, test } from "@playwright/test";
import {
  LOCAL_ADMIN_ID,
  createAcceptedInvitation,
  deleteLocalInvitations,
  hasLocalSecretKey,
  linkLocalGoogleIdentity,
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

test("an admin revokes an accepted member's access; the member is locked out at once", async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  // The member signs in in their own browser.
  const memberContext = await browser.newContext({ baseURL });
  const memberPage = await memberContext.newPage();
  const member = await signInAsNewLocalUser(memberContext, baseURL!);
  await makeLocalMember(member.userId);
  await createAcceptedInvitation(member.email, member.userId);

  const adminEmail = `admin-${crypto.randomUUID()}@example.test`;
  await createAcceptedInvitation(adminEmail, LOCAL_ADMIN_ID);
  await signInAsLocalAdmin(context, baseURL!);

  try {
    await memberPage.goto("/");
    await expect(memberPage).toHaveURL(/\/week\//);

    await page.goto("/admin/invitations");

    // An admin's own row offers nothing to revoke.
    const adminRow = page.getByRole("listitem").filter({ hasText: adminEmail });
    await expect(adminRow.getByText("Accepted")).toBeVisible();
    await expect(adminRow.getByText(/· Admin$/)).toBeVisible();
    await expect(adminRow.getByRole("button")).toHaveCount(0);

    const memberRow = page.getByRole("listitem").filter({ hasText: member.email });
    await expect(memberRow.getByText("Accepted")).toBeVisible();
    page.once("dialog", (dialog) => {
      expect(dialog.message()).toContain("Their routines and sessions are kept");
      return dialog.accept();
    });
    await memberRow.getByRole("button", { name: "Revoke access" }).click();
    await expect(memberRow.getByText("Revoked", { exact: true })).toBeVisible();
    await expect(memberRow.getByText("Access revoked, data kept")).toBeVisible();
    await expect(memberRow.getByRole("button")).toHaveCount(0);

    // The member's very next request is refused, without signing out.
    await memberPage.goto("/");
    await expect(memberPage).toHaveURL(/\/login$/);
    await expect(memberPage.getByText("TrainGrid is currently invite-only.")).toBeVisible();
    const exportResponse = await memberContext.request.get("/api/export", { maxRedirects: 0 });
    expect(exportResponse.status()).toBe(401);
  } finally {
    await deleteLocalInvitations([member.email.toLowerCase(), adminEmail]);
    await memberContext.close();
  }
});

// ---------------------------------------------------------------------------
// Linked identities (bug 2026-11-13, E2-D22)
// ---------------------------------------------------------------------------

test("an address already linked to a member's sign-in cannot be invited as someone else", async ({
  page,
  context,
  baseURL,
}) => {
  // A member who signed up with one address and also has a Google sign-in
  // linked under a second address — what Supabase Auth does automatically
  // when the verified emails match.
  const { userId } = await signInAsNewLocalUser(context, baseURL!);
  await makeLocalMember(userId);
  const alias = `alias-${crypto.randomUUID()}@example.test`;
  test.skip(!linkLocalGoogleIdentity(userId, alias), "Local database container is not reachable");
  await context.clearCookies();

  await signInAsLocalAdmin(context, baseURL!);
  try {
    await page.goto("/admin/invitations");
    await page.getByLabel("Email address").fill(alias.toUpperCase());
    await page.getByRole("button", { name: "Invite" }).click();
    await expect(page.locator('p[role="alert"]')).toHaveText(
      /already signs in to an existing member's account.*cannot be invited as a separate person/,
    );
    await expect(page.getByRole("listitem").filter({ hasText: alias })).toHaveCount(0);

    // An ordinary new address is still invited normally.
    const fresh = `fresh-${crypto.randomUUID()}@example.test`;
    await page.getByLabel("Email address").fill(fresh);
    await page.getByRole("button", { name: "Invite" }).click();
    await expect(page.getByRole("status")).toHaveText("Invitation created.");
    await deleteLocalInvitations([fresh]);
  } finally {
    await deleteLocalInvitations([alias]);
  }
});

test("the sign-in page explains a refused sign-in on another address without naming anyone", async ({ page }) => {
  await page.goto("/login?error=linked");
  await expect(page.locator("main").getByRole("alert")).toHaveText(
    "This account has a sign-in with a different email address linked to it. TrainGrid only accepts sign-ins that use the invited email address. Ask the person who invited you for help.",
  );
});
