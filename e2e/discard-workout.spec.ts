import { expect, test, type Page } from "@playwright/test";
import { todayIn } from "../lib/time-zone";
import { accessibilityResults } from "../tests/helpers/accessibility";
import { createLocalWorkoutSessionFor, readRows, signInAsNewLocalMember } from "./local-supabase";

/**
 * A started workout can be discarded from wherever it shows up: Home's card,
 * the session page, and (for an empty quick workout) the workout screen
 * itself, always after a confirmation. A planned session stays, ready to
 * start again; a quick one is removed.
 */

async function hydrated(page: Page) {
  await page.waitForFunction(() => {
    const root = document.getElementById("main-content") ?? document.querySelector(".workout-screen");
    return !!root && Object.keys(root).some((key) => key.startsWith("__reactFiber"));
  });
}

/** Starts the session's workout and logs one set, then leaves the workout screen. */
async function startAndLeave(page: Page, sessionId: string) {
  await page.goto(`/workout/${sessionId}`);
  await hydrated(page);
  await page.getByRole("button", { name: "Start workout" }).click();
  await page.getByRole("textbox", { name: /Weight/ }).fill("60");
  await page.getByRole("button", { name: "Log set" }).click();
  await expect.poll(async () => (await readRows("workout_logs", { session_id: sessionId })).length).toBe(1);
}

test("discard an in-progress planned workout from Home; the session stays, ready to start again", async ({ page, context, baseURL }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { userId } = await signInAsNewLocalMember(context, baseURL!);
  const sessionId = await createLocalWorkoutSessionFor(userId, "Upper Discard", todayIn("UTC").date);
  await startAndLeave(page, sessionId);

  await page.goto("/home");
  await hydrated(page);
  await expect(page.getByRole("link", { name: "Resume workout: Upper Discard" })).toBeVisible();
  await page.getByRole("button", { name: "Discard workout: Upper Discard" }).click();
  const dialog = page.getByRole("dialog", { name: "Discard this workout?" });
  await expect(dialog).toContainText("The planned session stays on your calendar");
  // The safe choice has focus; Escape keeps everything.
  await expect(dialog.getByRole("button", { name: "Keep workout" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  expect(await readRows("workout_logs", { session_id: sessionId })).toHaveLength(1);

  await page.getByRole("button", { name: "Discard workout: Upper Discard" }).click();
  await dialog.getByRole("button", { name: "Discard workout" }).click();
  await expect(page.getByRole("link", { name: "Start workout: Upper Discard" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Discard workout: Upper Discard" })).toHaveCount(0);
  expect(await readRows("workout_logs", { session_id: sessionId })).toHaveLength(0);
  expect(await readRows("scheduled_sessions", { id: sessionId })).toHaveLength(1);

  // Starting again begins fresh: no set from the discarded workout comes back.
  await page.getByRole("link", { name: "Start workout: Upper Discard" }).click();
  await hydrated(page);
  await page.getByRole("button", { name: "Start workout" }).click();
  await expect(page.getByRole("textbox", { name: /Weight/ })).toHaveValue("");
});

test("discard from the session page", async ({ page, context, baseURL }) => {
  const { userId } = await signInAsNewLocalMember(context, baseURL!);
  const sessionId = await createLocalWorkoutSessionFor(userId, "Session Page Discard", todayIn("UTC").date);
  await startAndLeave(page, sessionId);

  await page.goto(`/session/${sessionId}`);
  await hydrated(page);
  await expect(page.getByText("Started by mistake, or not training today?")).toBeVisible();
  await page.getByRole("button", { name: "Discard workout: Session Page Discard" }).click();
  const { violations } = await accessibilityResults(page);
  expect(violations).toEqual([]);
  await page.getByRole("dialog", { name: "Discard this workout?" }).getByRole("button", { name: "Discard workout" }).click();
  await expect(page.getByRole("link", { name: /Start workout/ })).toBeVisible();
  await expect(page.getByText("Started by mistake, or not training today?")).toHaveCount(0);
  expect(await readRows("workout_logs", { session_id: sessionId })).toHaveLength(0);
});

test("a quick workout left running is discarded from Home, and removed entirely", async ({ page, context, baseURL }) => {
  await signInAsNewLocalMember(context, baseURL!);
  await page.goto("/home");
  await hydrated(page);
  await page.getByTestId("quick-start").click();
  await page.getByRole("dialog", { name: "Start a workout now" }).getByRole("button", { name: /^Lift/ }).click();
  await page.waitForURL(/\/workout\/[0-9a-f-]{36}$/);
  const sessionId = page.url().split("/").at(-1)!;

  // Leave without finishing: it waits on Home, in progress.
  await page.getByRole("link", { name: /Leave the workout/ }).click();
  await page.waitForURL("/home");
  await hydrated(page);
  await expect(page.getByRole("link", { name: "Resume workout: Quick lift" })).toBeVisible();
  await page.getByRole("button", { name: "Discard workout: Quick lift" }).click();
  const dialog = page.getByRole("dialog", { name: "Discard this workout?" });
  await expect(dialog).toContainText("This quick workout and every set in it are deleted.");
  await dialog.getByRole("button", { name: "Discard workout" }).click();
  await expect(page.getByRole("link", { name: "Resume workout: Quick lift" })).toHaveCount(0);
  expect(await readRows("scheduled_sessions", { id: sessionId })).toHaveLength(0);
  expect((await page.goto(`/session/${sessionId}`))?.status()).toBe(404);
});

test("an empty quick workout offers a way out on its own screen", async ({ page, context, baseURL }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signInAsNewLocalMember(context, baseURL!);
  await page.goto("/home");
  await hydrated(page);
  await page.getByTestId("quick-start").click();
  await page.getByRole("dialog", { name: "Start a workout now" }).getByRole("button", { name: /^Other/ }).click();
  await page.waitForURL(/\/workout\/[0-9a-f-]{36}$/);
  const sessionId = page.url().split("/").at(-1)!;
  await hydrated(page);
  await page.getByText("Started by mistake?").getByRole("button", { name: "Discard workout" }).click();
  await page.getByRole("dialog", { name: "Discard this workout?" }).getByRole("button", { name: "Discard workout" }).click();
  await page.waitForURL("/home");
  expect(await readRows("scheduled_sessions", { id: sessionId })).toHaveLength(0);
});
