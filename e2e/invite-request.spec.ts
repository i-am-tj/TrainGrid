import { expect, test, type Page } from "@playwright/test";
import { accessibilityResults } from "../tests/helpers/accessibility";
import {
  deleteLocalInvitations,
  deleteLocalInviteRequests,
  readRows,
  signInAsLocalAdmin,
} from "./local-supabase";

/**
 * Request an invite: from the landing page or the sign-in page, a visitor
 * leaves their email in a themed dialog; the owner is emailed and sees the
 * request on Invitations, where one click invites them.
 */

const MOCK = "http://127.0.0.1:3011/__sent";
type Sent = { to: string; from: string; replyTo: string | null; subject: string; text: string };

async function sentTo(address: string, needle: string): Promise<Sent[]> {
  const sent = (await (await fetch(MOCK)).json()) as Sent[];
  return sent.filter((email) => email.to === address && email.text.includes(needle));
}

async function hydrated(page: Page) {
  await page.waitForFunction(() => {
    const main = document.getElementById("main-content");
    return !!main && Object.keys(main).some((key) => key.startsWith("__reactFiber"));
  });
}

const VISITOR = `visitor-${Date.now()}@example.test`;

test.beforeEach(async ({ page }) => {
  await deleteLocalInviteRequests();
  await deleteLocalInvitations([VISITOR]);
  page.on("dialog", (dialog) => {
    throw new Error(`A native ${dialog.type()} dialog appeared: ${dialog.message()}`);
  });
});

test.afterAll(async () => {
  await deleteLocalInviteRequests();
  await deleteLocalInvitations([VISITOR]);
});

