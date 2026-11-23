import { expect, test, type Page } from "@playwright/test";
import { readRows, signInAsNewLocalMember } from "./local-supabase";

/**
 * Starting a quick workout is one request that is safe to send again
 * (PRODUCT_AUDIT F18). The database side (atomic start and finish, a reused
 * id returning the same workout) is tested in
 * 15_atomic_quick_workouts.test.sql and
 * tests/integration/reactions-and-quick-workouts.test.ts; this is the
 * browser: the retry a member actually makes after a dropped connection.
 */

async function hydrated(page: Page) {
  await page.waitForFunction(() => {
    const root = document.getElementById("main-content") ?? document.querySelector(".workout-screen");
    return !!root && Object.keys(root).some((key) => key.startsWith("__reactFiber"));
  });
}

async function startLift(page: Page) {
  await page.getByTestId("quick-start").click();
  const dialog = page.getByRole("dialog", { name: "Start a workout now" });
  const requestId = await dialog.locator('input[name="request"]').inputValue();
  await dialog.getByRole("button", { name: /^Lift/ }).click();
  return requestId;
}

test("a start whose response is lost, retried from the error page, opens the same workout", async ({ page, context, baseURL }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { userId } = await signInAsNewLocalMember(context, baseURL!);

  // The server starts the workout, but the phone never hears back.
  let dropped = false;
  await page.route("**/home", async (route) => {
    const request = route.request();
    if (!dropped && request.method() === "POST" && request.headers()["next-action"]) {
      dropped = true;
      await route.fetch();
      await route.abort("connectionreset");
      return;
    }
    await route.fallback();
  });

  await page.goto("/home");
  await hydrated(page);
  const first = await startLift(page);
  expect(first).toMatch(/^[0-9a-f-]{36}$/);
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect
    .poll(async () => (await readRows("scheduled_sessions", { user_id: userId, origin: "quick" })).length)
    .toBe(1);

  // Try again, then Start a workout again: the same request, the same workout.
  await page.getByRole("button", { name: "Try again" }).click();
  await hydrated(page);
  const retry = await startLift(page);
  expect(retry).toBe(first);
  await page.waitForURL(`/workout/${first}`);
  expect(await readRows("scheduled_sessions", { user_id: userId, origin: "quick" })).toHaveLength(1);
  expect(await readRows("workout_logs", { session_id: first })).toHaveLength(1);

  // Once that workout is open, Home's next start is a new one.
  await hydrated(page);
  await page.goto("/home");
  await hydrated(page);
  await page.getByTestId("quick-start").click();
  const next = await page.getByRole("dialog", { name: "Start a workout now" }).locator('input[name="request"]').inputValue();
  expect(next).toMatch(/^[0-9a-f-]{36}$/);
  expect(next).not.toBe(first);
});
