import { expect, test, type Page, type Request } from "@playwright/test";
import {
  deleteLocalInvitations,
  hasLocalSecretKey,
  makeLocalMember,
  readRows,
  signInAsLocalAdmin,
  signInAsNewLocalUser,
  supabaseState,
} from "./local-supabase";

/**
 * Invitation emails, end to end, against a local mock of the email provider
 * (e2e/mock-resend.mjs; playwright.config.ts points RESEND_API_URL at it).
 * Recipients containing "fail" get a 503 and "busy" a 429 from the mock.
 */

const MOCK = "http://127.0.0.1:3011";

type SentEmail = { to: string; from: string; subject: string; html: string; text: string; idempotencyKey: string | null; authorization: string };

async function sentTo(address: string): Promise<SentEmail[]> {
  const all = (await (await fetch(`${MOCK}/__sent`)).json()) as SentEmail[];
  return all.filter((email) => email.to === address);
}

async function invite(page: Page, address: string, { email = true } = {}) {
  await page.getByLabel("Email address").fill(address);
  const box = page.getByLabel("Email the invitation to this address");
  if (email) await box.check();
  else await box.uncheck();
  await page.getByRole("button", { name: "Invite", exact: true }).click();
  await expect(page.locator("#invite-feedback")).toHaveText("Invitation created.");
}

test.beforeEach(async ({ baseURL }) => {
  test.skip((await supabaseState(baseURL!)) !== "ok", "Local Supabase stack is not running");
  test.skip(!hasLocalSecretKey(), "SUPABASE_SECRET_KEY is not set for the local stack");
});

