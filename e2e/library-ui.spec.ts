import { expect, test, type Locator, type Page } from "@playwright/test";
import { hasLocalSecretKey, signInAsNewLocalMember, supabaseState } from "./local-supabase";

/**
 * Library layout and visual hierarchy (E2-D19): centred view control with a
 * sliding pill, one restrained New routine action in the results toolbar,
 * shared container edges. Each test runs as a fresh member.
 */

test.beforeEach(async ({ context, baseURL }) => {
  test.skip((await supabaseState(baseURL!)) !== "ok", "Local Supabase stack is not running");
  test.skip(!hasLocalSecretKey(), "SUPABASE_SECRET_KEY is not set for the local stack");
  await signInAsNewLocalMember(context, baseURL!);
});

const viewNav = (page: Page) => page.getByRole("navigation", { name: "Library view" });
const tab = (page: Page, name: string) => viewNav(page).getByRole("link", { name, exact: true });
const pill = (page: Page) => page.getByTestId("library-view-pill");
const box = async (locator: Locator) => (await locator.boundingBox())!;

/** Relative luminance 0 (black) … 1 (white) of a computed CSS colour. */
const luminance = (locator: Locator, property: "backgroundColor" | "color") =>
  locator.evaluate((el, prop) => {
    const [r, g, b] = getComputedStyle(el)[prop].match(/[\d.]+/g)!.map(Number);
    const lin = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * lin(r!) + 0.7152 * lin(g!) + 0.0722 * lin(b!);
  }, property);

/** Waits for the pill to sit exactly under a tab (the transition has finished). */
const expectPillUnder = async (page: Page, name: string) => {
  await expect
    .poll(async () => Math.abs((await box(pill(page))).x - (await box(tab(page, name))).x), { timeout: 5000 })
    .toBeLessThan(2);
};

test("the view control is centred under the heading", async ({ page }) => {
  await page.goto("/library");
  const header = await box(page.locator("main header"));
  const list = await box(viewNav(page).getByRole("list"));
  expect(Math.abs(list.x + list.width / 2 - (header.x + header.width / 2))).toBeLessThan(2);
  expect(list.y).toBeGreaterThan((await box(page.getByRole("heading", { name: "Library", level: 1 }))).y);
});

test("one pill slides between the tabs, without a black fill", async ({ page }) => {
  await page.goto("/library");
  await expectPillUnder(page, "All");
  const handle = await pill(page).elementHandle();

  await expect(pill(page)).toHaveCSS("transition-duration", "0.225s");
  await expect(pill(page)).toHaveCSS("transition-property", /transform/);
  await expect(pill(page)).toHaveCSS("transition-timing-function", "cubic-bezier(0, 0, 0.2, 1)");

  await tab(page, "TrainGrid").click();
  await expectPillUnder(page, "TrainGrid");
  await expect(page).toHaveURL(/scope=global$/);
  await tab(page, "Mine").click();
  await expectPillUnder(page, "Mine");
  await expect(tab(page, "Mine")).toHaveAttribute("aria-current", "page");

  // The same element moved: it was not replaced, which is what lets it animate.
  expect(await handle!.evaluate((el) => el.isConnected)).toBe(true);

  // Light pill, dark text; inactive tabs subdued; no black surface.
  expect(await luminance(pill(page), "backgroundColor")).toBeGreaterThan(0.8);
  expect(await luminance(tab(page, "Mine"), "color")).toBeLessThan(0.05);
  expect(await luminance(tab(page, "All"), "color")).toBeGreaterThan(await luminance(tab(page, "Mine"), "color"));
  for (const name of ["All", "TrainGrid", "Mine"]) {
    const bg = await tab(page, name).evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg, name).toBe("rgba(0, 0, 0, 0)");
  }
});

test("back and forward move the pill with the URL", async ({ page }) => {
  await page.goto("/library");
  await tab(page, "Mine").click();
  await expect(page).toHaveURL(/scope=mine$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/library$/);
  await expect(tab(page, "All")).toHaveAttribute("aria-current", "page");
  await expectPillUnder(page, "All");
  await page.goForward();
  await expect(tab(page, "Mine")).toHaveAttribute("aria-current", "page");
  await expectPillUnder(page, "Mine");
});

