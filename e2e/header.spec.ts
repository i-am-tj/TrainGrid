import { expect, test, type Page } from "@playwright/test";
import { hasLocalSecretKey, signInAsNewLocalMember, supabaseState } from "./local-supabase";

/** Global header brand: logo, name and Beta badge. Runs signed out on the sign-in page. */

for (const [label, width] of [["desktop", 1280], ["phone", 360]] as const) {
  test(`the brand shows the logo, the name and a Beta badge (${label})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/login");
    const banner = page.getByRole("banner");

    // The link is still just "TrainGrid"; the logo is decorative.
    const brand = banner.getByRole("link", { name: "TrainGrid", exact: true });
    await expect(brand).toBeVisible();
    await expect(brand.locator("svg")).toHaveAttribute("aria-hidden", "true");

    // Beta is plain text beside the link: visible, readable, not interactive.
    const beta = banner.getByText("Beta", { exact: true });
    await expect(beta).toBeVisible();
    expect(await beta.evaluate((el) => el.closest("a, button"))).toBeNull();
    await expect(banner.getByRole("link", { name: /beta/i })).toHaveCount(0);

    // Same line as the name, immediately after it.
    const b = (await brand.boundingBox())!;
    const t = (await beta.boundingBox())!;
    expect(Math.abs(t.y + t.height / 2 - (b.y + b.height / 2))).toBeLessThan(2);
    expect(t.x - (b.x + b.width)).toBeGreaterThanOrEqual(0);
    expect(t.x - (b.x + b.width)).toBeLessThan(12);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 4,
    );
    expect(overflow).toBe(false);
  });
}

// ---------------------------------------------------------------------------
// Phone menu (signed in, so the header has links)
// ---------------------------------------------------------------------------

test.describe("header menu", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    test.skip((await supabaseState(baseURL!)) !== "ok", "Local Supabase stack is not running");
    test.skip(!hasLocalSecretKey(), "SUPABASE_SECRET_KEY is not set for the local stack");
    await signInAsNewLocalMember(context, baseURL!);
  });

  const LINKS = ["Planner", "Library", "Export"];

  /** The menu's close handlers exist only once React has hydrated the header. */
  const hydrated = async (page: Page) =>
    page.waitForFunction(() => {
      const summary = document.querySelector("header summary");
      return !!summary && Object.keys(summary).some((key) => key.startsWith("__reactFiber"));
    });

  test("on a phone the links sit behind a menu button and open as a vertical list", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/library");
    await hydrated(page);
    const banner = page.getByRole("banner");
    const toggle = banner.getByLabel("Open menu");
    await expect(toggle).toBeVisible();
    for (const name of LINKS) await expect(banner.getByRole("link", { name, exact: true })).toHaveCount(0);

    // Brand, Beta and the button share one row.
    const brand = (await banner.getByRole("link", { name: "TrainGrid", exact: true }).boundingBox())!;
    const button = (await toggle.boundingBox())!;
    expect(Math.abs(button.y + button.height / 2 - (brand.y + brand.height / 2))).toBeLessThan(3);

    await toggle.click();
    const menu = banner.getByRole("navigation", { name: "Main" });
    await expect(banner.getByLabel("Close menu")).toBeVisible();
    const boxes = [];
    for (const name of LINKS) boxes.push((await menu.getByRole("link", { name, exact: true }).boundingBox())!);
    boxes.push((await menu.getByRole("button", { name: "Sign out" }).boundingBox())!);
    for (let i = 1; i < boxes.length; i++) {
      expect(Math.round(boxes[i]!.x)).toBe(Math.round(boxes[0]!.x));
      expect(boxes[i]!.y).toBeGreaterThan(boxes[i - 1]!.y);
    }

    // Choosing a page goes there and closes the menu.
    await menu.getByRole("link", { name: "Planner" }).click();
    await page.waitForURL(/\/week\//);
    await expect(banner.getByLabel("Open menu")).toBeVisible();
    await expect(banner.getByRole("navigation", { name: "Main" })).toHaveCount(0);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 4,
    );
    expect(overflow).toBe(false);
  });

  test("the phone menu works from the keyboard and closes on Escape or a click outside", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/library");
    await hydrated(page);
    const banner = page.getByRole("banner");
    await banner.getByLabel("Open menu").focus();
    await page.keyboard.press("Enter");
    await expect(banner.getByRole("link", { name: "Library", exact: true })).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(banner.getByRole("link", { name: "Planner", exact: true })).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(banner.getByRole("link", { name: "Planner", exact: true })).toHaveCount(0);
    await expect(banner.getByLabel("Open menu")).toBeFocused();

    await banner.getByLabel("Open menu").click();
    await expect(banner.getByRole("link", { name: "Library", exact: true })).toBeVisible();
    // The open menu overlays the top of the page; click well below it.
    await page.mouse.click(180, 760);
    await expect(banner.getByRole("link", { name: "Library", exact: true })).toHaveCount(0);
  });

  test("on desktop the links stay inline and there is no menu button", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/library");
    const banner = page.getByRole("banner");
    await expect(banner.getByLabel("Open menu")).toBeHidden();
    const boxes = [];
    for (const name of LINKS) {
      const link = banner.getByRole("link", { name, exact: true });
      await expect(link).toBeVisible();
      boxes.push((await link.boundingBox())!);
    }
    await expect(banner.getByRole("button", { name: "Sign out" })).toBeVisible();
    for (let i = 1; i < boxes.length; i++) {
      expect(Math.abs(boxes[i]!.y - boxes[0]!.y)).toBeLessThan(2);
      expect(boxes[i]!.x).toBeGreaterThan(boxes[i - 1]!.x);
    }
  });
});
