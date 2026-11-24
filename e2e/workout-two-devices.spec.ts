import { expect, test, type Page } from "@playwright/test";
import { todayIn } from "../lib/time-zone";
import { accessibilityResults } from "../tests/helpers/accessibility";
import {
  createLocalWorkoutSessionFor,
  hasLocalSecretKey,
  readRows,
  serviceClient,
  signInAsNewLocalMember,
  supabaseState,
} from "./local-supabase";

/**
 * One workout open on two devices. A save from a device that has not seen
 * the other's latest save is refused, and the member chooses which version
 * stays; nothing is overwritten silently.
 */

const PHONE = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };
test.use(PHONE);

test.beforeEach(async ({ baseURL }) => {
  test.skip((await supabaseState(baseURL!)) !== "ok" || !hasLocalSecretKey(), "needs the local Supabase stack");
});

async function logSet(page: Page, weight: string) {
  const timer = page.getByRole("region", { name: "Rest timer" });
  if (await timer.isVisible()) await timer.getByRole("button", { name: "Skip" }).click();
  await page.getByRole("textbox", { name: /Weight/ }).fill(weight);
  await page.getByRole("button", { name: "Log set" }).click();
}

async function savedWeights(sessionId: string) {
  const [row] = await readRows("workout_logs", { session_id: sessionId });
  const items = (row?.entries as { items: Array<{ sets: Array<{ weight: number | null; done: boolean }> }> } | undefined)?.items;
  return items?.[0]?.sets.filter((set) => set.done).map((set) => set.weight);
}

test("a workout saved on another device is never overwritten without asking", async ({ page, context, baseURL, browser }) => {
  const { userId } = await signInAsNewLocalMember(context, baseURL!);
  const sessionId = await createLocalWorkoutSessionFor(userId, "Two Devices", todayIn("UTC").date);

  // The phone starts the workout; the tablet opens it at the same version.
  await page.goto(`/workout/${sessionId}`);
  await page.getByRole("button", { name: "Start workout" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Bench Press" })).toBeVisible();

  // Same member (the sign-in cookies), but a different browser: none of the phone's storage, so its own device id.
  const { cookies } = await context.storageState();
  const tabletContext = await browser.newContext({ ...PHONE, storageState: { cookies, origins: [] }, baseURL });
  const tablet = await tabletContext.newPage();
  try {
    await tablet.goto(`/workout/${sessionId}`);
    await expect(tablet.getByRole("heading", { level: 1, name: "Bench Press" })).toBeVisible();

    // The phone logs a set and saves it.
    await logSet(page, "60");
    await expect.poll(() => savedWeights(sessionId)).toEqual([60]);

    // The tablet logs a different set on top of the version it loaded: refused, and it asks.
    await logSet(tablet, "70");
    const conflict = tablet.getByRole("dialog", { name: "Changed on another device" });
    await expect(conflict).toBeVisible();
    // One set on each side: the member sees what each version has.
    await expect(conflict.getByText("1 set done", { exact: true })).toHaveCount(2);
    await expect(tablet.getByText("Not saved: changed on another device")).toBeVisible();
    // Keyboard focus starts inside the dialog, and it passes axe in both themes.
    await expect(conflict.getByRole("button", { name: "Keep this device’s version" })).toBeFocused();
    expect((await accessibilityResults(tablet)).violations).toEqual([]);
    await tablet.emulateMedia({ colorScheme: "dark" });
    expect((await accessibilityResults(tablet)).violations).toEqual([]);
    await tablet.emulateMedia({ colorScheme: "light" });
    expect(await savedWeights(sessionId)).toEqual([60]);

    // Taking the other version shows the phone's set on the tablet.
    await conflict.getByRole("button", { name: "Use the other version" }).click();
    await expect(conflict).toBeHidden();
    await expect(tablet.getByRole("button", { name: /Bench Press: 1 of 2 sets/ })).toBeVisible();
    await expect(tablet.getByText("Set 2 of 2")).toBeVisible();

    // The tablet is now current, so its next set saves.
    await logSet(tablet, "80");
    await expect.poll(() => savedWeights(sessionId)).toEqual([60, 80]);

    // Now the phone is behind. Keeping its own version replaces the tablet's.
    await logSet(page, "65");
    const onPhone = page.getByRole("dialog", { name: "Changed on another device" });
    await expect(onPhone).toBeVisible();
    await onPhone.getByRole("button", { name: "Keep this device’s version" }).click();
    await expect(onPhone).toBeHidden();
    await expect.poll(() => savedWeights(sessionId)).toEqual([60, 65]);
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  } finally {
    await tabletContext.close();
  }
});

test("a phone reopening a workout with changes it never saved asks before replacing newer ones", async ({ page, context, baseURL }) => {
  const { userId } = await signInAsNewLocalMember(context, baseURL!);
  const sessionId = await createLocalWorkoutSessionFor(userId, "Offline Phone", todayIn("UTC").date);

  await page.goto(`/workout/${sessionId}`);
  await page.getByRole("button", { name: "Start workout" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Bench Press" })).toBeVisible();

  // No signal: the set stays on this phone only.
  await context.setOffline(true);
  await logSet(page, "60");
  await expect(page.getByText("Saved on this phone")).toBeVisible({ timeout: 15_000 });

  // Meanwhile the workout is saved from another device (a new version on the server).
  const [row] = await readRows("workout_logs", { session_id: sessionId });
  const tabletEntries = structuredClone(row!.entries) as { items: Array<{ sets: Array<{ weight: number | null; reps: number | null; done: boolean }> }> };
  tabletEntries.items[0]!.sets[0] = { weight: 90, reps: 5, done: true };
  const { error } = await serviceClient()
    .from("workout_logs")
    .update({ entries: tabletEntries, saved_by: crypto.randomUUID() })
    .eq("session_id", sessionId);
  expect(error).toBeNull();

  // Back online, the phone reopens the workout: it asks rather than replacing the 90 kg set.
  await context.setOffline(false);
  await page.reload();
  const conflict = page.getByRole("dialog", { name: "Changed on another device" });
  await expect(conflict).toBeVisible();
  expect(await savedWeights(sessionId)).toEqual([90]);
  await conflict.getByRole("button", { name: "Keep this device’s version" }).click();
  await expect.poll(() => savedWeights(sessionId)).toEqual([60]);
});
