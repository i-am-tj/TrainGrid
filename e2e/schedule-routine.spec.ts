import { expect, test, type Page } from "@playwright/test";
import { addDays } from "../lib/calendar-date";
import { todayIn } from "../lib/time-zone";
import {
  hasLocalSecretKey,
  readRows,
  signInAsNewLocalMember,
  supabaseState,
} from "./local-supabase";

/**
 * Scheduling a routine already chosen in the Library asks only for the day
 * and time; the rest is behind More options. The planner's Add session keeps
 * the full form (UI_DESIGN_AUDIT rank 7).
 */

let userId: string;

test.beforeEach(async ({ baseURL, context }) => {
  test.skip((await supabaseState(baseURL!)) !== "ok", "Local Supabase stack is not running");
  test.skip(!hasLocalSecretKey(), "Local Supabase secret key is not configured");
  ({ userId } = await signInAsNewLocalMember(context, baseURL!));
});

async function openFromLibrary(page: Page) {
  await page.goto("/library/easy-run");
  await page.getByRole("link", { name: "Schedule Easy Run" }).click();
  await page.waitForURL(/\/week\/\d{4}-W\d{2}\/add\?routine=/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Schedule routine");
  await expect(page.getByTestId("scheduling-routine")).toContainText("Easy Run");
}

test("a known routine is scheduled with just a date and time, and reopens as planned", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openFromLibrary(page);
  // Only the routine, date and time lead; the rest waits behind More options.
  await expect(page.getByRole("radio", { name: "Blank" })).toHaveCount(0);
  await expect(page.getByLabel("Name", { exact: true })).toBeHidden();
  await expect(page.getByLabel("Notes")).toBeHidden();
  const submit = page.getByRole("button", { name: "Schedule routine", exact: true });
  await expect(submit).toBeInViewport();

  await page.getByRole("group", { name: "Quick dates" }).getByRole("button", { name: "Tomorrow" }).click();
  await page.locator('select[name="time"]').selectOption("06:30");
  await submit.click();
  await page.waitForURL(/\/week\/\d{4}-W\d{2}\?day=\d$/);

  const [row] = await readRows("scheduled_sessions", { user_id: userId });
  expect(row).toMatchObject({
    name: "Easy Run",
    date: addDays(todayIn("UTC").date, 1),
    start_time: "06:30:00",
  });
  await page.goto(`/session/${row!.id}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Easy Run");
});

test("an untimed session with a custom name uses More options", async ({ page }) => {
  await openFromLibrary(page);
  await page.getByLabel("No start time").check();
  await page.getByText("More options").click();
  await expect(page.locator("select").filter({ has: page.locator("optgroup") }).locator("option:checked")).toHaveText("Easy Run");
  await page.getByLabel("Name", { exact: true }).fill("Easy Run in the park");
  await page.getByLabel("Notes").fill("Bring water");
  await page.getByRole("button", { name: "Schedule routine", exact: true }).click();
  await page.waitForURL(/\/week\/\d{4}-W\d{2}\?day=\d$/);
  const [row] = await readRows("scheduled_sessions", { user_id: userId });
  expect(row).toMatchObject({ name: "Easy Run in the park", start_time: null, notes: "Bring water" });
});

test("Cancel returns to the routine", async ({ page }) => {
  await openFromLibrary(page);
  const routineUrl = new URL(page.url()).searchParams.get("routine");
  await page.getByRole("link", { name: "Cancel" }).click();
  await page.waitForURL(`/library/${routineUrl}`);
});

test("Add session from the planner keeps the full form, including blank sessions", async ({ page }) => {
  await page.goto("/week/current/add");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Add session");
  await expect(page.getByTestId("scheduling-routine")).toHaveCount(0);
  await page.getByRole("radio", { name: "Blank", exact: true }).check();
  await page.getByLabel("Name", { exact: true }).fill("Hill sprints");
  await expect(page.getByLabel("Type")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Notes", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.waitForURL(/\/week\/\d{4}-W\d{2}\?day=\d$/);
  const [row] = await readRows("scheduled_sessions", { user_id: userId });
  expect(row).toMatchObject({ name: "Hill sprints" });
});

for (const { field, bad, good, saved } of [
  { field: "Name", bad: "", good: "Park run", saved: { name: "Park run" } },
  { field: "Duration (minutes, optional)", bad: "0", good: "45", saved: { duration_minutes: 45 } },
] as const) {
  test(`an invalid ${field} hidden in collapsed More options opens and takes focus`, async ({ page }) => {
    await openFromLibrary(page);
    const moreOptions = page.locator("summary", { hasText: "More options" });
    const input = page.getByLabel(field, { exact: true });
    const submit = page.getByRole("button", { name: "Schedule routine", exact: true });

    // Collapse → submit: the browser blocks the submit, and the field must be
    // shown and focused rather than left invalid out of sight.
    await moreOptions.click();
    await input.fill(bad);
    await moreOptions.click();
    await expect(input).toBeHidden();
    const formUrl = page.url();
    await submit.click();
    await expect(input).toBeVisible();
    await expect(input).toBeFocused();
    expect(page.url()).toBe(formUrl);
    expect(await readRows("scheduled_sessions", { user_id: userId })).toHaveLength(0);

    // Correct → resubmit.
    await input.fill(good);
    await submit.click();
    await page.waitForURL(/\/week\/\d{4}-W\d{2}\?day=\d$/);
    const [row] = await readRows("scheduled_sessions", { user_id: userId });
    expect(row).toMatchObject(saved);
  });
}
