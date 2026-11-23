import { expect, test, type Page } from "@playwright/test";
import { docImage } from "../tests/helpers/doc-images";
import { accessibilityResults } from "../tests/helpers/accessibility";
import {
  createAcceptedInvitation,
  deleteLocalInvitations,
  signInAsLocalAdmin,
  signInAsNewLocalMember,
} from "./local-supabase";

async function pendingInvitation(page: Page, email: string) {
  await page.goto("/admin/invitations");
  await page.getByLabel("Email address").fill(email);
  const send = page.getByLabel("Email the invitation to this address");
  if (await send.count()) await send.uncheck();
  await page.getByRole("button", { name: "Invite", exact: true }).click();
  await expect(page.locator("#invite-feedback")).toHaveText(
    "Invitation created.",
  );
}

for (const kind of ["invitation", "access"] as const) {
  test(`revoke ${kind} modal supports keyboard, cancellation and real pending state`, async ({
    page,
    context,
    browser,
    baseURL,
  }) => {
    const memberContext = await browser.newContext({ baseURL });
    const member =
      kind === "access"
        ? await signInAsNewLocalMember(memberContext, baseURL!)
        : null;
    const email =
      member?.email ?? `modal-review-${crypto.randomUUID()}@example.test`;
    await signInAsLocalAdmin(context, baseURL!);
    try {
      if (member) {
        await createAcceptedInvitation(email, member.userId);
        await page.goto("/admin/invitations");
      } else await pendingInvitation(page, email);
      page.on("dialog", () => {
        throw new Error("Revoke must not use a browser prompt");
      });
      const row = page.getByRole("listitem").filter({ hasText: email });
      const label = kind === "access" ? "Revoke access" : "Revoke";
      const trigger = row.getByRole("button", { name: label, exact: true });
      const dialog = page.getByRole("dialog", {
        name: kind === "access" ? "Revoke access?" : "Revoke invitation?",
        exact: true,
      });
      for (const theme of ["light", "dark"] as const) {
        await page.emulateMedia({
          colorScheme: theme,
          reducedMotion: "reduce",
        });
        const toggle = page.getByRole("button", { name: `Switch to ${theme} mode`, exact: true });
        if (await toggle.count()) await toggle.click();
        if (theme === "dark") await expect(page.locator("html")).toHaveClass(/dark/);
        else await expect(page.locator("html")).not.toHaveClass(/dark/);
        for (const width of [320, 1440]) {
          await page.setViewportSize({ width, height: 800 });
          await trigger.click();
          await expect(
            dialog.getByRole("button", { name: "Cancel", exact: true }),
          ).toBeFocused();
          await expect(dialog).toContainText(email);
          if (kind === "access")
            await expect(dialog).toContainText(
              "Their routines and sessions are kept",
            );
          await page.keyboard.press("Tab");
          await expect(
            dialog.getByRole("button", { name: label, exact: true }),
          ).toBeFocused();
          await page.keyboard.press("Shift+Tab");
          await page
            .getByLabel("Email address")
            .evaluate((element) => element.focus());
          await expect(
            dialog.getByRole("button", { name: "Cancel", exact: true }),
          ).toBeFocused();
          expect((await accessibilityResults(page)).violations).toEqual([]);
          const bounds = (await dialog.boundingBox())!;
          expect(bounds.x).toBeGreaterThanOrEqual(0);
          expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
          await docImage(dialog, `docs/images/epic-3/revoke-modal/${kind}-${width}-${theme}.png`, {
            animations: "disabled",
          });
          await page.keyboard.press("Escape");
          await expect(dialog).not.toBeVisible();
          await expect(trigger).toBeFocused();
          await trigger.click();
          await dialog
            .getByRole("button", { name: "Cancel", exact: true })
            .click();
          await expect(dialog).not.toBeVisible();
          await expect(trigger).toBeFocused();
          await expect(
            row.getByText(kind === "access" ? "Accepted" : "Pending", {
              exact: true,
            }),
          ).toBeVisible();
        }
      }
      await page.route("**/admin/invitations", async (route) => {
        if (route.request().method() === "POST")
          await new Promise((resolve) => setTimeout(resolve, 1000));
        await route.continue();
      });
      await trigger.click();
      await dialog.getByRole("button", { name: label, exact: true }).click();
      await expect(
        dialog.getByRole("button", { name: "Revoking…", exact: true }),
      ).toBeDisabled();
      await expect(
        dialog.getByRole("button", { name: "Cancel", exact: true }),
      ).toBeDisabled();
      await page.keyboard.press("Escape");
      await expect(dialog).toBeVisible();
      await expect(row.getByText("Revoked", { exact: true })).toBeVisible();
      await expect(dialog).toHaveCount(0);
    } finally {
      await deleteLocalInvitations([email]);
      await memberContext.close();
    }
  });
}

test("failed revoke returns focus and reports an honest row error", async ({
  page,
  context,
  baseURL,
}) => {
  const email = `modal-error-${crypto.randomUUID()}@example.test`;
  await signInAsLocalAdmin(context, baseURL!);
  try {
    await pendingInvitation(page, email);
    const row = page.getByRole("listitem").filter({ hasText: email });
    const trigger = row.getByRole("button", { name: "Revoke", exact: true });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Revoke invitation?" });
    await dialog.locator('input[name="id"]').evaluate((element) => {
      (element as HTMLInputElement).value = "invalid";
    });
    await dialog.getByRole("button", { name: "Revoke", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(row.getByRole("alert")).toHaveText("Unknown invitation.");
    await expect(row.getByText("Pending", { exact: true })).toBeVisible();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  } finally {
    await deleteLocalInvitations([email]);
  }
});
