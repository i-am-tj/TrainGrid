import { expect, test, type Page } from "@playwright/test";
import {
  hasLocalSecretKey,
  serviceClient,
  signInAsNewLocalMember,
  supabaseState,
} from "./local-supabase";

/** The desktop week grid shows every saved session on entry (UI_DESIGN_AUDIT rank 2). */

test.beforeEach(async ({ baseURL, page }) => {
  test.skip((await supabaseState(baseURL!)) !== "ok", "Local Supabase stack is not running");
  test.skip(!hasLocalSecretKey(), "Local Supabase secret key is not configured");
  await page.setViewportSize({ width: 1366, height: 900 });
});

async function plan(userId: string, name: string, date: string, time: string | null) {
  const { error } = await serviceClient()
    .from("scheduled_sessions")
    .insert({
      user_id: userId,
      date,
      start_time: time,
      name,
      category: "strength",
      snapshot: { version: 1, items: [] },
    });
  if (error) throw new Error(error.message);
}

/** Opens the week and waits for the grid to set its starting scroll position. */
async function openWeek(page: Page) {
  await page.goto("/week/2026-W47");
  await expect(grid(page)).toBeVisible();
  await expect.poll(() => grid(page).evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
}

function grid(page: Page) {
  return page.getByRole("region", { name: "Weekly calendar time grid" });
}

/**
 * Whether a session card is really on screen inside the grid: not scrolled out
 * of view and not covered by the pinned headings. Polled, because the grid
 * sets its starting scroll position after hydration.
 */
async function visibleInGrid(page: Page, name: string) {
  const card = grid(page).getByRole("link", { name, exact: true });
  await expect(card).toBeAttached();
  const shown = () =>
    card.evaluate((el) => {
      const box = el.getBoundingClientRect();
      const x = box.left + box.width / 2;
      return [box.top + 2, box.bottom - 2].every((y) => {
        const hit = document.elementFromPoint(x, y);
        return hit !== null && el.contains(hit);
      });
    });
  try {
    await expect.poll(shown, { timeout: 3_000 }).toBe(true);
    return true;
  } catch {
    return false;
  }
}

test("a timed and an untimed session are both visible on entry", async ({ page, context, baseURL }) => {
  const member = await signInAsNewLocalMember(context, baseURL!);
  await plan(member.userId, "Evening strength", "2026-11-17", null);
  await plan(member.userId, "Lunch run", "2026-11-17", "12:00");
  await openWeek(page);
  expect(await visibleInGrid(page, "Evening strength, no time")).toBe(true);
  expect(await visibleInGrid(page, "Lunch run, 12:00")).toBe(true);
  // Still opens at 06:00, just below the pinned row.
  await expect.poll(() => grid(page).evaluate((el) => el.scrollTop)).toBeGreaterThan(250);

  // Untimed work stays pinned while the hours scroll.
  await grid(page).evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  expect(await visibleInGrid(page, "Evening strength, no time")).toBe(true);
});

test("several untimed sessions stay pinned; an empty week opens at 06:00", async ({ page, context, baseURL }) => {
  const member = await signInAsNewLocalMember(context, baseURL!);
  await openWeek(page);
  // Nothing untimed: the untimed row scrolls away with the hours.
  await expect(page.getByTestId("planner-untimed")).not.toHaveAttribute("data-pinned");
  const sixAm = grid(page).locator('[data-hour="6"]');
  await expect.poll(() => sixAm.evaluate((el) => {
    const region = el.closest('[role="region"]')!;
    const pinned = region.querySelector('[data-testid="planner-pinned"]')!;
    return Math.abs(el.getBoundingClientRect().top - pinned.getBoundingClientRect().bottom) <= 2;
  })).toBe(true);

  await plan(member.userId, "Mobility", "2026-11-16", null);
  await plan(member.userId, "Core", "2026-11-16", null);
  await plan(member.userId, "Stretch", "2026-11-20", null);
  await openWeek(page);
  for (const name of ["Mobility", "Core", "Stretch"])
    expect(await visibleInGrid(page, `${name}, no time`), name).toBe(true);
});

test("a long untimed list in a landscape window scrolls with the hours", async ({ page, context, baseURL }) => {
  const member = await signInAsNewLocalMember(context, baseURL!);
  for (const name of ["Mobility", "Core", "Stretch", "Balance", "Recovery walk"])
    await plan(member.userId, name, "2026-11-18", null);
  await plan(member.userId, "Evening ride", "2026-11-18", "18:00");
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/week/2026-W47");
  await expect(grid(page)).toBeVisible();

  // Pinning this list would cover the hours, so only the day headings stay put
  // and the list opens at the top of the scrolling grid.
  await expect(page.getByTestId("planner-untimed")).not.toHaveAttribute("data-pinned");
  const untimed = page.getByTestId("planner-untimed").getByRole("link", { name: /, no time$/ });
  await expect(untimed).toHaveCount(5);
  const first = (await untimed.first().getAttribute("aria-label"))!;
  const last = (await untimed.last().getAttribute("aria-label"))!;
  expect(await visibleInGrid(page, first), first).toBe(true);

  for (const name of [last, "Evening ride, 18:00"]) {
    await grid(page).getByRole("link", { name, exact: true }).scrollIntoViewIfNeeded();
    expect(await visibleInGrid(page, name), name).toBe(true);
  }
  // Day headings stay pinned while the hours scroll.
  await expect.poll(() => page.getByTestId("planner-pinned").evaluate((el) => {
    const region = el.closest('[role="region"]')!;
    return Math.abs(el.getBoundingClientRect().top - region.getBoundingClientRect().top) <= 2;
  })).toBe(true);

  // Back at desktop size there is room again, so the list is pinned.
  await page.setViewportSize({ width: 1366, height: 900 });
  await expect(page.getByTestId("planner-untimed")).toHaveAttribute("data-pinned");
});

test("a session before 06:00 is visible on entry", async ({ page, context, baseURL }) => {
  const member = await signInAsNewLocalMember(context, baseURL!);
  await plan(member.userId, "Dawn run", "2026-11-18", "04:30");
  await openWeek(page);
  expect(await visibleInGrid(page, "Dawn run, 04:30")).toBe(true);
});

test("the phone agenda is unchanged", async ({ page, context, baseURL }) => {
  const member = await signInAsNewLocalMember(context, baseURL!);
  await plan(member.userId, "Evening strength", "2026-11-17", null);
  await plan(member.userId, "Lunch run", "2026-11-17", "12:00");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/week/2026-W47?day=2");
  await expect(grid(page)).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Evening strength/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Lunch run/ })).toBeVisible();
});