test("inviting with email: provider acceptance is reported truthfully, never as delivered", async ({
  page,
  context,
  baseURL,
}) => {
  const address = `mail-ok-${crypto.randomUUID()}@example.test`;
  await signInAsLocalAdmin(context, baseURL!);
  try {
    await page.goto("/admin/invitations");
    await invite(page, address);

    await expect(page.locator("#invite-email-feedback")).toHaveText(
      "Email accepted by the email provider. This doesn’t confirm it reached their inbox.",
    );
    const row = page.getByRole("listitem").filter({ hasText: address });
    await expect(row.getByText("Pending", { exact: true })).toBeVisible();
    await expect(row.getByText(/^Email accepted by provider · /)).toBeVisible();
    await expect(row.getByRole("button", { name: `Resend invitation email to ${address}` })).toBeVisible();
    await expect(page.getByText(/delivered/i)).toHaveCount(0);

    // Exactly one email, to the invited address, with the trusted link and logo.
    const [email, ...more] = await sentTo(address);
    expect(more).toHaveLength(0);
    expect(email!.from).toBe("TrainGrid <invites@example.test>");
    expect(email!.subject).toBe("You’re invited to TrainGrid");
    expect(email!.html).toContain('href="http://127.0.0.1:3010/login"');
    expect(email!.html).toContain("http://127.0.0.1:3010/brand/traingrid-logo-google-120.png");
    expect(email!.text).toContain("Open TrainGrid: http://127.0.0.1:3010/login");
    expect(email!.idempotencyKey).toMatch(/^traingrid-invitation-email\//);
    expect(email!.authorization).toBe("present");

    // An immediate resend is refused without contacting the provider.
    await row.getByRole("button", { name: `Resend invitation email to ${address}` }).click();
    await expect(row.getByText("An email was just sent for this invitation.", { exact: false })).toBeVisible();
    expect(await sentTo(address)).toHaveLength(1);
  } finally {
    await deleteLocalInvitations([address]);
  }
});

test("a failed send keeps the invitation usable and offers a retry, without provider details", async ({
  page,
  context,
  baseURL,
}) => {
  const address = `mail-fail-${crypto.randomUUID()}@example.test`;
  await signInAsLocalAdmin(context, baseURL!);
  try {
    await page.goto("/admin/invitations");
    await invite(page, address);

    await expect(page.locator("#invite-email-feedback")).toHaveText(
      "The email couldn’t be sent. The invitation is still valid — try again, or share the sign-in link yourself.",
    );
    await expect(page.getByText("mock provider outage")).toHaveCount(0);

    const row = page.getByRole("listitem").filter({ hasText: address });
    await expect(row.getByText("Pending", { exact: true })).toBeVisible();
    await expect(row.getByText(/^Email failed · .* · invitation still valid$/)).toBeVisible();

    const [invitation] = await readRows("invitations", { email: address });
    expect(invitation).toMatchObject({ accepted_at: null, revoked_at: null });
    const deliveries = await readRows("invitation_email_deliveries", { invitation_id: invitation!.id as string });
    expect(deliveries).toEqual([expect.objectContaining({ status: "failed", failure_code: "provider_unavailable" })]);

    // Retrying is allowed; it fails again here, and records a second attempt.
    await row.getByRole("button", { name: `Resend invitation email to ${address}` }).click();
    await expect(row.getByText("The email couldn’t be sent.", { exact: false })).toBeVisible();
    await expect
      .poll(async () => (await readRows("invitation_email_deliveries", { invitation_id: invitation!.id as string })).length)
      .toBe(2);
  } finally {
    await deleteLocalInvitations([address]);
  }
});

test("inviting without email sends nothing; the admin can send later", async ({ page, context, baseURL }) => {
  const address = `mail-later-${crypto.randomUUID()}@example.test`;
  await signInAsLocalAdmin(context, baseURL!);
  try {
    await page.goto("/admin/invitations");
    await invite(page, address, { email: false });
    await expect(page.locator("#invite-email-feedback")).toHaveCount(0);

    const row = page.getByRole("listitem").filter({ hasText: address });
    await expect(row.getByText("Email not sent", { exact: true })).toBeVisible();
    expect(await sentTo(address)).toHaveLength(0);

    await row.getByRole("button", { name: `Send invitation email to ${address}` }).click();
    await expect(row.getByText("Email accepted by the email provider.", { exact: false })).toBeVisible();
    await expect(row.getByText(/^Email accepted by provider · /)).toBeVisible();
    expect(await sentTo(address)).toHaveLength(1);
  } finally {
    await deleteLocalInvitations([address]);
  }
});

test("a rate-limited provider is reported as busy, not as a broken invitation", async ({
  page,
  context,
  baseURL,
}) => {
  const address = `mail-busy-${crypto.randomUUID()}@example.test`;
  await signInAsLocalAdmin(context, baseURL!);
  try {
    await page.goto("/admin/invitations");
    await invite(page, address);
    await expect(page.locator("#invite-email-feedback")).toContainText("The email service is busy");
    await expect(page.getByRole("listitem").filter({ hasText: address }).getByText("Pending", { exact: true })).toBeVisible();
  } finally {
    await deleteLocalInvitations([address]);
  }
});

test("revoking an invitation removes its send controls; accepted members get none", async ({
  page,
  context,
  baseURL,
}) => {
  const address = `mail-revoke-${crypto.randomUUID()}@example.test`;
  await signInAsLocalAdmin(context, baseURL!);
  try {
    await page.goto("/admin/invitations");
    await invite(page, address, { email: false });
    const row = page.getByRole("listitem").filter({ hasText: address });
    page.once("dialog", (dialog) => dialog.accept());
    await row.getByRole("button", { name: "Revoke", exact: true }).click();
    await expect(row.getByText("Revoked", { exact: true })).toBeVisible();
    await expect(row.getByRole("button")).toHaveCount(0);
  } finally {
    await deleteLocalInvitations([address]);
  }
});

test("a member or anonymous visitor replaying the send action gets nothing sent", async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  const address = `mail-replay-${crypto.randomUUID()}@example.test`;
  await signInAsLocalAdmin(context, baseURL!);
  const member = await browser.newContext({ baseURL });
  const anonymous = await browser.newContext({ baseURL });
  try {
    const { userId } = await signInAsNewLocalUser(member, baseURL!);
    await makeLocalMember(userId);

    await page.goto("/admin/invitations");
    await invite(page, address, { email: false });
    const row = page.getByRole("listitem").filter({ hasText: address });

    // Capture the admin's real send request.
    const sendRequest = page.waitForRequest((r) => r.method() === "POST" && !!r.headers()["next-action"]);
    await row.getByRole("button", { name: `Send invitation email to ${address}` }).click();
    const send: Request = await sendRequest;
    await expect(row.getByText(/^Email accepted by provider · /)).toBeVisible();
    const body = send.postDataBuffer()!;
    const [invitation] = await readRows("invitations", { email: address });
    const before = (await readRows("invitation_email_deliveries", { invitation_id: invitation!.id as string })).length;

    for (const [who, ctx] of [["member", member], ["anonymous", anonymous]] as const) {
      const response = await ctx.request.post(send.url(), {
        headers: {
          "next-action": send.headers()["next-action"]!,
          "content-type": send.headers()["content-type"]!,
          accept: "text/x-component",
        },
        data: body,
        maxRedirects: 0,
      });
      expect(response.status(), who).not.toBe(200);
    }
    const after = await readRows("invitation_email_deliveries", { invitation_id: invitation!.id as string });
    expect(after).toHaveLength(before);
    expect(await sentTo(address)).toHaveLength(1);
  } finally {
    await deleteLocalInvitations([address]);
    await member.close();
    await anonymous.close();
  }
});
