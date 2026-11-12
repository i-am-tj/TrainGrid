import { readFileSync } from "fs";
import { expect, test } from "@playwright/test";
import { signInAsNewLocalMember } from "./local-supabase";
import { createRoutine, fillItem, scheduleRoutine } from "./planner-helpers";

// Every test runs as a brand-new member, so each starts with an empty calendar.
test.beforeEach(async ({ context, baseURL }) => {
  await signInAsNewLocalMember(context, baseURL!);
});

test("Journey 1 — first training plan from a personal routine", async ({ page }) => {
  await createRoutine(page, "My Lower", "strength", [
    ["Back Squat", "3 × 6–8", { rest: "2 min", target: "RPE 7–8" }],
    ["Romanian Deadlift", "3 × 8–10"],
    ["Bulgarian Split Squat", "3 × 10 / leg"],
  ]);

  await scheduleRoutine(page, "My Lower", "1", "08:00");
  await page.getByRole("link", { name: "My Lower, 08:00" }).click();
  await expect(page.getByRole("heading", { name: "My Lower" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Back Squat" })).toBeVisible();
  await expect(page.getByText("3 × 6–8")).toBeVisible();
  await expect(page.getByText("RPE 7–8")).toBeVisible();
  await expect(page.getByText(/Copied from/)).toBeVisible();
  await expect(page.getByRole("button", { name: /start workout|log weight|complete set/i })).toHaveCount(0);
});

test("Journey 2 — a GLOBAL routine on the calendar, with notes", async ({ page }) => {
  await scheduleRoutine(page, "VO2max", "3", "07:00");
  await page.getByRole("link", { name: "VO2max, 07:00" }).click();
  await expect(page.locator("section").first()).toBeVisible();
  await page.getByRole("link", { name: "Edit" }).click();
  await page.getByLabel("Notes").fill("Track if windy");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Track if windy")).toBeVisible();
});

test("Journey 3 — multi-session day, timed and untimed, then reschedule", async ({ page }) => {
  await scheduleRoutine(page, "Speed / Power", "1", "07:00");
  await scheduleRoutine(page, "Lower B", "1", "08:30");

  await page.goto("/week/current/add?day=1&untimed=1");
  await page.getByRole("radio", { name: "Blank" }).check();
  await page.getByLabel("Name", { exact: true }).fill("Mobility");
  await fillItem(page, 0, "Hip openers", "10 min");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.waitForURL(/\/week\//);

  await expect(page.getByRole("link", { name: "Speed / Power, 07:00" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Lower B, 08:30" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Mobility, no time" }).first()).toBeVisible();

  await page.getByRole("link", { name: "Lower B, 08:30" }).click();
  await page.getByRole("link", { name: "Edit" }).click();
  await page.locator('select[name="day"]').selectOption("2");
  await page.locator('select[name="time"]').selectOption("18:00");
  await page.getByRole("button", { name: "Save" }).click();

  await page.goto("/");
  await expect(page.getByRole("link", { name: "Speed / Power, 07:00" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Lower B, 08:30" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Lower B, 18:00" })).toBeVisible();
});

test("rescheduling to a week that does not exist is refused", async ({ page }) => {
  await scheduleRoutine(page, "Easy Run", "2", "07:00");
  await page.getByRole("link", { name: "Easy Run, 07:00" }).click();
  await page.waitForURL(/\/session\/[0-9a-f-]{36}$/);
  const sessionUrl = page.url();
  await page.getByRole("link", { name: "Edit" }).click();
  await page.getByLabel("Week (YYYY-Www)").fill("2026-W60");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { name: "Could not complete that action" })).toBeVisible();

  await page.goto(sessionUrl);
  await expect(page.getByText(/· 07:00/)).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Easy Run, 07:00" })).toBeVisible();
});

test("Journey 4 — duplicate week copies independent sessions", async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
  await scheduleRoutine(page, "Easy Run", "2", "07:00");

  const heading = await page.getByRole("heading", { level: 1 }).innerText();
  await page.getByRole("button", { name: "Duplicate week" }).click();
  await expect(page.getByRole("link", { name: "Easy Run, 07:00" })).toBeVisible();
  expect(await page.getByRole("heading", { level: 1 }).innerText()).not.toBe(heading);

  await page.getByRole("link", { name: "Easy Run, 07:00" }).click();
  await page.getByRole("link", { name: "Edit" }).click();
  await page.getByLabel("Notes").fill("Copied week only");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Copied week only")).toBeVisible();

  await page.goto("/");
  await page.getByRole("link", { name: "Easy Run, 07:00" }).click();
  await expect(page.getByText("Copied week only")).toHaveCount(0);
});

test("D2, D3: editing or deleting a routine never changes a scheduled session", async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
  const routineUrl = await createRoutine(page, "My Tempo", "running", [["Tempo", "20 min"]]);
  await scheduleRoutine(page, "My Tempo", "4", "07:00");

  await page.goto(`${routineUrl}/edit`);
  await page.getByRole("textbox", { name: "Instruction" }).first().fill("40 min");
  await page.getByRole("button", { name: "Save" }).click();
  await page.waitForURL(/\/library\/[0-9a-f-]{36}$/);

  await page.goto("/");
  await page.getByRole("link", { name: "My Tempo, 07:00" }).click();
  await page.waitForURL(/\/session\/[0-9a-f-]{36}$/);
  await expect(page.getByText("20 min", { exact: true })).toBeVisible();
  await expect(page.getByText("40 min")).toHaveCount(0);
  const sessionUrl = page.url();

  await page.goto(`${routineUrl}/edit`);
  await page.getByRole("button", { name: "Delete routine" }).click();
  await page.waitForURL(/\/library$/);

  await page.goto(sessionUrl);
  await expect(page.getByText("20 min", { exact: true })).toBeVisible();
  await expect(page.getByText(/Not linked to a routine/)).toBeVisible();
});

