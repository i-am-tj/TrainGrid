import { expect, test, type Page } from "@playwright/test";
import { hasLocalSecretKey, signInAsNewLocalMember, supabaseState } from "./local-supabase";
import { createRoutine } from "./planner-helpers";

/**
 * Shared routine cards and detail, and scheduling from the library
 * (Epic 2, E2-03 and E2-05). Each test runs as a fresh member.
 */

test.beforeEach(async ({ context, baseURL }) => {
  test.skip((await supabaseState(baseURL!)) !== "ok", "Local Supabase stack is not running");
  test.skip(!hasLocalSecretKey(), "SUPABASE_SECRET_KEY is not set for the local stack");
  await signInAsNewLocalMember(context, baseURL!);
});

const card = (page: Page, name: string) =>
  page.locator("main section li").filter({ hasText: new RegExp(`^${name}`) });
const routineSelect = (page: Page) => page.locator("select").filter({ has: page.locator("optgroup") });

test("cards show how many items a routine has and the equipment it uses", async ({ page }) => {
  await page.goto("/library");
  // Canonical equipment order, each tag once, from every item of Lower B.
  await expect(card(page, "Lower B").getByText("6 items · Bodyweight, Dumbbell, Barbell, Machine, Bench")).toBeVisible();
  // No equipment is claimed where the content names none.
  await expect(card(page, "Easy Run").getByText("5 items", { exact: true })).toBeVisible();
});

test("a GLOBAL routine's detail shows everything it asks for, read-only", async ({ page }) => {
  await page.goto("/library");
  await card(page, "Easy Run").getByRole("link", { name: /^Easy Run/ }).click();
  await expect(page.getByRole("heading", { name: "Easy Run", level: 1 })).toBeVisible();
  await expect(page.getByRole("main").getByText("TrainGrid", { exact: true })).toBeVisible();
  await expect(page.getByText("Running · Easy aerobic run. Keep it conversational.")).toBeVisible();
  await expect(page.getByText("5 items", { exact: true })).toBeVisible();

  // Advisory items are content too: shown in order, nothing dropped.
  await expect(page.locator("main section h2")).toHaveText(["Warm-up", "Main", "Recovery", "Cooldown", "Progression"]);

  // Read-only: nothing to edit or delete.
  await expect(page.getByRole("link", { name: /edit/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /delete|save/i })).toHaveCount(0);

  await page.getByRole("link", { name: "← Back to Library" }).click();
  await expect(page).toHaveURL(/\/library$/);
});

test("Schedule is the primary action on detail and preselects the routine", async ({ page }) => {
  await page.goto("/library/lower-a");
  const schedule = page.getByRole("link", { name: "Schedule Lower A" });
  await expect(schedule).toHaveClass(/bg-stone-900/);
  await schedule.click();
  await expect(page).toHaveURL(/\/week\/current\/add\?routine=[0-9a-f-]{36}$/);
  await expect(routineSelect(page).locator("option:checked")).toHaveText("Lower A");

  await page.locator('select[name="day"]').selectOption("3");
  await page.locator('select[name="time"]').selectOption("07:00");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.waitForURL(/\/week\//);
  await page.getByRole("link", { name: "Lower A, 07:00" }).click();
  await expect(page.getByRole("heading", { name: "Back Squat" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Romanian Deadlift" })).toBeVisible();
});

test("Schedule on a list card preselects that routine", async ({ page }) => {
  await page.goto("/library?scope=global&type=running");
  await page.getByRole("link", { name: "Schedule Tempo / Threshold" }).click();
  await expect(page).toHaveURL(/\/week\/current\/add\?routine=[0-9a-f-]{36}$/);
  await expect(routineSelect(page).locator("option:checked")).toHaveText("Tempo / Threshold");
});

test("a personal routine's detail keeps Edit, labelled Mine", async ({ page }) => {
  await createRoutine(page, "My Detail Lift", "strength", [["Squat", "3 × 5"]]);
  await page.goto("/library?scope=mine");
  await page.getByRole("link", { name: /^My Detail Lift/ }).click();
  await expect(page.getByRole("heading", { name: "My Detail Lift", level: 1 })).toBeVisible();
  await expect(page.getByRole("main").getByText("Mine", { exact: true })).toBeVisible();
  await expect(page.getByText("1 item", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Schedule My Detail Lift" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Edit routine" })).toBeVisible();
});

test("video links say what they show and that they open a new tab", async ({ page }) => {
  await createRoutine(page, "My Demo Lift", "strength", [
    ["Goblet Squat", "3 × 10", { video: "https://youtu.be/dQw4w9WgXcQ" }],
  ]);
  await page.goto("/library?scope=mine");
  await page.getByRole("link", { name: /^My Demo Lift/ }).click();
  const demo = page.getByRole("link", { name: "Watch demo of Goblet Squat on YouTube (opens in a new tab)" });
  await expect(demo).toHaveAttribute("href", "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  await expect(demo).toHaveAttribute("target", "_blank");
  await expect(demo).toHaveAttribute("rel", "noopener noreferrer");
});

test("detail pages fit a phone screen", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  for (const slug of ["lower-b", "easy-run", "tempo-run"]) {
    await page.goto(`/library/${slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 4,
    );
    expect(overflow, slug).toBe(false);
  }
});

test("detail actions work from the keyboard", async ({ page }) => {
  await page.goto("/library/lower-a");
  await page.getByRole("link", { name: "← Back to Library" }).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Schedule Lower A" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/week\/current\/add\?routine=/);
});
