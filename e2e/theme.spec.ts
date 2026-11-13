import { expect, test, type Page } from "@playwright/test";
import { hasLocalSecretKey, signInAsNewLocalMember, supabaseState } from "./local-supabase";

/** Light and dark mode. The theme is a `dark` class on <html>, set before first paint. */

const isDark = (page: Page) => page.evaluate(() => document.documentElement.classList.contains("dark"));
const toggle = (page: Page) => page.getByRole("banner").getByRole("button", { name: /^Switch to (light|dark) mode$/ });
const bodyBackground = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

/** Relative luminance 0 (black) … 1 (white). */
const luminance = (rgb: string) => {
  const [r, g, b] = rgb.match(/[\d.]+/g)!.map(Number);
  const lin = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r!) + 0.7152 * lin(g!) + 0.0722 * lin(b!);
};
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x! + 0.05) / (y! + 0.05);
};

test("follows the system setting when nothing is saved", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/login");
  expect(await isDark(page)).toBe(true);
  expect(await bodyBackground(page)).toBe("rgb(18, 16, 14)");

  await page.emulateMedia({ colorScheme: "light" });
  await page.reload();
  expect(await isDark(page)).toBe(false);
  expect(await bodyBackground(page)).toBe("rgb(244, 241, 234)");
});

test("the theme is applied before the page is interactive (no light flash)", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/login", { waitUntil: "commit" });
  await page.waitForLoadState("domcontentloaded");
  expect(await isDark(page)).toBe(true);
});

test("the toggle switches, is announced, and the choice is remembered over the system setting", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto("/login");
  await expect(toggle(page)).toHaveAccessibleName("Switch to dark mode");
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "false");

  await toggle(page).click();
  expect(await isDark(page)).toBe(true);
  await expect(toggle(page)).toHaveAccessibleName("Switch to light mode");
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => localStorage.getItem("theme"))).toBe("dark");

  // Saved choice wins over the (light) system setting, across reloads.
  await page.reload();
  expect(await isDark(page)).toBe(true);

  // From the keyboard, back to light.
  await toggle(page).focus();
  await page.keyboard.press("Enter");
  expect(await isDark(page)).toBe(false);
  await page.reload();
  expect(await isDark(page)).toBe(false);
});

test.describe("signed in", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    test.skip((await supabaseState(baseURL!)) !== "ok", "Local Supabase stack is not running");
    test.skip(!hasLocalSecretKey(), "SUPABASE_SECRET_KEY is not set for the local stack");
    await signInAsNewLocalMember(context, baseURL!);
  });

  test("dark mode keeps text and actions readable", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/library?type=strength");
    await page.getByText(/^\d+ routines?/).waitFor();

    const style = (locator: ReturnType<Page["locator"]>) =>
      locator.evaluate((el) => ({ fg: getComputedStyle(el).color, bg: getComputedStyle(el).backgroundColor }));
    const page_bg = await bodyBackground(page);

    const heading = await style(page.getByRole("heading", { name: "Library", level: 1 }));
    expect(contrast(heading.fg, page_bg)).toBeGreaterThan(7);

    // The primary action and the selected type stay high-contrast (light on dark page).
    for (const locator of [
      page.getByRole("button", { name: "Search", exact: true }),
      page.getByRole("navigation", { name: "Category" }).getByRole("link", { name: "Strength" }),
    ]) {
      const { fg, bg } = await style(locator);
      expect(contrast(fg, bg)).toBeGreaterThan(7);
      expect(luminance(bg)).toBeGreaterThan(luminance(page_bg));
    }

    const input = await style(page.getByRole("searchbox", { name: "Search routines" }));
    expect(luminance(input.bg)).toBeLessThan(0.05);
    expect(contrast(input.fg, input.bg)).toBeGreaterThan(7);
  });

  test("on a phone the toggle sits beside the menu button", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/library");
    const banner = page.getByRole("banner");
    const t = (await toggle(page).boundingBox())!;
    const menu = (await banner.getByLabel("Open menu").boundingBox())!;
    expect(Math.abs(t.y + t.height / 2 - (menu.y + menu.height / 2))).toBeLessThan(3);
    expect(t.x).toBeLessThan(menu.x);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 4,
    );
    expect(overflow).toBe(false);
  });
});
