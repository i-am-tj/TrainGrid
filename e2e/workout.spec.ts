import { expect, test } from "@playwright/test";
import { todayIn } from "../lib/time-zone";
import {
  createLocalWorkoutSessionFor,
  hasLocalSecretKey,
  readRows,
  signInAsNewLocalMember,
  supabaseState,
} from "./local-supabase";

/**
 * Live workouts on a phone: start from home, log sets with the rest timer,
 * survive a reload, finish, and see it done everywhere.
 */

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test.beforeEach(async ({ baseURL }) => {
  test.skip((await supabaseState(baseURL!)) !== "ok" || !hasLocalSecretKey(), "needs the local Supabase stack");
});

test("a member runs a workout from start to finish on a phone", async ({ page, context, baseURL }) => {
  const { userId } = await signInAsNewLocalMember(context, baseURL!);
  const sessionId = await createLocalWorkoutSessionFor(userId, "Upper Test", todayIn("UTC").date);

  await page.goto("/home");
  await page.getByRole("link", { name: "Start workout: Upper Test" }).click();
  await page.waitForURL(`/workout/${sessionId}`);
  await expect(page.getByRole("heading", { level: 1, name: "Upper Test" })).toBeVisible();
  await expect(page.getByText("2 exercises · 3 sets")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await page.getByRole("button", { name: "Start workout" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Bench Press" })).toBeVisible();
  await expect(page.getByText("Set 1 of 2")).toBeVisible();
  // The plan's reps are suggested; the weight is typed once.
  await expect(page.getByRole("textbox", { name: "Reps" })).toHaveValue("5");
  await page.getByRole("textbox", { name: /Weight/ }).fill("60");
  await page.getByRole("button", { name: "Log set" }).click();

  // The rest timer starts on its own, and the next set carries the weight.
  const timer = page.getByRole("region", { name: "Rest timer" });
  await expect(timer).toBeVisible();
  await expect(timer).toContainText("Next: set 2 of Bench Press");
  await expect(page.getByText("Set 2 of 2")).toBeVisible();
  await expect(page.getByRole("textbox", { name: /Weight/ })).toHaveValue("60");
  await page.getByRole("button", { name: "More weight" }).click();
  await expect(page.getByRole("textbox", { name: /Weight/ })).toHaveValue("62.5");
  await timer.getByRole("button", { name: "Skip" }).click();
  await expect(timer).toHaveCount(0);
  await page.getByRole("button", { name: "Log set" }).click();

  // The exercise is complete: on to the next one.
  await expect(page.getByRole("heading", { level: 1, name: "Push-up" })).toBeVisible();

  // A reload (or a locked phone) keeps everything, even before TrainGrid has the save.
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Push-up" })).toBeVisible();
  // (The progress bar, not the bottom-left Previous button: `next dev` puts its badge there.)
  await page.getByRole("button", { name: /Bench Press: 2 of 2 sets/ }).click();
  await expect(page.getByRole("button", { name: /Set 2, logged: 62\.5 kg × 5/ })).toBeVisible();
  await page.getByRole("button", { name: /Push-up: 0 of 1 sets/ }).click();
  // And the phone's copy reaches TrainGrid.
  await expect
    .poll(async () => {
      const [row] = await readRows("workout_logs", { session_id: sessionId });
      return (row?.entries as { items: Array<{ sets: Array<{ done: boolean }> }> } | undefined)?.items[0]?.sets.filter((set) => set.done).length;
    })
    .toBe(2);

  await expect(page.getByRole("textbox", { name: "Reps" })).toHaveValue("10");
  await page.getByRole("button", { name: "Log set" }).click();
  await expect(page.getByText(/^Every set is done\. Great work/)).toBeVisible();
  await page.getByRole("button", { name: "Finish workout" }).click();
  const dialog = page.getByRole("dialog", { name: "Finish workout?" });
  await expect(dialog).toContainText("All 3 sets done");
  await dialog.getByRole("textbox").fill("Felt strong.");
  await dialog.getByRole("button", { name: "Finish workout" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Upper Test" })).toBeVisible();
  await expect(page.getByText("Workout complete")).toBeVisible();
  await expect(page.getByText("612.5")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  const [log] = await readRows("workout_logs", { session_id: sessionId });
  expect(log).toMatchObject({ status: "completed", unit: "kg", notes: "Felt strong." });
  expect((log!.entries as { items: Array<{ sets: unknown[] }> }).items[0]!.sets).toEqual([
    { weight: 60, reps: 5, done: true },
    { weight: 62.5, reps: 5, done: true },
  ]);

  await page.getByRole("link", { name: "Done" }).click();
  await page.waitForURL("/home");
  await expect(page.getByRole("link", { name: "View workout: Upper Test" })).toBeVisible();
  await page.goto(`/session/${sessionId}`);
  await expect(page.getByText("Workout done")).toBeVisible();
});

test("another member cannot open my workout", async ({ page, context, baseURL, browser }) => {
  const { userId } = await signInAsNewLocalMember(context, baseURL!);
  const sessionId = await createLocalWorkoutSessionFor(userId, "Private Lift", todayIn("UTC").date);

  const other = await browser.newContext();
  await signInAsNewLocalMember(other, baseURL!);
  const response = await (await other.newPage()).goto(`${baseURL}/workout/${sessionId}`);
  expect(response?.status()).toBe(404);
  await other.close();

  await page.goto(`/workout/${sessionId}`);
  await expect(page.getByRole("heading", { level: 1, name: "Private Lift" })).toBeVisible();
});
