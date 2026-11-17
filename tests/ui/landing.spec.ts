import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";

const root = path.resolve(".next/ui-preview");
test.beforeEach(async ({ page }) => {
  await page.route("http://ui-preview.test/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const file =
      pathname === "/"
        ? path.join(root, "index.html")
        : pathname === "/styles.css"
          ? path.join(root, "styles.css")
          : path.join(process.cwd(), "public", pathname);
    await route.fulfill({
      body: await readFile(file),
      contentType: pathname.endsWith(".css")
        ? "text/css"
        : pathname.endsWith(".svg")
          ? "image/svg+xml"
          : "text/html",
    });
  });
});

for (const theme of ["light", "dark"] as const) {
  for (const [width, height] of [
    [320, 740],
    [360, 800],
    [768, 1024],
    [1024, 768],
    [1440, 900],
    [1440, 480],
  ]) {
    test(`${theme}: landing fits ${width} × ${height}`, async ({ page }) => {
      await page.setViewportSize({ width: width!, height: height! });
      await page.emulateMedia({ reducedMotion: "reduce", colorScheme: theme });
      await page.goto("http://ui-preview.test/");
      await page.evaluate(
        (dark) => document.documentElement.classList.toggle("dark", dark),
        theme === "dark",
      );
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        "Plan the week.Own the work.",
      );
      await expect(page.locator("#features article")).toHaveCount(6);
      await expect(
        page.getByRole("link", { name: "Explore features" }),
      ).toHaveAttribute("href", "#features");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(
        await page
          .locator(".hero-copy")
          .evaluate((el) => getComputedStyle(el).animationName),
      ).toBe("none");
      if (width === 360 || (width === 1440 && height === 900)) {
        await mkdir("docs/images/epic-3", { recursive: true });
        await page.screenshot({
          path: `docs/images/epic-3/landing-${width}-${theme}.png`,
          fullPage: true,
        });
      }
    });
  }
}

test("semantic navigation, focus, public-only content and feature anchor", async ({
  page,
}) => {
  await page.goto("http://ui-preview.test/");
  await page.keyboard.press("Tab");
  await expect(
    page
      .getByRole("banner")
      .getByRole("link", { name: "TrainGrid", exact: true }),
  ).toBeFocused();
  expect(
    await page
      .locator(":focus")
      .evaluate((el) => getComputedStyle(el).outlineStyle),
  ).toBe("solid");
  await page.getByRole("link", { name: "Explore features" }).click();
  expect(new URL(page.url()).hash).toBe("#features");
  await expect(
    page.getByRole("heading", { name: "Tanuj Chakraborty" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Invitations", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Log in", exact: true }).first(),
  ).toHaveAttribute("href", "/login");
  await expect(page.getByText("Example training week")).toBeVisible();
});

test("mobile public menu retains native no-JavaScript access", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("http://ui-preview.test/");
  await page.getByLabel("Open menu").click();
  await expect(
    page
      .getByRole("navigation", { name: "Main", exact: true })
      .last()
      .getByRole("link", { name: "About" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
