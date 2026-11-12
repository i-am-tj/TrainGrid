import { expect, test } from "@playwright/test";
import { signInAsNewLocalMember } from "./local-supabase";
import { createRoutine, fillItem } from "./planner-helpers";

// Every test runs as a brand-new member, so each starts with an empty calendar.
test.beforeEach(async ({ context, baseURL }) => {
  await signInAsNewLocalMember(context, baseURL!);
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

test("story 14: no read-only or 'clone this repo' notice remains", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/read-only|clone this repo|peeking at/i)).toHaveCount(0);
  await expect(page.getByText("Published", { exact: false })).toHaveCount(0);
});

test("empty states offer a way to add", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("No sessions this week.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Add session" }).first()).toBeVisible();
  await page.goto("/library");
  await expect(page.getByRole("link", { name: "New routine" })).toBeVisible();
});

test("library filters use plyometrics not mobility", async ({ page }) => {
  await page.goto("/library");
  await expect(page.getByRole("link", { name: "Plyometrics", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Other", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Mobility", exact: true })).toHaveCount(0);
});

test("D-05: GLOBAL routines are readable, structured and not editable", async ({ page }) => {
  await page.goto("/library");
  await page.getByRole("link", { name: /^Lower A/ }).click();
  await expect(page.getByRole("heading", { name: "Lower A", level: 1 })).toBeVisible();
  await expect(page.getByText("TrainGrid library · read-only")).toBeVisible();

  const squat = page.locator("section").filter({ has: page.getByRole("heading", { name: "Back Squat" }) });
  await expect(squat.getByText("4 × 5–6")).toBeVisible();
  await expect(squat.getByText("2–3 min")).toBeVisible();
  await expect(squat.getByText("RPE 7–8")).toBeVisible();
  await expect(squat.getByLabel("Equipment").getByText("Barbell")).toBeVisible();

  await expect(page.getByRole("link", { name: "Edit routine" })).toHaveCount(0);
  const response = await page.goto(`${page.url()}/edit`);
  expect(response?.status()).toBe(404);
});

test("D9: a member creates, views, edits and deletes their own routine", async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
  await createRoutine(page, "My Lower", "strength", [
    ["Back Squat", "3 × 6–8", { rest: "2 min", target: "RPE 7", equipment: ["Barbell"] }],
  ]);
  await expect(page.getByText("Your routine")).toBeVisible();
  await expect(page.getByText("3 × 6–8")).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveCount(0);

  await page.getByRole("link", { name: "Edit routine" }).click();
  await expect(page.getByRole("textbox", { name: "Workout item 1", exact: true })).toHaveValue("Back Squat");
  await expect(page.getByRole("textbox", { name: "Rest" })).toHaveValue("2 min");
  await page.getByRole("textbox", { name: "Instruction" }).first().fill("4 × 5");
  await fillItem(page, 1, "Calf Raise", "3 × 12");
  await page.getByRole("button", { name: "Save" }).click();
  await page.waitForURL(/\/library\/[0-9a-f-]{36}$/);
  await expect(page.getByText("4 × 5", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Calf Raise" })).toBeVisible();

  await page.getByRole("link", { name: "Edit routine" }).click();
  await page.getByRole("button", { name: "Delete routine" }).click();
  await expect(page).toHaveURL(/\/library$/);
  await expect(page.getByText("My Lower")).toHaveCount(0);
});

test("D6: structured fields stay apart; 'Rest:' typed in notes stays in notes", async ({ page }) => {
  await createRoutine(page, "My Notes Test", "other", [
    ["Plank", "3 × 45 s", { notes: "Rest: whenever" }],
  ]);
  await expect(page.getByText("Rest: whenever")).toBeVisible();
  await page.getByRole("link", { name: "Edit routine" }).click();
  await expect(page.getByRole("textbox", { name: "Rest" })).toHaveValue("");
  await expect(page.getByRole("textbox", { name: "Notes" })).toHaveValue("Rest: whenever");
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

test("legacy library links still reach the seeded routine", async ({ page }) => {
  await page.goto("/library/lower-a");
  await expect(page).toHaveURL(/\/library\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: "Lower A", level: 1 })).toBeVisible();
  await expect(page.getByText("TrainGrid library · read-only")).toBeVisible();

  // The old edit link shows the read-only routine instead of an editor.
  await page.goto("/library/lower-a/edit");
  await expect(page).toHaveURL(/\/library\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("button", { name: "Save" })).toHaveCount(0);

  // The old Schedule link preselects the routine.
  await page.goto("/week/current/add?template=lower-a");
  await expect(page.locator("select").filter({ has: page.locator("optgroup") })).toHaveValue(
    /[0-9a-f-]{36}/,
  );
  await expect(
    page.locator("select").filter({ has: page.locator("optgroup") }).locator("option:checked"),
  ).toHaveText("Lower A");

  const unknown = await page.goto("/library/not-a-real-template");
  expect(unknown?.status()).toBe(404);
});
