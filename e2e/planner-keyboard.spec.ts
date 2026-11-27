import { expect, test, type Page } from "@playwright/test";
import {
  hasLocalSecretKey,
  serviceClient,
  signInAsNewLocalMember,
  supabaseState,
} from "./local-supabase";

/**
 * Keyboard path through the desktop week grid (UI_DESIGN_AUDIT rank 3): Tab
 * visits only scheduled sessions, arrow keys choose an empty slot, Escape
 * leaves slot selection.
 */

let userId: string;

test.beforeEach(async ({ baseURL, page, context }) => {
  test.skip((await supabaseState(baseURL!)) !== "ok", "Local Supabase stack is not running");
  test.skip(!hasLocalSecretKey(), "Local Supabase secret key is not configured");
  await page.setViewportSize({ width: 1366, height: 900 });
  const member = await signInAsNewLocalMember(context, baseURL!);
  userId = member.userId;
  for (const [name, time] of [
    ["Evening strength", null],
    ["Lunch run", "12:00"],
  ] as const) {
    const { error } = await serviceClient().from("scheduled_sessions").insert({
      user_id: member.userId,
      date: "2026-11-17",
      start_time: time,
      name,
      category: "strength",
      snapshot: { version: 1, items: [] },
    });
    if (error) throw new Error(error.message);
  }
  await page.goto("/week/2026-W47");
  await expect.poll(() => grid(page).evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
});

function grid(page: Page) {
  return page.getByRole("region", { name: "Weekly calendar time grid" });
}

function focusedLabel(page: Page) {
  return page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? null);
}

test("Tab visits the grid, each session, then leaves", async ({ page }) => {
  const region = grid(page);
  await expect(region.locator('a:not([tabindex="-1"])')).toHaveCount(2);
  await region.focus();
  await page.keyboard.press("Tab");
  expect(await focusedLabel(page)).toBe("Evening strength, no time");
  await page.keyboard.press("Tab");
  expect(await focusedLabel(page)).toBe("Lunch run, 12:00");
  await page.keyboard.press("Tab");
  expect(await region.evaluate((el) => el.contains(document.activeElement))).toBe(false);

  // Either session opens from the keyboard.
  await region.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/session\/[0-9a-f-]{36}$/);
});

test("arrow keys choose a slot, Enter adds there and Escape returns to the grid", async ({ page }) => {
  const region = grid(page);
  await region.focus();
  // The first arrow enters slot selection at Monday, the first hour in view.
  await page.keyboard.press("ArrowDown");
  expect(await focusedLabel(page)).toMatch(/^Add session .+ 06:00$/);
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const label = (await focusedLabel(page))!;
  expect(label).toMatch(/^Add session .+ 07:00$/);
  await expect(page.locator(":focus")).toBeInViewport();

  // Up past 00:00 reaches the untimed row, pinned above the hours.
  for (let i = 0; i < 8; i++) await page.keyboard.press("ArrowUp");
  expect(await focusedLabel(page)).toMatch(/^Add untimed session /);
  await expect(page.locator(":focus")).toBeInViewport();
  await page.keyboard.press("ArrowDown");
  expect(await focusedLabel(page)).toMatch(/ 00:00$/);

  await page.keyboard.press("Escape");
  await expect(region).toBeFocused();

  // From a session card, arrows continue from its slot.
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  expect(await focusedLabel(page)).toBe("Lunch run, 12:00");
  await page.keyboard.press("ArrowDown");
  expect(await focusedLabel(page)).toMatch(/^Add session .+ 13:00$/);
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/week\/2026-W47\/add\?day=1&time=12:00$/);
});

test("arrows reach an untimed row that scrolls with the hours", async ({ page }) => {
  // A long untimed list in a short landscape window is not pinned (see
  // planner-grid.spec.ts), so reaching it scrolls it back below the headings.
  for (const name of ["Mobility", "Core", "Stretch", "Balance"]) {
    const { error } = await serviceClient().from("scheduled_sessions").insert({
      user_id: userId,
      date: "2026-11-17",
      start_time: null,
      name,
      category: "strength",
      snapshot: { version: 1, items: [] },
    });
    if (error) throw new Error(error.message);
  }
  await page.setViewportSize({ width: 844, height: 390 });
  await page.reload();
  await expect(page.getByTestId("planner-untimed")).not.toHaveAttribute("data-pinned");

  const region = grid(page);
  await region.focus();
  // The list fills the view, so the first arrow enters at 00:00, just below it.
  await page.keyboard.press("ArrowDown");
  expect(await focusedLabel(page)).toMatch(/ 00:00$/);
  for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowDown");
  await expect.poll(() => region.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  for (let i = 0; i < 11; i++) await page.keyboard.press("ArrowUp");
  expect(await focusedLabel(page)).toMatch(/^Add untimed session /);
  // On screen and not under the pinned headings.
  const uncovered = () =>
    page.evaluate(() => {
      const el = document.activeElement!;
      const box = el.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return hit !== null && el.contains(hit);
    });
  await expect.poll(uncovered).toBe(true);
});
