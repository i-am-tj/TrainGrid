import { expect, test } from "@playwright/test";
import { addWorkoutItem, resetData, saveTemplate, scheduleTemplate } from "./helpers";

test.beforeEach(async () => {
  await resetData();
});

test("Journey 1 — first training plan", async ({ page }) => {
  await page.goto("/library/new");
  await page.getByLabel("Name").fill("Lower A");
  await page.getByLabel("Type").selectOption("strength");
  await addWorkoutItem(page, 0, "Back Squat", "3 × 6–8");
  await addWorkoutItem(page, 1, "Romanian Deadlift", "3 × 8–10");
  await addWorkoutItem(page, 2, "Bulgarian Split Squat", "3 × 10 / leg");
  await saveTemplate(page);
  await expect(page.getByRole("heading", { name: "Lower A" })).toBeVisible();

  await scheduleTemplate(page, "Lower A", "1", "08:00");
  await expect(page.getByRole("link", { name: "Lower A, 08:00" })).toBeVisible();
  await page.getByRole("link", { name: "Lower A, 08:00" }).click();
  await expect(page.getByRole("heading", { name: "Lower A" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Back Squat" })).toBeVisible();
  await expect(page.getByText("3 × 6–8")).toBeVisible();
  await expect(page.getByRole("button", { name: /start workout|log weight|complete set/i })).toHaveCount(0);
});

test("Journey 2 — running session", async ({ page }) => {
  await page.goto("/library/new");
  await page.getByLabel("Name").fill("VO2 — 6 × 200m");
  await page.getByLabel("Type").selectOption("running");
  await addWorkoutItem(page, 0, "Warm-up", "1 km easy");
  await addWorkoutItem(page, 1, "Main", "6 × 200m hard\n200m walk/jog recovery");
  await addWorkoutItem(page, 2, "Cooldown", "1 km easy");
  await saveTemplate(page);

  await scheduleTemplate(page, "VO2", "3", "07:00");
  await expect(page.getByRole("link", { name: /VO2/ })).toBeVisible();
  await page.getByRole("link", { name: /VO2/ }).click();
  await expect(page.getByText("1 km easy").first()).toBeVisible();
  await page.getByRole("link", { name: "Edit" }).click();
  await page.getByLabel("Notes").fill("Track if windy");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Track if windy")).toBeVisible();
});

test("Journey 3 — multi-session day", async ({ page }) => {
  await page.goto("/library/new");
  await page.getByLabel("Name").fill("Speed Run");
  await page.getByLabel("Type").selectOption("running");
  await addWorkoutItem(page, 0, "Main", "Strides");
  await saveTemplate(page);

  await page.goto("/library/new");
  await page.getByLabel("Name").fill("Lower B");
  await page.getByLabel("Type").selectOption("strength");
  await addWorkoutItem(page, 0, "Deadlift", "3 × 4–6");
  await saveTemplate(page);

  await scheduleTemplate(page, "Speed Run", "1", "07:00");
  await scheduleTemplate(page, "Lower B", "1", "08:30");

  await expect(page.getByRole("link", { name: "Speed Run, 07:00" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Lower B, 08:30" })).toBeVisible();

  await page.getByRole("link", { name: "Lower B, 08:30" }).click();
  await page.getByRole("link", { name: "Edit" }).click();
  await page.locator('select[name="day"]').selectOption("2");
  await page.locator('select[name="time"]').selectOption("18:00");
  await page.getByRole("button", { name: "Save" }).click();

  await page.goto("/");
  await expect(page.getByRole("link", { name: "Speed Run, 07:00" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Lower B, 08:30" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Lower B, 18:00" })).toBeVisible();
});

test("Journey 4 — duplicate week", async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());

  await page.goto("/library/new");
  await page.getByLabel("Name").fill("Easy Run");
  await page.getByLabel("Type").selectOption("running");
  await addWorkoutItem(page, 0, "Main", "Easy");
  await saveTemplate(page);
  await scheduleTemplate(page, "Easy Run", "2", "07:00");

  const heading = await page.getByRole("heading", { level: 1 }).innerText();
  await page.getByRole("button", { name: "Duplicate week" }).click();
  await expect(page.getByRole("link", { name: "Easy Run, 07:00" })).toBeVisible();
  const copiedHeading = await page.getByRole("heading", { level: 1 }).innerText();
  expect(copiedHeading).not.toBe(heading);

  await page.getByRole("link", { name: "Easy Run, 07:00" }).click();
  await page.getByRole("link", { name: "Edit" }).click();
  await page.getByLabel("Notes").fill("Copied week only");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Copied week only")).toBeVisible();

  await page.goto("/");
  await page.getByRole("link", { name: "Easy Run, 07:00" }).click();
  await expect(page.getByText("Copied week only")).toHaveCount(0);
});

test("Journey 5 — export and import restore", async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());

  await page.goto("/library/new");
  await page.getByLabel("Name").fill("Tempo Run");
  await page.getByLabel("Type").selectOption("running");
  await addWorkoutItem(page, 0, "Tempo", "20 min");
  await saveTemplate(page);
  await scheduleTemplate(page, "Tempo Run", "5", "07:00");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Export" }).click();
  const download = await downloadPromise;
  const filePath = test.info().outputPath("backup.json");
  await download.saveAs(filePath);

  await resetData();
  await page.goto("/library");
  await expect(page.getByText("No templates yet.")).toBeVisible();

  await page.getByLabel("Import").setInputFiles(filePath);
  await expect(page).toHaveURL(/\/week\//);
  await expect(page.getByRole("link", { name: /Tempo Run/ })).toBeVisible();
  await page.goto("/library");
  await expect(page.getByRole("link", { name: /Tempo Run/ })).toBeVisible();
});

test("invalid import does not wipe existing data", async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/library/new");
  await page.getByLabel("Name").fill("Keep Me");
  await saveTemplate(page);
  await page.goto("/library");

  await page.getByLabel("Import").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from("{not-json"),
  });
  await expect(page.getByText("That file is not valid JSON.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Keep Me/ })).toBeVisible();
});