test("D4: customising one session leaves its routine alone", async ({ page }) => {
  await scheduleRoutine(page, "Lower A", "5", "06:00");
  await page.getByRole("link", { name: "Lower A, 06:00" }).click();
  await page.getByRole("link", { name: "Customize content" }).click();
  await page.getByRole("textbox", { name: "Instruction" }).first().fill("5 × 3 heavy");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("5 × 3 heavy")).toBeVisible();

  await page.goto("/library");
  await page.getByRole("link", { name: /^Lower A/ }).click();
  await expect(page.getByText("4 × 5–6")).toBeVisible();
  await expect(page.getByText("5 × 3 heavy")).toHaveCount(0);
});

test("equipment and YouTube persist on a scheduled session", async ({ page }) => {
  await createRoutine(page, "My Video Lift", "strength", [
    ["Back Squat", "4 × 5–6", { equipment: ["Barbell"], video: "https://youtu.be/dQw4w9WgXcQ" }],
  ]);
  await scheduleRoutine(page, "My Video Lift", "1", "08:00");
  await page.getByRole("link", { name: "My Video Lift, 08:00" }).click();
  await expect(page.getByRole("heading", { name: "Back Squat" })).toBeVisible();
  await expect(page.getByLabel("Equipment").getByText("Barbell")).toBeVisible();
  const demo = page.getByRole("link", { name: /Watch demo/ });
  await expect(demo).toHaveAttribute("href", "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
});

test("D10, D12: export holds only my data; there is no import", async ({ page }) => {
  await createRoutine(page, "My Export Routine", "other", [["Step", "Do it"]]);
  await scheduleRoutine(page, "Lower A", "2", "07:00");

  await expect(page.getByLabel("Import")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /import/i })).toHaveCount(0);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Export" }).click();
  const download = await downloadPromise;
  const path = test.info().outputPath("export.json");
  await download.saveAs(path);
  const data = JSON.parse(readFileSync(path, "utf8"));

  expect(data).toMatchObject({ format: "traingrid-export", version: 2 });
  expect(data.routines.map((r: { name: string }) => r.name)).toEqual(["My Export Routine"]);
  expect(data.sessions.map((s: { name: string }) => s.name)).toEqual(["Lower A"]);
  expect(JSON.stringify(data)).not.toMatch(/invitation|revoked_at|@example\.test/);
});

test("another member cannot open my session", async ({ page, browser, baseURL }) => {
  await scheduleRoutine(page, "Upper A", "3", "09:00");
  await page.getByRole("link", { name: "Upper A, 09:00" }).click();
  await page.waitForURL(/\/session\/[0-9a-f-]{36}$/);
  const sessionUrl = page.url();

  const other = await browser.newContext({ baseURL });
  try {
    await signInAsNewLocalMember(other, baseURL!);
    const otherPage = await other.newPage();
    const response = await otherPage.goto(sessionUrl);
    expect(response?.status()).toBe(404);
    await expect(otherPage.getByText("Upper A")).toHaveCount(0);
    await otherPage.goto("/");
    await expect(otherPage.getByRole("link", { name: "Upper A, 09:00" })).toHaveCount(0);
  } finally {
    await other.close();
  }
});
