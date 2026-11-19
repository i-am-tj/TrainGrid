import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { accessibilityResults } from "../tests/helpers/accessibility";
import { todayIn } from "../lib/time-zone";
import { addDays } from "../lib/calendar-date";
import { createLocalRoutineFor, createLocalSessionFor, signInAsNewLocalMember } from "./local-supabase";

/**
 * /profile: who the member is, their plan in numbers, their data and
 * appearance, and What's new, Privacy and Terms (which members no longer
 * find in the footer). Set PROFILE_SHOTS=<folder> to save screenshots.
 */

async function hydrated(page: Page) {
  await page.waitForFunction(() => {
    const main = document.getElementById("main-content");
    return !!main && Object.keys(main).some((key) => key.startsWith("__reactFiber"));
  });
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

test("a member's profile shows who they are, their numbers, their data and About TrainGrid", async ({
  page,
  context,
  baseURL,
}) => {
  const { userId } = await signInAsNewLocalMember(context, baseURL!);
  const today = todayIn("UTC").date;
  await createLocalSessionFor(userId, "Past run", addDays(today, -3));
  await createLocalSessionFor(userId, "Next lift", addDays(today, 2));
  await createLocalRoutineFor(userId, "My Routine");

  await page.goto("/home");
  await hydrated(page);
  // Members reach About TrainGrid through the profile, not the footer.
  await expect(page.getByRole("navigation", { name: "About TrainGrid" })).toHaveCount(0);
  await page.getByRole("banner").getByRole("link", { name: "Profile", exact: true }).click();
  await expect(page).toHaveURL(/\/profile$/);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("E2E Member");
  await expect(page.getByRole("list", { name: "Membership" })).toContainText("Early access member");
  await expect(page.getByRole("list", { name: "Membership" })).toContainText(/Member since \w+ \d{4}/);
  const stats = page.getByTestId("profile-stats");
  await expect(stats.getByRole("link", { name: "Planned: 2 sessions" })).toBeVisible();
  await expect(stats.getByRole("link", { name: "Coming up: 1 session from today" })).toBeVisible();
  await expect(stats.getByRole("link", { name: "Routines: 1 routine" })).toHaveAttribute("href", "/library?scope=mine");

  await expect(page.getByRole("link", { name: /Download my data/ })).toHaveAttribute("href", "/api/export");
  const about = page.getByRole("region", { name: "About TrainGrid" });
  await expect(about.getByRole("link", { name: /What’s new/ })).toHaveAttribute("href", "/whats-new");
  await expect(about.getByRole("link", { name: /Privacy notice/ })).toHaveAttribute("href", "/privacy");
  await expect(about.getByRole("link", { name: /Terms of use/ })).toHaveAttribute("href", "/terms");
  // The device's zone, even before the browser has reported it to the server.
  const device = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  await expect(page.getByTestId("profile-time-zone")).toHaveText(device.replaceAll("_", " ").split("/").join(" / "));
  await expect(page.getByRole("button", { name: "Sign out" }).last()).toBeVisible();

  // The download still works from here.
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: /Download my data/ }).click();
  const file = await download;
  const path = test.info().outputPath("export.json");
  await file.saveAs(path);
  expect(JSON.parse(readFileSync(path, "utf8")).sessions).toHaveLength(2);
});

test("appearance on the profile and the header switch stay in step", async ({ page, context, baseURL }) => {
  await signInAsNewLocalMember(context, baseURL!);
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/profile");
  await hydrated(page);
  const group = page.getByRole("radiogroup", { name: "Appearance" });
  await expect(group.getByRole("radio", { name: "Device" })).toHaveAttribute("aria-checked", "true");

  await group.getByRole("radio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  await expect(page.getByRole("button", { name: "Switch to light mode" })).toBeVisible();

  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await expect(group.getByRole("radio", { name: "Light" })).toHaveAttribute("aria-checked", "true");

  // Keyboard: arrows move the choice.
  await group.getByRole("radio", { name: "Light" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(group.getByRole("radio", { name: "Dark" })).toBeFocused();
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);

  await group.getByRole("radio", { name: "Device" }).click();
  await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
  expect(await page.evaluate(() => localStorage.getItem("theme"))).toBeNull();
});

test("the profile reads well on phones and desktops, light and dark", async ({ page, context, baseURL }) => {
  await signInAsNewLocalMember(context, baseURL!);
  const folder = process.env.PROFILE_SHOTS;
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/profile");
      await hydrated(page);
      await expect(page.getByTestId("profile-stats")).toBeVisible();
      await noOverflow(page);
      if (width < 640) {
        await expect(page.getByRole("banner").getByRole("link", { name: "Profile", exact: true })).toBeHidden();
        await page.getByLabel("Open menu", { exact: true }).click();
        await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: /Profile/ })).toHaveAttribute(
          "aria-current",
          "page",
        );
        await page.keyboard.press("Escape");
      }
      if (width === 390 || width === 1280) {
        expect((await accessibilityResults(page)).violations).toEqual([]);
      }
      if (folder) await page.screenshot({ path: `${folder}/profile-${width}-${scheme}.png`, fullPage: true });
    }
  }
});

test("visitors still find What's new, Privacy and Terms in the footer", async ({ page }) => {
  await page.goto("/");
  const about = page.getByRole("navigation", { name: "About TrainGrid" });
  await expect(about.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
  const response = await page.goto("/profile");
  expect(new URL(page.url()).pathname).toBe("/login");
  expect(response?.status()).toBe(200);
});