test("the view control works from the keyboard with visible focus", async ({ page }) => {
  await page.goto("/library");
  await tab(page, "All").focus();
  await page.keyboard.press("Tab");
  await expect(tab(page, "TrainGrid")).toBeFocused();
  const ring = await tab(page, "TrainGrid").evaluate((el) => getComputedStyle(el).boxShadow);
  expect(ring).not.toBe("none");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/scope=global$/);
  await expect(tab(page, "TrainGrid")).toHaveAttribute("aria-current", "page");
});

test("with reduced motion the pill jumps instead of sliding", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/library");
  await expect(pill(page)).toHaveCSS("transition-property", "none");
  await tab(page, "Mine").click();
  await expectPillUnder(page, "Mine");
});

test("New routine sits in the results toolbar, outlined, in every view", async ({ page }) => {
  for (const url of ["/library", "/library?scope=global", "/library?scope=mine"]) {
    await page.goto(url);
    const links = page.getByRole("link", { name: "New routine" });
    await expect(links, url).toHaveCount(1);
    const button = links.first();
    await expect(button).toHaveAttribute("href", "/library/new");
    expect(await luminance(button, "backgroundColor"), url).toBeGreaterThan(0.8);
    await expect(button).toHaveCSS("border-top-style", "solid");
    await expect(button.locator("svg")).toHaveAttribute("aria-hidden", "true");

    // Right of the count, on the same row, below the category filters.
    const count = await box(page.getByText(/^\d+ routines?\b/));
    const own = await box(button);
    const categories = await box(page.getByRole("navigation", { name: "Category" }));
    expect(own.x, url).toBeGreaterThan(count.x + count.width);
    expect(Math.abs(own.y + own.height / 2 - (count.y + count.height / 2)), url).toBeLessThan(4);
    expect(own.y, url).toBeGreaterThan(categories.y + categories.height);
  }
  // From the shared view it still leads to the personal routine form.
  await page.goto("/library?scope=global");
  await page.getByRole("link", { name: "New routine" }).click();
  await expect(page).toHaveURL(/\/library\/new$/);
});

test("search and category controls keep their approved look", async ({ page }) => {
  await page.goto("/library?type=strength");
  expect(await luminance(page.getByRole("button", { name: "Search", exact: true }), "backgroundColor")).toBeLessThan(0.05);
  const strength = page.getByRole("navigation", { name: "Category" }).getByRole("link", { name: "Strength" });
  expect(await luminance(strength, "backgroundColor")).toBeLessThan(0.05);
  expect(
    await luminance(page.getByRole("navigation", { name: "Category" }).getByRole("link", { name: "Running" }), "backgroundColor"),
  ).toBeGreaterThan(0.8);
});

test("heading, filters, toolbar and results share the same left edge", async ({ page }) => {
  for (const width of [1280, 360]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/library");
    const left = [
      await box(page.getByRole("heading", { name: "Library", level: 1 })),
      await box(page.getByRole("search", { name: "Search the library" })),
      await box(page.getByRole("navigation", { name: "Category" })),
      await box(page.getByText(/^\d+ routines?\b/)),
      await box(page.locator("main section").first()),
    ].map((b) => Math.round(b.x));
    expect(new Set(left).size, `${width}px: ${left.join(", ")}`).toBe(1);
  }
});

test("on a phone the toolbar wraps without overlap or sideways scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/library?q=lower&type=strength");
  await expect(page.getByText("2 routines")).toBeVisible();
  const count = await box(page.getByText(/^\d+ routines?\b/));
  const button = await box(page.getByRole("link", { name: "New routine" }));
  const overlaps =
    count.x < button.x + button.width && button.x < count.x + count.width &&
    count.y < button.y + button.height && button.y < count.y + count.height;
  expect(overlaps).toBe(false);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 4,
  );
  expect(overflow).toBe(false);
});