test("a visitor requests an invite from the landing page; the admin invites them in one click", async ({
  page,
  browser,
  baseURL,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "No invitation yet? Request one" }).click();
  await expect(page).toHaveURL(/\/login\?request=invite$/);
  await hydrated(page);

  const dialog = page.getByRole("dialog", { name: "Request an invite" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("textbox", { name: "Email address" })).toBeFocused();

  // Validation stays in the dialog.
  await dialog.getByRole("button", { name: "Send request" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Enter your email address.");
  await dialog.getByRole("textbox", { name: "Email address" }).fill("not-an-email");
  await dialog.getByRole("button", { name: "Send request" }).click();
  await expect(dialog.getByRole("alert")).toContainText("valid email address");

  await dialog.getByRole("textbox", { name: "Email address" }).fill(`  ${VISITOR.toUpperCase()} `);
  await dialog.getByRole("textbox", { name: /Your name/ }).fill("Riley <b>Runner</b>");
  await dialog.getByRole("textbox", { name: /A note for Tanuj/ }).fill("Training for a half marathon.");
  await expect(dialog.getByText("29 / 500")).toBeVisible();
  expect((await accessibilityResults(page)).violations).toEqual([]);
  await dialog.getByRole("button", { name: "Send request" }).click();

  const sent = dialog.getByTestId("invite-request-sent");
  await expect(sent).toBeVisible();
  await expect(sent).toContainText("reviews every request personally");
  await expect(sent).toContainText(VISITOR);
  await expect(dialog.getByRole("button", { name: "Done" })).toBeFocused();

  // Stored, normalised and pending.
  expect(await readRows("invite_requests", { email: VISITOR })).toEqual([
    expect.objectContaining({ name: "Riley <b>Runner</b>", note: "Training for a half marathon.", status: "pending" }),
  ]);
  // The owner's copy, from "TrainGrid Requests", replying to the visitor, escaped.
  const copies = await sentTo("owner-feedback@example.test", VISITOR);
  expect(copies).toHaveLength(1);
  expect(copies[0]!.from).toBe("TrainGrid Requests <requests@example.test>");
  expect(copies[0]!.replyTo).toBe(VISITOR);
  expect(copies[0]!.subject).toBe("TrainGrid invite request · Riley <b>Runner</b>");

  // Closing drops ?request=invite, so a reload does not reopen it.
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/login$/);

  // Asking again for the same address reads the same, and stores and sends nothing new.
  await page.getByTestId("request-invite-line").getByRole("button", { name: "Request an invite" }).click();
  await dialog.getByRole("textbox", { name: "Email address" }).fill(VISITOR);
  await dialog.getByRole("button", { name: "Send request" }).click();
  await expect(dialog.getByTestId("invite-request-sent")).toBeVisible();
  expect(await readRows("invite_requests", { email: VISITOR })).toHaveLength(1);
  expect(await sentTo("owner-feedback@example.test", VISITOR)).toHaveLength(1);

  // The admin sees it and invites with one click; the request leaves the list.
  const context = await browser.newContext();
  const admin = await context.newPage();
  await signInAsLocalAdmin(context, baseURL!);
  await admin.goto("/admin/invitations");
  const requests = admin.getByTestId("invite-requests");
  const row = requests.getByRole("listitem").filter({ hasText: VISITOR });
  await expect(row).toContainText("Riley <b>Runner</b>");
  await expect(row).toContainText("Training for a half marathon.");
  await row.getByRole("button", { name: "Invite and email" }).click();
  await expect(admin.getByRole("status").filter({ hasText: `Invited ${VISITOR}.` })).toBeVisible();
  await expect(requests.getByRole("listitem").filter({ hasText: VISITOR })).toHaveCount(0);
  expect(await readRows("invite_requests", { email: VISITOR })).toEqual([expect.objectContaining({ status: "invited" })]);
  expect(await readRows("invitations", { email: VISITOR })).toHaveLength(1);
  // The invitation email went to the visitor.
  const invitationEmails = (await (await fetch(MOCK)).json()) as Sent[];
  expect(invitationEmails.some((email) => email.to === VISITOR)).toBe(true);
  await context.close();
});

test("an admin can dismiss a request without contacting the person", async ({ page, browser, baseURL }) => {
  const other = `dismiss-${Date.now()}@example.test`;
  await page.goto("/login");
  await hydrated(page);
  await page.getByTestId("request-invite-line").getByRole("button", { name: "Request an invite" }).click();
  const dialog = page.getByRole("dialog", { name: "Request an invite" });
  await dialog.getByRole("textbox", { name: "Email address" }).fill(other);
  await dialog.getByRole("button", { name: "Send request" }).click();
  await expect(dialog.getByTestId("invite-request-sent")).toBeVisible();

  const context = await browser.newContext();
  const admin = await context.newPage();
  await signInAsLocalAdmin(context, baseURL!);
  await admin.goto("/admin/invitations");
  const row = admin.getByTestId("invite-requests").getByRole("listitem").filter({ hasText: other });
  await row.getByRole("button", { name: "Dismiss" }).click();
  await expect(admin.getByRole("status").filter({ hasText: `Dismissed the request from ${other}.` })).toBeVisible();
  expect(await readRows("invite_requests", { email: other })).toEqual([expect.objectContaining({ status: "dismissed" })]);
  expect(await readRows("invitations", { email: other })).toHaveLength(0);
  const sent = (await (await fetch(MOCK)).json()) as Sent[];
  expect(sent.some((email) => email.to === other)).toBe(false);
  await context.close();
});

test("requests from one network are limited, and bots filling the hidden field store nothing", async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": "203.0.113.77" });
  await page.goto("/login?request=invite");
  await hydrated(page);
  const dialog = page.getByRole("dialog", { name: "Request an invite" });

  for (let i = 1; i <= 4; i++) {
    if (i > 1) {
      await page.getByTestId("request-invite-line").getByRole("button", { name: "Request an invite" }).click();
    }
    await dialog.getByRole("textbox", { name: "Email address" }).fill(`limit-${i}-${Date.now()}@example.test`);
    await dialog.getByRole("button", { name: "Send request" }).click();
    if (i <= 3) {
      await expect(dialog.getByTestId("invite-request-sent")).toBeVisible();
      await dialog.getByRole("button", { name: "Done" }).click();
    } else {
      await expect(dialog.getByRole("alert")).toContainText("try again in an hour");
    }
  }

  // The honeypot: hidden from people, filled by naive bots.
  await page.keyboard.press("Escape");
  await page.setExtraHTTPHeaders({ "x-forwarded-for": "198.51.100.5" });
  const bot = `bot-${Date.now()}@example.test`;
  await page.getByTestId("request-invite-line").getByRole("button", { name: "Request an invite" }).click();
  await dialog.getByRole("textbox", { name: "Email address" }).fill(bot);
  await dialog.locator('input[name="company"]').fill("Spam Inc", { force: true });
  await dialog.getByRole("button", { name: "Send request" }).click();
  await expect(dialog.getByTestId("invite-request-sent")).toBeVisible();
  expect(await readRows("invite_requests", { email: bot })).toHaveLength(0);
});

test("a phone shows the request dialog without sideways scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/login?request=invite");
  await hydrated(page);
  const dialog = page.getByRole("dialog", { name: "Request an invite" });
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const box = (await dialog.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(320);
});
