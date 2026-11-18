import { mkdir } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { accessibilityResults } from "../tests/helpers/accessibility";
import { todayIn } from "../lib/time-zone";
import {
  createLocalSessionFor,
  readRows,
  signInAsNewLocalMember,
} from "./local-supabase";

const folder = "docs/images/epic-3/secondary-actions";
async function theme(page: Page, value: "light" | "dark") {
  await page.emulateMedia({ colorScheme: value, reducedMotion: "reduce" });
  const toggle = page.getByRole("button", {
    name: `Switch to ${value} mode`,
    exact: true,
  });
  if (await toggle.count()) await toggle.click();
}
async function capture(page: Page, name: string) {
  await mkdir(folder, { recursive: true });
  await page.screenshot({
    path: `${folder}/${name}.png`,
    animations: "disabled",
    style: "nextjs-portal { display: none !important; }",
  });
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

test("data download lives in a secondary account disclosure with keyboard and outside dismissal", async ({
  page,
  context,
  baseURL,
}) => {
  await signInAsNewLocalMember(context, baseURL!);
  await page.goto("/library");
  await page.waitForFunction(() => {
    const summary = document.querySelector("header summary");
    return !!summary && Object.keys(summary).some((key) => key.startsWith("__reactFiber"));
  });
  for (const scheme of ["light", "dark"] as const) {
    await theme(page, scheme);
    for (const width of [320, 360, 1440]) {
      await page.setViewportSize({ width, height: 800 });
      if (width < 640)
        await page.getByLabel("Open menu", { exact: true }).click();
      await expect(
        page.getByRole("link", { name: "Export", exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("link", { name: "Download my data", exact: true }),
      ).toHaveCount(0);
      const account = page
        .locator("header summary:visible")
        .filter({ hasText: "Account" });
      await account.focus();
      await page.keyboard.press("Enter");
      const download = page
        .getByRole("navigation", { name: "Account", exact: true })
        .getByRole("link", { name: "Download my data", exact: true });
      await expect(download).toHaveAttribute("href", "/api/export");
      await page.keyboard.press("Tab");
      await expect(download).toBeFocused();
      await noOverflow(page);
      if (width !== 320) await capture(page, `account-${width}-${scheme}`);
      await page.keyboard.press("Escape");
      await expect(download).toHaveCount(0);
      await expect(account).toBeFocused();
      await account.click();
      await page.mouse.click(4, 700);
      await expect(download).toHaveCount(0);
      if (width < 640)
        await expect(
          page.getByLabel("Open menu", { exact: true }),
        ).toBeVisible();
    }
  }
});

test("week actions keep duplication hidden until confirmation and append independent copies", async ({
  page,
  context,
  baseURL,
}) => {
  const { userId } = await signInAsNewLocalMember(context, baseURL!);
  const source = await createLocalSessionFor(
    userId,
    "Copy this session",
    "2026-11-17",
  );
  await createLocalSessionFor(userId, "Already planned", "2026-11-24");
  await page.goto("/week/2026-W47?day=2");
  const dialog = page.getByRole("dialog", {
    name: "Duplicate week",
    exact: true,
  });
  for (const scheme of ["light", "dark"] as const) {
    await theme(page, scheme);
    for (const width of [320, 360, 768, 1440]) {
      await page.setViewportSize({ width, height: 800 });
      await expect(page.getByRole("combobox", { name: "Duplicate week onto", exact: true })).toHaveCount(0);
      const trigger = page.getByRole("button", {
        name: "Week actions",
        exact: true,
      });
      await expect(trigger).toBeVisible();
      if ([360, 1440].includes(width)) await capture(page, `planner-${width}-${scheme}`);
      await trigger.click();
      await expect(
        dialog.getByRole("button", { name: "Cancel", exact: true }),
      ).toBeFocused();
      await expect(dialog.getByLabel("Duplicate week onto")).toHaveValue(
        "2026-W48",
      );
      await expect(dialog).toContainText(
        "already has 1 session(s). Copies will be added alongside them.",
      );
      expect((await accessibilityResults(page)).violations).toEqual([]);
      await noOverflow(page);
      if ([360, 1440].includes(width))
        await capture(page, `duplicate-${width}-${scheme}`);
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
      await expect(trigger).toBeFocused();
      await expect
        .poll(
          async () =>
            (await readRows("scheduled_sessions", { user_id: userId })).length,
        )
        .toBe(2);
    }
  }
  await page.getByRole("button", { name: "Week actions", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Duplicate week", exact: true })
    .click();
  await expect(page).toHaveURL(/\/week\/2026-W48$/);
  const rows = await readRows("scheduled_sessions", { user_id: userId });
  expect(rows).toHaveLength(3);
  expect(rows.filter((row) => row.date === "2026-11-24")).toHaveLength(2);
  const copies = rows.filter((row) => row.name === "Copy this session");
  expect(copies).toHaveLength(2);
  const original = copies.find((row) => row.id === source)!.snapshot as { items: Array<{ id: string; instruction: string }> };
  const copy = copies.find((row) => row.id !== source)!.snapshot as { items: Array<{ id: string; instruction: string }> };
  expect(copy.items[0]!.instruction).toBe(original.items[0]!.instruction);
  expect(copy.items[0]!.id).not.toBe(original.items[0]!.id);
  await page.goto("/week/2026-W49");
  await page.getByRole("button", { name: "Week actions", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "Duplicate week", exact: true }),
  ).toBeDisabled();
});

test("mobile home prioritizes today's first session ahead of getting started", async ({
  page,
  context,
  baseURL,
}) => {
  const { userId } = await signInAsNewLocalMember(context, baseURL!);
  await createLocalSessionFor(userId, "Today comes first", todayIn("UTC").date);
  await page.goto("/home");
  const first = page.getByRole("link", {
    name: "Today comes first",
    exact: true,
  });
  for (const scheme of ["light", "dark"] as const) {
    await theme(page, scheme);
    for (const width of [320, 360, 1440]) {
      await page.setViewportSize({ width, height: 800 });
      await expect(first).toBeVisible();
      await expect(page.getByTestId("getting-started")).toBeVisible();
      if (width < 640) {
        const session = (await first.boundingBox())!;
        const intro = (await page
          .getByTestId("getting-started")
          .boundingBox())!;
        expect(session.y).toBeLessThan(480);
        expect(intro.y).toBeGreaterThan(session.y + session.height);
        const release = page.locator('main a[href="/whats-new"]');
        if (await release.count())
          expect((await release.boundingBox())!.height).toBeLessThanOrEqual(44);
      }
      await noOverflow(page);
      if (width === 360) expect((await accessibilityResults(page)).violations).toEqual([]);
      if (width !== 320) await capture(page, `home-${width}-${scheme}`);
    }
  }
});

test("public access guidance gives invited and uninvited visitors a next step without registration", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "No invitation yet?", exact: true }),
  ).toHaveAttribute("href", "#access");
  const access = page.locator("#access");
  await expect(access).toContainText(
    "log in with Google or GitHub using that email address",
  );
  await expect(access).toContainText("there is no public sign-up");
  await expect(
    access.getByRole("link", {
      name: "contact Tanuj through his portfolio",
      exact: true,
    }),
  ).toHaveAttribute("href", "https://iamtj.dev");
  await expect(
    page.getByRole("link", { name: /register|sign up/i }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("navigation", { name: "Account", exact: true }),
  ).toHaveCount(0);
  for (const scheme of ["light", "dark"] as const) {
    await theme(page, scheme);
    for (const width of [320, 360, 1440]) {
      await page.setViewportSize({ width, height: 800 });
      await access.scrollIntoViewIfNeeded();
      await noOverflow(page);
      if (width !== 320) await capture(page, `access-${width}-${scheme}`);
    }
  }
});
