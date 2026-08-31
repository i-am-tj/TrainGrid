import { expect, test } from "@playwright/test";
import { addWorkoutItem, resetData, saveTemplate, scheduleTemplate } from "./helpers";

test.beforeEach(async () => {
  await resetData();
});

test("planner shows seven days Monday to Sunday", async ({ page }) => {
  await page.goto("/");
  for (const day of ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]) {
    await expect(page.getByText(day, { exact: true }).first()).toBeVisible();
  }
  await page.getByRole("link", { name: "Next week" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Week of");
  await page.getByRole("link", { name: "Previous week" }).click();
  await page.getByRole("link", { name: "Previous week" }).click();
  await page.getByRole("link", { name: "Today" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Week of");
});

test("empty states offer a way to add", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("No sessions this week.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Add session" }).first()).toBeVisible();
  await page.goto("/library");
  await expect(page.getByText("No templates yet.")).toBeVisible();
  await expect(page.getByRole("link", { name: "New template" })).toBeVisible();
});

test("deleting a template keeps the scheduled session", async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/library/new");
  await page.getByLabel("Name").fill("Lower A");
  await page.getByLabel("Type").selectOption("strength");
  await addWorkoutItem(page, 0, "Back Squat", "3 × 6–8");
  await saveTemplate(page);
  await scheduleTemplate(page, "Lower A", "1", "08:00");

  await page.goto("/library/lower-a");
  await page.getByRole("button", { name: "Delete template" }).click();
  await expect(page.getByText("No templates yet.")).toBeVisible();

  await page.goto("/");
  await page.getByRole("link", { name: "Lower A, 08:00" }).click();
  await expect(page.getByRole("heading", { name: "Back Squat" })).toBeVisible();
  await expect(
    page.getByText(/own copy|Not linked to a template/),
  ).toBeVisible();
});

test("editing a template body updates a live-linked session only", async ({ page }) => {
  await page.goto("/library/new");
  await page.getByLabel("Name").fill("Lower A");
  await page.getByLabel("Type").selectOption("strength");
  await addWorkoutItem(page, 0, "Back Squat", "3 × 6–8");
  await saveTemplate(page);
  await scheduleTemplate(page, "Lower A", "1", "08:00");

  await page.goto("/library/lower-a");
  await page.getByRole("textbox", { name: /^Details/ }).first().fill("4 × 5–6");
  await page.getByRole("button", { name: "Save" }).click();
  await page.goto("/library/lower-a");
  await expect(page.getByRole("textbox", { name: /^Details/ }).first()).toHaveValue(
    "4 × 5–6",
  );

  await page.goto("/");
  await page.getByRole("link", { name: "Lower A, 08:00" }).click();
  await expect(page.getByText("4 × 5–6")).toBeVisible();
});

test("mobile agenda is used at a phone width", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Next day" })).toBeVisible();
  await expect(page.getByRole("link", { name: "+ Add" })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 4,
  );
  expect(overflow).toBe(false);
});
