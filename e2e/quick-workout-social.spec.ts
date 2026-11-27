import { expect, test, type Page } from "@playwright/test";
import { accessibilityResults } from "../tests/helpers/accessibility";
import { createLocalSocialProfile, signInAsNewLocalMember } from "./local-supabase";

/**
 * Start an unplanned workout straight from Home with nothing planned, add exercises as
 * you go, name it at the finish and post about it; then another member likes
 * and comments. The rules behind each step are also tested in the database
 * (13_reactions_and_quick_workouts.test.sql) and the data layer
 * (tests/integration/reactions-and-quick-workouts.test.ts).
 */

const uniq = () => crypto.randomUUID().replace(/-/g, "").slice(0, 8);

async function hydrated(page: Page) {
  await page.waitForFunction(() => {
    const root = document.getElementById("main-content") ?? document.querySelector(".workout-screen");
    return !!root && Object.keys(root).some((key) => key.startsWith("__reactFiber"));
  });
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

test("start a workout from Home, add exercises, name it at the finish and post it; others like and comment", async ({
  page,
  context,
  baseURL,
  browser,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const me = await signInAsNewLocalMember(context, baseURL!);
  const myName = `quick_${uniq()}`;
  await createLocalSocialProfile(me.userId, { username: myName, displayName: "Quick Starter", visibility: "public" });

  // Home → Start an unplanned workout → Lift: straight into a running workout.
  await page.goto("/home");
  await hydrated(page);
  await page.getByTestId("quick-start").click();
  const start = page.getByRole("dialog", { name: "Start an unplanned workout" });
  await start.getByRole("button", { name: /^Lift/ }).click();
  await page.waitForURL(/\/workout\/[0-9a-f-]{36}$/);
  const sessionId = page.url().split("/").at(-1)!;
  await expect(page.getByRole("heading", { level: 1, name: "Your workout is running" })).toBeVisible();
  await expect(page.getByLabel("Time elapsed")).toBeVisible();
  await noOverflow(page);
  await hydrated(page);

  // First exercise: weight and reps (the default for a lift), with a rest timer.
  await page.getByTestId("add-first-exercise").click();
  const add = page.getByRole("dialog", { name: "Add exercise" });
  await expect(add.getByRole("textbox", { name: "Exercise" })).toBeFocused();
  await add.getByRole("button", { name: "Add exercise" }).click();
  await expect(add.getByText("Name the exercise.")).toBeVisible();
  await add.getByRole("textbox", { name: "Exercise" }).fill("Back squat");
  await expect(add.getByRole("radio", { name: "Weight" })).toHaveAttribute("aria-checked", "true");
  await add.getByRole("radio", { name: "1:30" }).click();
  await add.getByRole("button", { name: "Add exercise" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Back squat" })).toBeVisible();

  await page.getByRole("textbox", { name: /Weight/ }).fill("100");
  await page.getByRole("textbox", { name: "Reps" }).fill("5");
  await page.getByRole("button", { name: "Log set" }).click();
  await expect(page.getByRole("region", { name: "Rest timer" })).toBeVisible();
  await page.getByRole("region", { name: "Rest timer" }).getByRole("button", { name: "Skip" }).click();
  await page.getByRole("button", { name: "Log set" }).click(); // 100 × 5 again

  // Second exercise, added mid-workout: reps only.
  await page.getByRole("button", { name: "Add exercise" }).first().click();
  await add.getByRole("textbox", { name: "Exercise" }).fill("Push-up");
  await add.getByRole("radio", { name: "Reps" }).click();
  await add.getByRole("radio", { name: "Off" }).click();
  await add.getByRole("button", { name: "Add exercise" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Push-up" })).toBeVisible();
  await page.getByRole("textbox", { name: "Reps" }).fill("12");
  await page.getByRole("button", { name: "Log set" }).click();

  // A reload keeps the free-form exercises and their sets.
  await page.reload();
  await expect(page.getByRole("button", { name: /Back squat: 2 of 3 sets/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Push-up: 1 of 3 sets/ })).toBeVisible();
  await hydrated(page);

  // Finish: name it.
  await page.getByRole("button", { name: "All exercises and workout options" }).click();
  await page.getByRole("dialog", { name: "Workout" }).getByRole("button", { name: "Finish workout" }).click();
  const finish = page.getByRole("dialog", { name: "Finish workout?" });
  await expect(finish.getByRole("textbox", { name: "Name this workout" })).toHaveValue("Quick lift");
  await finish.getByRole("textbox", { name: "Name this workout" }).fill("Leg day PR");
  await finish.getByRole("button", { name: "Finish workout" }).click();

  await expect(page.getByText("Workout complete")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Leg day PR" })).toBeVisible();
  await expect(page.getByText("1,000")).toBeVisible(); // 2 × 100 kg × 5
  await noOverflow(page);

  // Post about it: the finished workout's totals are offered, each opt-in.
  await page.getByTestId("post-about-it").click();
  await page.waitForURL(`/session/${sessionId}/post`);
  await hydrated(page);
  const preview = page.getByTestId("post-preview");
  await expect(preview).toContainText("Leg day PR");
  await expect(preview).toContainText("Done");
  await expect(page.getByLabel(/Time trained/)).toBeChecked();
  await expect(page.getByLabel("Sets done (3)")).toBeChecked();
  await expect(page.getByLabel(/Volume lifted \(1,000 kg\)/)).not.toBeChecked();
  await page.getByLabel(/Volume lifted/).check();
  await expect(preview).toContainText("1,000 kg lifted");
  await page.getByLabel("Caption").fill("New squat PR!");
  await page.getByRole("button", { name: "Post update" }).click();

  await page.waitForURL(/\/feed\?posted=/);
  const card = page.getByTestId("post-card").first();
  await expect(card).toContainText("New squat PR!");
  await expect(card).toContainText("Leg day PR");
  await expect(card).toContainText("3 sets");
  await expect(card).toContainText("1,000 kg lifted");
  await expect(card).not.toContainText("Back squat"); // exercises are never shared
  await expect(card.getByTestId("like-button")).toHaveAccessibleName("Like. 0 likes");
  const postUrl = await card.getByRole("link", { name: /ago|just now/ }).getAttribute("href");

  // The session is on the planner like any other, now named, with its time trained.
  await page.goto(`/session/${sessionId}`);
  await expect(page.getByRole("heading", { level: 1, name: "Leg day PR" })).toBeVisible();
  await expect(page.getByText("Workout done")).toBeVisible();

  // Another member likes and comments.
  const fanContext = await browser.newContext({ baseURL, timezoneId: "UTC" });
  const fan = await signInAsNewLocalMember(fanContext, baseURL!);
  await createLocalSocialProfile(fan.userId, { username: `fan_${uniq()}`, displayName: "Fan Member", visibility: "private" });
  const fanPage = await fanContext.newPage();
  await fanPage.goto(postUrl!);
  await hydrated(fanPage);
  const like = fanPage.getByTestId("like-button");
  await like.click();
  await expect(like).toHaveAttribute("aria-pressed", "true");
  await expect(like).toHaveAccessibleName("Like. 1 like");
  await fanPage.getByRole("textbox", { name: "Add a comment" }).fill("Huge! 🔥");
  await fanPage.getByRole("button", { name: "Post comment" }).click();
  await expect(fanPage.getByTestId("comment")).toContainText("Huge! 🔥");
  await expect(fanPage.getByRole("textbox", { name: "Add a comment" })).toHaveValue("");
  // After a reload the like and comment are still there.
  await fanPage.reload();
  await expect(fanPage.getByTestId("like-button")).toHaveAttribute("aria-pressed", "true");
  await expect(fanPage.getByRole("heading", { name: "Comments (1)" })).toBeVisible();
  // The fan cannot delete the author's post; only their own comment.
  await expect(fanPage.getByRole("button", { name: "Delete post" })).toHaveCount(0);
  await expect(fanPage.getByRole("button", { name: "Delete your comment" })).toBeVisible();

  // The author sees the like and comment, and can remove the comment from their post.
  await page.goto(postUrl!);
  await hydrated(page);
  await expect(page.getByTestId("like-button")).toHaveAccessibleName("Like. 1 like");
  await expect(page.getByTestId("comment")).toContainText("Huge! 🔥");
  const { violations } = await accessibilityResults(page);
  expect(violations).toEqual([]);
  await noOverflow(page);
  await page.getByRole("button", { name: "Delete this comment" }).click();
  await page.getByRole("dialog", { name: "Delete this comment?" }).getByRole("button", { name: "Delete comment" }).click();
  await expect(page.getByTestId("comment")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Comments (0)" })).toBeVisible();
  await fanContext.close();
});

test("a discarded quick workout leaves nothing behind", async ({ page, context, baseURL }) => {
  await signInAsNewLocalMember(context, baseURL!);
  await page.goto("/home");
  await hydrated(page);
  await page.getByTestId("quick-start").click();
  await page.getByRole("dialog", { name: "Start an unplanned workout" }).getByRole("button", { name: /^Run/ }).click();
  await page.waitForURL(/\/workout\/[0-9a-f-]{36}$/);
  const sessionId = page.url().split("/").at(-1)!;
  await hydrated(page);
  await page.getByRole("button", { name: "All exercises and workout options" }).click();
  await page.getByRole("dialog", { name: "Workout" }).getByRole("button", { name: "Discard workout" }).click();
  const discard = page.getByRole("dialog", { name: "Discard this workout?" });
  await expect(discard).toContainText("This quick workout and every set in it are deleted.");
  await discard.getByRole("button", { name: "Discard workout" }).click();
  await page.waitForURL("/home");
  expect((await page.goto(`/session/${sessionId}`))?.status()).toBe(404);
});

test("Home's Start an unplanned workout is reachable and accessible on a phone, light and dark", async ({ page, context, baseURL }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signInAsNewLocalMember(context, baseURL!);
  for (const scheme of ["light", "dark"] as const) {
    // Reduced motion, as the other dialog checks: axe must not measure a dialog mid-fade.
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    await page.goto("/home");
    await hydrated(page);
    await noOverflow(page);
    await page.getByTestId("quick-start").focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Start an unplanned workout" });
    await expect(dialog).toBeVisible();
    const { violations } = await accessibilityResults(page);
    expect(violations, scheme).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  }
});
