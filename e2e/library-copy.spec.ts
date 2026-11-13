import { expect, test, type Page } from "@playwright/test";
import {
  createLocalRoutineFor,
  hasLocalSecretKey,
  readRows,
  signInAsNewLocalMember,
  supabaseState,
} from "./local-supabase";

/** Copy a TrainGrid routine to My Library (Epic 2, E2-04). Each test runs as a fresh member. */

test.beforeEach(async ({ baseURL }) => {
  test.skip((await supabaseState(baseURL!)) !== "ok", "Local Supabase stack is not running");
  test.skip(!hasLocalSecretKey(), "SUPABASE_SECRET_KEY is not set for the local stack");
});

const copyButton = (page: Page, name: string) => page.getByRole("button", { name: `Copy ${name} to My Library` });
const sectionNames = (page: Page) => page.locator("main section h2").allInnerTexts();

test("copy a TrainGrid routine, then edit the copy; the original is unchanged", async ({ page, context, baseURL }) => {
  const { userId } = await signInAsNewLocalMember(context, baseURL!);
  await page.goto("/library/lower-a");
  const original = await sectionNames(page);
  await expect(page.getByRole("link", { name: "Edit routine" })).toHaveCount(0);

  await copyButton(page, "Lower A").click();
  await page.waitForURL(/\/library\/[0-9a-f-]{36}\?copied=1$/);
  const copyUrl = page.url().replace(/\?copied=1$/, "");
  await expect(page.getByRole("heading", { name: "Lower A", level: 1 })).toBeVisible();
  await expect(page.getByRole("main").getByText("Mine", { exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText(
    "Copied to My Library. This copy is yours to edit; the TrainGrid routine is unchanged.",
  );
  expect(await sectionNames(page)).toEqual(original);
  await expect(copyButton(page, "Lower A")).toHaveCount(0);

  const [row] = await readRows("routines", { id: copyUrl.split("/").pop()! });
  expect(row).toMatchObject({ scope: "PERSONAL", owner_user_id: userId, slug: null, name: "Lower A" });

  // The confirmation is one-time: it is not part of the routine's own URL.
  await page.goto(copyUrl);
  await expect(page.getByRole("status")).toHaveCount(0);

  await page.getByRole("link", { name: "Edit routine" }).click();
  await page.getByLabel("Name", { exact: true }).fill("My Lower A");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { name: "My Lower A", level: 1 })).toBeVisible();

  await page.goto("/library/lower-a");
  await expect(page.getByRole("heading", { name: "Lower A", level: 1 })).toBeVisible();
  await expect(page.getByText("TrainGrid library · read-only")).toBeVisible();
  expect(await sectionNames(page)).toEqual(original);

  await page.goto("/library?scope=mine");
  await expect(page.locator("main section li").filter({ hasText: "My Lower A" })).toHaveCount(1);
});

test("the copied confirmation is never shown on a TrainGrid routine", async ({ page, context, baseURL }) => {
  await signInAsNewLocalMember(context, baseURL!);
  await page.goto("/library/lower-a");
  await page.goto(`${page.url()}?copied=1`);
  await expect(page.getByRole("status")).toHaveCount(0);
});

test("a forged source id cannot copy another member's routine", async ({ page, context, browser, baseURL }) => {
  const other = await browser.newContext({ baseURL });
  const bId = (await signInAsNewLocalMember(other, baseURL!)).userId;
  await other.close();
  const bRoutine = await createLocalRoutineFor(bId, "B private routine");
  const { userId } = await signInAsNewLocalMember(context, baseURL!);

  await page.goto("/library/lower-a");
  await page.locator('input[type="hidden"][name="routineId"]').evaluate(
    (input, id) => ((input as HTMLInputElement).value = id),
    bRoutine,
  );
  await copyButton(page, "Lower A").click();
  await expect(page.getByRole("heading", { name: "Could not complete that action" })).toBeVisible();

  expect(await readRows("routines", { owner_user_id: userId })).toHaveLength(0);
  const [row] = await readRows("routines", { id: bRoutine });
  expect(row).toMatchObject({ owner_user_id: bId, name: "B private routine" });
});

test("the button is disabled while copying, so a double click makes one copy", async ({ page, context, baseURL }) => {
  const { userId } = await signInAsNewLocalMember(context, baseURL!);
  await page.goto("/library/easy-run");
  // Hold the server action briefly so the pending state is observable.
  await page.route("**/library/**", async (route) => {
    if (route.request().method() === "POST") await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });

  const button = copyButton(page, "Easy Run");
  await button.dblclick();
  await expect(page.getByRole("button", { name: "Copying Easy Run" })).toBeDisabled();
  await page.waitForURL(/\?copied=1$/);
  expect(await readRows("routines", { owner_user_id: userId })).toHaveLength(1);
});

test("Copy to My Library works from the keyboard", async ({ page, context, baseURL }) => {
  await signInAsNewLocalMember(context, baseURL!);
  await page.goto("/library/tempo-run");
  await copyButton(page, "Tempo / Threshold").focus();
  await page.keyboard.press("Enter");
  await page.waitForURL(/\?copied=1$/);
  await expect(page.getByRole("heading", { name: "Tempo / Threshold", level: 1 })).toBeVisible();
});
