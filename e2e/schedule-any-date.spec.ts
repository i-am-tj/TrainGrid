import { expect, test, type Page } from "@playwright/test";
import { addDays, mondayOfIsoWeek, weekDayOfDate } from "../lib/calendar-date";
import { todayIn } from "../lib/time-zone";
import { accessibilityResults } from "../tests/helpers/accessibility";
import { readRows, signInAsNewLocalMember } from "./local-supabase";
import { chooseDate } from "./planner-helpers";

/**
 * Library → chosen date → saved session, for any week (PRODUCT_AUDIT F2):
 * the routine stays selected, the member picks the real date, and finds the
 * session on that day after a reload. Moving a session uses the same field.
 */

async function hydrated(page: Page) {
  await page.waitForFunction(() => {
    const root = document.getElementById("main-content");
    return !!root && Object.keys(root).some((key) => key.startsWith("__reactFiber"));
  });
}

let userId: string;
test.beforeEach(async ({ context, baseURL }) => {
  ({ userId } = await signInAsNewLocalMember(context, baseURL!));
});

test("schedule a Library routine for next Monday and find it there after a reload", async ({ page }) => {
  const today = todayIn("UTC");
  const nextMonday = addDays(mondayOfIsoWeek(today.weekId), 7);
  const nextWeek = weekDayOfDate(nextMonday).weekId;

  await page.goto("/library/easy-run");
  await page.getByRole("link", { name: "Schedule Easy Run" }).click();
  await page.waitForURL(/\/add\?routine=/);
  await hydrated(page);

  const date = page.getByLabel("Date", { exact: true });
  await expect(date).toHaveValue(today.date);
  await expect(page.getByTestId("date-description")).toContainText("· today");
  await page.getByRole("group", { name: "Quick dates" }).getByRole("button", { name: "Next Monday" }).click();
  await expect(date).toHaveValue(nextMonday);
  await expect(page.getByTestId("date-description")).toContainText(/^Monday .* · (next week|tomorrow)$/);
  await expect(page.getByRole("button", { name: "Next Monday" })).toHaveAttribute("aria-pressed", "true");
  // Choosing the date kept the routine.
  await expect(page.locator("select").filter({ has: page.locator("optgroup") }).locator("option:checked")).toHaveText("Easy Run");
  const { violations } = await accessibilityResults(page);
  expect(violations).toEqual([]);

  await page.locator('select[name="time"]').selectOption("06:30");
  await page.getByRole("button", { name: "Schedule routine", exact: true }).click();
  await page.waitForURL(`/week/${nextWeek}?day=1`);

  await page.reload();
  await expect(page.getByRole("link", { name: "Easy Run, 06:30" })).toBeVisible();
  const [row] = await readRows("scheduled_sessions", { user_id: userId });
  expect(row).toMatchObject({ date: nextMonday, start_time: "06:30:00" });
});

test("move a session across the year boundary with the same date field", async ({ page }) => {
  await page.goto("/library/lower-a");
  await page.getByRole("link", { name: "Schedule Lower A" }).click();
  await page.waitForURL(/\/add\?routine=/);
  await hydrated(page);
  await chooseDate(page, "2026-12-31");
  await expect(page.getByTestId("date-description")).toContainText("Thursday 31 December 2026");
  await page.getByText("More options").click();
  await page.getByLabel("Notes").fill("Last one of the year");
  await page.getByRole("button", { name: "Schedule routine", exact: true }).click();
  await page.waitForURL("/week/2026-W53?day=4");

  await page.getByRole("link", { name: /^Lower A/ }).first().click();
  await page.waitForURL(/\/session\/[0-9a-f-]{36}$/);
  const sessionUrl = page.url();
  await page.getByRole("link", { name: "Edit schedule & details" }).click();
  await hydrated(page);
  await expect(page.getByLabel("Date", { exact: true })).toHaveValue("2026-12-31");
  await chooseDate(page, "2027-01-04");
  await expect(page.getByTestId("date-description")).toContainText("Monday 4 January 2027");
  await page.getByRole("button", { name: "Save" }).click();
  await page.waitForURL(sessionUrl);
  await expect(page.getByText(/Mon 4 Jan/)).toBeVisible();
  await expect(page.getByText("Last one of the year")).toBeVisible();

  await page.goto("/week/2027-W01?day=1");
  await expect(page.getByRole("link", { name: /^Lower A/ }).first()).toBeVisible();
});
