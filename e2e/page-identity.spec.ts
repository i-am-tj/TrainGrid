import { expect, test } from "@playwright/test";
import { todayIn } from "../lib/time-zone";
import {
  createLocalRoutineFor,
  createLocalSessionFor,
  hasLocalSecretKey,
  signInAsNewLocalMember,
  supabaseState,
} from "./local-supabase";

/**
 * Each member page has its own title, and a missing routine leads back to
 * the Library in the visitor's theme (UI_DESIGN_AUDIT ranks 8 and 9).
 */

test.beforeEach(async ({ baseURL }) => {
  test.skip((await supabaseState(baseURL!)) !== "ok", "Local Supabase stack is not running");
  test.skip(!hasLocalSecretKey(), "Local Supabase secret key is not configured");
});

const MISSING = "00000000-0000-4000-8000-000000000000";

test("planner, routine and session pages have task-specific titles", async ({ page, context, baseURL }) => {
  const { userId } = await signInAsNewLocalMember(context, baseURL!);
  const routineId = await createLocalRoutineFor(userId, "Private hill notes");
  const sessionId = await createLocalSessionFor(userId, "Private tempo notes", todayIn("UTC").date);
  for (const [path, title] of [
    ["/week/2026-W47", "Weekly planner · TrainGrid"],
    ["/week/2026-W47/add", "Add session · TrainGrid"],
    [`/week/2026-W47/add?routine=${routineId}`, "Schedule routine · TrainGrid"],
    ["/library/new", "New routine · TrainGrid"],
    [`/library/${routineId}`, "Routine · TrainGrid"],
    [`/library/${routineId}/edit`, "Edit routine · TrainGrid"],
    [`/session/${sessionId}`, "Session · TrainGrid"],
    [`/session/${sessionId}/edit`, "Edit schedule & details · TrainGrid"],
    [`/session/${sessionId}/customize`, "Edit exercises · TrainGrid"],
  ]) {
    await page.goto(path!);
    await expect(page, path).toHaveTitle(title!);
    // Names and notes stay out of titles (and so out of history).
    expect(await page.title()).not.toContain("Private");
  }
});

test("Add session's title follows the heading when the linked routine can't be used", async ({ page, browser, context, baseURL }) => {
  await signInAsNewLocalMember(context, baseURL!);
  const other = await signInAsNewLocalMember(await browser.newContext({ baseURL }), baseURL!);
  const theirs = await createLocalRoutineFor(other.userId, "Someone else's routine");
  for (const [path, title] of [
    [`/week/2026-W47/add?routine=${MISSING}`, "Add session"],
    [`/week/2026-W47/add?routine=${theirs}`, "Add session"],
    ["/week/2026-W47/add?template=no-such-routine", "Add session"],
    ["/week/2026-W47/add?template=easy-run", "Schedule routine"],
  ]) {
    await page.goto(path!);
    await expect(page.getByRole("heading", { level: 1 }), path).toHaveText(title!);
    await expect(page, path).toHaveTitle(`${title} · TrainGrid`);
  }
});

for (const scheme of ["light", "dark"] as const) {
  test(`a missing routine recovers to the Library in the ${scheme} theme`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, colorScheme: scheme, timezoneId: "UTC" });
    try {
      await signInAsNewLocalMember(context, baseURL!);
      const page = await context.newPage();
      const response = await page.goto(`/library/${MISSING}`);
      expect(response?.status()).toBe(404);
      await expect(page.getByRole("heading", { name: "Not found" })).toBeVisible();
      await expect
        .poll(() => page.evaluate(() => document.documentElement.classList.contains("dark")))
        .toBe(scheme === "dark");

      // Another member's routine reads exactly the same.
      const message = await page.getByRole("main").innerText();
      const other = await signInAsNewLocalMember(await browser.newContext({ baseURL }), baseURL!);
      const theirs = await createLocalRoutineFor(other.userId, "Someone else's routine");
      await page.goto(`/library/${theirs}`);
      expect(await page.getByRole("main").innerText()).toBe(message);

      await page.getByRole("link", { name: "Back to Library" }).click();
      await page.waitForURL(/\/library$/);
    } finally {
      await context.close();
    }
  });
}

test("a missing session keeps the dark theme and the planner exit", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, colorScheme: "dark", timezoneId: "UTC" });
  try {
    await signInAsNewLocalMember(context, baseURL!);
    const page = await context.newPage();
    expect((await page.goto(`/session/${MISSING}`))?.status()).toBe(404);
    await expect(page.getByText("This page doesn’t exist, or it’s no longer available.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to planner" })).toHaveAttribute("href", "/week/current");
    await expect
      .poll(() => page.evaluate(() => document.documentElement.classList.contains("dark")))
      .toBe(true);
  } finally {
    await context.close();
  }
});
