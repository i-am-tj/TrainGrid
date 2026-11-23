import { expect, test, type Page } from "@playwright/test";
import { todayIn } from "../lib/time-zone";
import { accessibilityResults } from "../tests/helpers/accessibility";
import { createLocalEmptySessionFor, createLocalSessionFor, createLocalWorkoutSessionFor, readRows, signInAsNewLocalMember } from "./local-supabase";

/**
 * The session page is a reliable way back into a workout, and deleting a
 * session says exactly what goes with it (PRODUCT_AUDIT F3, F4, F6).
 */

async function hydrated(page: Page) {
  await page.waitForFunction(() => {
    const root = document.getElementById("main-content") ?? document.querySelector(".workout-screen");
    return !!root && Object.keys(root).some((key) => key.startsWith("__reactFiber"));
  });
}

test("a quick workout left running can be resumed from its session page, with the same sets", async ({ page, context, baseURL }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signInAsNewLocalMember(context, baseURL!);
  await page.goto("/home");
  await hydrated(page);
  await page.getByTestId("quick-start").click();
  await page.getByRole("dialog", { name: "Start a workout now" }).getByRole("button", { name: /^Lift/ }).click();
  await page.waitForURL(/\/workout\/[0-9a-f-]{36}$/);
  const sessionId = page.url().split("/").at(-1)!;
  await hydrated(page);

  await page.getByTestId("add-first-exercise").click();
  const add = page.getByRole("dialog", { name: "Add exercise" });
  await add.getByRole("textbox", { name: "Exercise" }).fill("Deadlift");
  await add.getByRole("radio", { name: "Off" }).click();
  await add.getByRole("button", { name: "Add exercise" }).click();
  await page.getByRole("textbox", { name: /Weight/ }).fill("120");
  await page.getByRole("textbox", { name: "Reps" }).fill("3");
  await page.getByRole("button", { name: "Log set" }).click();
  await expect
    .poll(async () => JSON.stringify((await readRows("workout_logs", { session_id: sessionId }))[0]?.entries ?? null))
    .toContain('"done":true');

  // Leave, then come back the long way: the calendar's session page.
  await page.getByRole("link", { name: /Leave the workout/ }).click();
  await page.waitForURL("/home");
  // The page with a workout in progress (and its Discard dialog) must hydrate
  // without React rebuilding it: no invalid nesting, no server/client mismatch.
  const hydrationErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && /hydrat|cannot be a descendant|cannot contain a nested/i.test(message.text())) {
      hydrationErrors.push(message.text());
    }
  });
  await page.goto(`/session/${sessionId}`);
  await hydrated(page);
  await expect(page.getByText("1 of 3 sets")).toBeVisible();
  await expect(page.getByTestId("discard-workout")).toBeVisible();
  expect(hydrationErrors).toEqual([]);
  await page.getByRole("link", { name: "Resume workout" }).click();
  await page.waitForURL(`/workout/${sessionId}`);
  await expect(page.getByRole("button", { name: /Deadlift: 1 of 3 sets/ })).toBeVisible();
});

test("a session with no planned exercises can still be started from its page", async ({ page, context, baseURL }) => {
  const { userId } = await signInAsNewLocalMember(context, baseURL!);
  const sessionId = await createLocalEmptySessionFor(userId, "Open session", todayIn("UTC").date);
  await page.goto(`/session/${sessionId}`);
  await page.getByRole("link", { name: "Start workout" }).click();
  await page.waitForURL(`/workout/${sessionId}`);
});

test("deleting a session with a workout names the workout, the posts and the alternative", async ({ page, context, baseURL }) => {
  const { userId } = await signInAsNewLocalMember(context, baseURL!);
  const sessionId = await createLocalWorkoutSessionFor(userId, "Upper Keep", todayIn("UTC").date);
  await page.goto(`/workout/${sessionId}`);
  await hydrated(page);
  await page.getByRole("button", { name: "Start workout" }).click();
  await page.getByRole("textbox", { name: /Weight/ }).fill("60");
  await page.getByRole("button", { name: "Log set" }).click();
  await expect
    .poll(async () => JSON.stringify((await readRows("workout_logs", { session_id: sessionId }))[0]?.entries ?? null))
    .toContain('"done":true');

  await page.goto(`/session/${sessionId}/edit`);
  await hydrated(page);
  await page.getByRole("button", { name: "Delete session" }).click();
  const dialog = page.getByRole("dialog", { name: "Delete Upper Keep?" });
  const consequences = dialog.getByTestId("delete-consequences");
  await expect(consequences).toContainText("The workout you started (1 set logged so far) is deleted for good.");
  await expect(consequences).toContainText("Anything you posted about it stays on your profile");
  await expect(dialog).toContainText("change the date in the form instead");
  await expect(dialog.getByRole("button", { name: "Keep session" })).toBeFocused();
  const { violations } = await accessibilityResults(page);
  expect(violations).toEqual([]);

  // Keeping it keeps everything.
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  expect(await readRows("workout_logs", { session_id: sessionId })).toHaveLength(1);

  await page.getByRole("button", { name: "Delete session" }).click();
  await dialog.getByRole("button", { name: "Delete session and workout" }).click();
  await page.waitForURL(/\/week\/[^/]+\?day=/);
  expect(await readRows("scheduled_sessions", { id: sessionId })).toHaveLength(0);
  expect(await readRows("workout_logs", { session_id: sessionId })).toHaveLength(0);
});

test("the post entry point does not promise a followers-only audience", async ({ page, context, baseURL }) => {
  const { userId } = await signInAsNewLocalMember(context, baseURL!);
  const sessionId = await createLocalSessionFor(userId, "Audience check", todayIn("UTC").date);
  await page.goto(`/session/${sessionId}`);
  await expect(page.getByText(/You’ll see who can read it before you post/)).toBeVisible();
  await expect(page.getByText(/with your followers/)).toHaveCount(0);
});
