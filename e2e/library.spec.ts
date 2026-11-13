import { expect, test, type Page } from "@playwright/test";
import {
  createLocalRoutineFor,
  hasLocalSecretKey,
  signInAsNewLocalMember,
  supabaseState,
} from "./local-supabase";
import { createRoutine } from "./planner-helpers";

/** Library scope views (Epic 2, E2-01). Each test runs as a fresh member. */

const SHARED_COUNT = 18;

test.beforeEach(async ({ context, baseURL }) => {
  test.skip((await supabaseState(baseURL!)) !== "ok", "Local Supabase stack is not running");
  test.skip(!hasLocalSecretKey(), "SUPABASE_SECRET_KEY is not set for the local stack");
  await signInAsNewLocalMember(context, baseURL!);
});

const viewNav = (page: Page) => page.getByRole("navigation", { name: "Library view" });
const cards = (page: Page) => page.locator("main section li");

test("All is the default and labels every routine as TrainGrid or Mine", async ({ page }) => {
  await createRoutine(page, "My Scope Lift", "strength", [["Squat", "3 × 5"]]);
  await page.goto("/library");

  await expect(viewNav(page).getByRole("link", { name: "All" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText(`${SHARED_COUNT + 1} routines`)).toBeVisible();
  await expect(cards(page).filter({ hasText: "My Scope Lift" }).getByText("Mine")).toBeVisible();
  await expect(cards(page).filter({ hasText: /^Lower A/ }).getByText("TrainGrid", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "New routine" })).toBeVisible();
});

test("TrainGrid shows shared routines only and never invites editing", async ({ page }) => {
  await createRoutine(page, "My Hidden Lift", "strength", [["Squat", "3 × 5"]]);
  await page.goto("/library");
  await viewNav(page).getByRole("link", { name: "TrainGrid" }).click();

  await expect(page).toHaveURL(/\/library\?scope=global$/);
  await expect(viewNav(page).getByRole("link", { name: "TrainGrid" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText(`${SHARED_COUNT} routines`)).toBeVisible();
  await expect(cards(page)).toHaveCount(SHARED_COUNT);
  await expect(page.getByText("My Hidden Lift")).toHaveCount(0);
  await expect(cards(page).getByText("Mine", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "New routine" })).toHaveCount(0);
  await expect(page.getByText(/read-only/)).toBeVisible();
});

test("Mine starts with a helpful empty state, then shows only my routines", async ({ page }) => {
  await page.goto("/library?scope=mine");
  await expect(page.getByText("You haven't created any routines yet.")).toBeVisible();
  await expect(page.getByText("0 routines")).toBeVisible();
  await expect(page.getByRole("link", { name: "Browse TrainGrid routines" })).toHaveAttribute(
    "href",
    "/library?scope=global",
  );
  await page.getByRole("link", { name: "New routine" }).click();
  await expect(page).toHaveURL(/\/library\/new$/);

  await createRoutine(page, "My Only Routine", "other", [["Step", "Do it"]]);
  await page.goto("/library?scope=mine");
  await expect(page.getByText("1 routine", { exact: true })).toBeVisible();
  await expect(cards(page)).toHaveCount(1);
  await expect(cards(page).first()).toContainText("My Only Routine");
  await expect(page.getByText("Lower A")).toHaveCount(0);
});

test("another member's routine appears in no view", async ({ page, browser, baseURL }) => {
  const other = await browser.newContext({ baseURL });
  const { userId: otherId } = await signInAsNewLocalMember(other, baseURL!);
  await other.close();
  await createLocalRoutineFor(otherId, "Other Member Secret");

  for (const url of ["/library", "/library?scope=global", "/library?scope=mine", "/library?type=running"]) {
    await page.goto(url);
    await expect(page.getByText("Other Member Secret"), url).toHaveCount(0);
  }
});

test("switching views keeps the category, and old ?type= links still work", async ({ page }) => {
  await page.goto("/library?type=strength");
  await expect(page.getByRole("navigation", { name: "Category" }).getByRole("link", { name: "Strength" }))
    .toHaveAttribute("aria-current", "page");
  await expect(cards(page).filter({ hasText: "Easy Run" })).toHaveCount(0);

  await viewNav(page).getByRole("link", { name: "TrainGrid" }).click();
  await expect(page).toHaveURL(/\/library\?scope=global&type=strength$/);
  await expect(cards(page)).toHaveCount(4);

  await viewNav(page).getByRole("link", { name: "All" }).click();
  await expect(page).toHaveURL(/\/library\?type=strength$/);
});

test("a filter with no results says so and offers Clear filters", async ({ page }) => {
  await createRoutine(page, "My Strength Only", "strength", [["Squat", "3 × 5"]]);
  await page.goto("/library?scope=mine&type=running");
  await expect(page.getByText("No routines of your own in Running.")).toBeVisible();
  await expect(page.getByText(/haven't created/)).toHaveCount(0);
  await page.locator("main").getByRole("link", { name: "Clear filters" }).last().click();
  await expect(page).toHaveURL(/\/library\?scope=mine$/);
  await expect(cards(page)).toHaveCount(1);
});

test("malformed parameters fall back to defaults without an error", async ({ page }) => {
  const response = await page.goto("/library?scope=everyone&type=%3Cscript%3E");
  expect(response?.status()).toBe(200);
  await expect(viewNav(page).getByRole("link", { name: "All" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText(`${SHARED_COUNT} routines`)).toBeVisible();
  await expect(page.getByText("<script>")).toHaveCount(0);
});

test("the view survives reload and back navigation", async ({ page }) => {
  await page.goto("/library");
  await viewNav(page).getByRole("link", { name: "TrainGrid" }).click();
  await page.waitForURL(/scope=global/);
  await page.getByRole("navigation", { name: "Category" }).getByRole("link", { name: "Running" }).click();
  await page.waitForURL(/scope=global&type=running/);

  await page.reload();
  await expect(viewNav(page).getByRole("link", { name: "TrainGrid" })).toHaveAttribute("aria-current", "page");
  await expect(cards(page)).toHaveCount(6);

  await page.goBack();
  await expect(page).toHaveURL(/\/library\?scope=global$/);
  await expect(cards(page)).toHaveCount(SHARED_COUNT);
});

test("view tabs work from the keyboard", async ({ page }) => {
  await page.goto("/library");
  const mineTab = viewNav(page).getByRole("link", { name: "Mine" });
  await mineTab.focus();
  await expect(mineTab).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/library\?scope=mine$/);
});

test("the library fits a phone screen in every view", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  for (const url of ["/library", "/library?scope=global", "/library?scope=mine"]) {
    await page.goto(url);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 4,
    );
    expect(overflow, url).toBe(false);
  }
});

test("the view and category controls are distinguishable", async ({ page }) => {
  await page.goto("/library");
  await expect(viewNav(page).getByRole("link", { name: "All", exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Category" }).getByRole("link", { name: "All types" }))
    .toHaveAttribute("aria-current", "page");
});

// ---------------------------------------------------------------------------
// Search and filters (Epic 2, E2-02)
// ---------------------------------------------------------------------------

const search = async (page: Page, text: string) => {
  await page.getByRole("searchbox", { name: "Search routines" }).fill(text);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  // A GET form always sends its fields, so wait for this search's own q (blank stays blank).
  await page.waitForURL((url) => url.searchParams.get("q") === text);
};
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Waits (with retries) until the result cards show exactly these routine names, in order. */
const expectCards = async (page: Page, names: string[]) =>
  expect(cards(page).locator("a[href^='/library/'] > div:first-child")).toHaveText(
    names.map((name) => new RegExp(`^${escapeRegExp(name)}\\s*(TrainGrid|Mine)?$`)),
  );
/** Card names in display order, read only once the results (not the loading skeleton) are on screen. */
const cardNames = async (page: Page) => {
  await expect(page.getByText(/^\d+ routines?\b/)).toBeVisible();
  return (await cards(page).locator("a[href^='/library/'] > div:first-child").allInnerTexts()).map((t) =>
    t.replace(/\s*(TrainGrid|Mine)$/, "").trim(),
  );
};

test("search finds routines by name, description and exercise name", async ({ page }) => {
  await page.goto("/library");
  await search(page, "lower");
  await expectCards(page, ["Lower A", "Lower B", "Lower-Body Cooldown", "Lower-Body Warm-up"]);

  await search(page, "conversational");
  await expectCards(page, ["Easy Run"]);

  // "Bulgarian split squat" appears only as an exercise name, never in a routine name or description.
  await search(page, "bulgarian");
  await expectCards(page, ["Lower A", "Lower B"]);
});

test("search ignores case and extra spaces, and needs every word", async ({ page }) => {
  await page.goto("/library?q=%20%20ROMANIAN%20%20%20deadlift%20");
  await expect(page.getByRole("searchbox", { name: "Search routines" })).toHaveValue("ROMANIAN deadlift");
  await expectCards(page, ["Lower A"]);

  await page.goto("/library?q=squat+treadmill");
  await expect(page.getByText("No routines matching “squat treadmill”.")).toBeVisible();
});

test("a blank search is no search", async ({ page }) => {
  await page.goto("/library");
  await search(page, "    ");
  await expect(page.getByText(`${SHARED_COUNT} routines`)).toBeVisible();
  await expect(page.getByRole("link", { name: "Clear filters" })).toHaveCount(0);
});

test("the equipment filter matches any item with the tag; untagged routines need no filter", async ({ page }) => {
  await page.goto("/library");
  await page.getByLabel("Equipment").selectOption("machine");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.waitForURL(/equipment=machine/);
  await expectCards(page, ["Lower B"]);

  await page.goto("/library?equipment=barbell");
  await expectCards(page, ["Lower A", "Lower B", "Upper A", "Upper B"]);

  await page.goto("/library");
  expect(await cardNames(page)).toContain("Easy Run");
});

test("filters combine, and the category chips keep the search", async ({ page }) => {
  await page.goto("/library?scope=global&q=lower&equipment=barbell");
  await page.getByRole("navigation", { name: "Category" }).getByRole("link", { name: "Strength" }).click();
  await expect(page).toHaveURL(/\/library\?scope=global&q=lower&type=strength&equipment=barbell$/);
  await expectCards(page, ["Lower A", "Lower B"]);
  await expect(page.getByRole("searchbox", { name: "Search routines" })).toHaveValue("lower");
  await expect(page.getByLabel("Equipment")).toHaveValue("barbell");

  await viewNav(page).getByRole("link", { name: "Mine" }).click();
  await expect(page).toHaveURL(/\/library\?scope=mine&q=lower&type=strength&equipment=barbell$/);
});

test("searching keeps the view and category", async ({ page }) => {
  await page.goto("/library?scope=global&type=running");
  await search(page, "easy");
  await expect(page).toHaveURL(/scope=global/);
  await expect(page).toHaveURL(/type=running/);
  // Running Warm-up and Running Cooldown also say "easy" but are other categories.
  await expectCards(page, ["Easy Run", "Long Run", "Recovery Run"]);
});

test("zero results say what was searched and offer Clear filters, keeping the view", async ({ page }) => {
  await page.goto("/library?scope=global&q=zzzz&equipment=kettlebell");
  await expect(page.getByText("No TrainGrid routines matching “zzzz” with Kettlebell.")).toBeVisible();
  await expect(page.getByText(/haven't created|No TrainGrid routines yet/)).toHaveCount(0);
  await page.getByRole("link", { name: "Clear filters" }).first().click();
  await expect(page).toHaveURL(/\/library\?scope=global$/);
  await expect(page.getByText(`${SHARED_COUNT} routines`)).toBeVisible();
});

test("malformed search parameters fall back safely", async ({ page }) => {
  const long = "x".repeat(300);
  const response = await page.goto(`/library?q=${long}&equipment=trampoline&type=strength`);
  expect(response?.status()).toBe(200);
  await expect(page.getByLabel("Equipment")).toHaveValue("");
  await expect(page.getByRole("searchbox", { name: "Search routines" })).toHaveValue("x".repeat(100));

  await page.goto("/library?q=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E");
  await expect(page.getByText("No routines matching “<img src=x onerror=alert(1)>”.")).toBeVisible();
  expect(await page.locator("main img").count()).toBe(0);
});

test("filter state survives reload and back navigation", async ({ page }) => {
  await page.goto("/library");
  await search(page, "upper");
  await page.getByRole("navigation", { name: "Category" }).getByRole("link", { name: "Strength" }).click();
  await page.waitForURL(/type=strength/);
  await page.reload();
  await expectCards(page, ["Upper A", "Upper B"]);
  await page.goBack();
  await expect(page).toHaveURL(/\/library\?q=upper(&equipment=)?$/);
  await expectCards(page, ["Upper A", "Upper B", "Upper-Body Cooldown", "Upper-Body Warm-up"]);
});

test("search works from the keyboard", async ({ page }) => {
  await page.goto("/library");
  const box = page.getByRole("searchbox", { name: "Search routines" });
  await box.focus();
  await page.keyboard.type("tempo");
  await page.keyboard.press("Enter");
  await page.waitForURL(/q=tempo/);
  await expectCards(page, ["Tempo / Threshold"]);
});

test("the search controls fit a phone screen", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/library?scope=global&q=lower&equipment=barbell&type=strength");
  await expect(page.getByRole("searchbox", { name: "Search routines" })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 4,
  );
  expect(overflow).toBe(false);
});
