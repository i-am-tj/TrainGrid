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
          : pathname.endsWith(".jpg")
            ? "image/jpeg"
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
        "Plan the week.Train with it.",
      );
      await expect(page.locator("#features article")).toHaveCount(6);
      await expect(page.locator("#workout ol > li")).toHaveCount(4);
      // The phone-sized workout preview never pushes past its column.
      const phone = (await page.locator(".preview-phone").boundingBox())!;
      expect(phone.x).toBeGreaterThanOrEqual(0);
      expect(phone.x + phone.width).toBeLessThanOrEqual(width!);
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
        const portrait = page.getByRole("img", {
          name: "Tanuj Chakraborty",
          exact: true,
        });
        await portrait.scrollIntoViewIfNeeded();
        await expect
          .poll(() =>
            portrait.evaluate(
              (image) => (image as HTMLImageElement).naturalWidth,
            ),
          )
          .toBe(1170);
        await portrait.evaluate((image) =>
          (image as HTMLImageElement).decode(),
        );
        await page.evaluate(() => window.scrollTo(0, 0));
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
    page.getByRole("link", { name: "Skip to content", exact: true }),
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
    page.getByText("Founder & Developer", { exact: true }),
  ).toBeVisible();
  const portrait = page.getByRole("img", {
    name: "Tanuj Chakraborty",
    exact: true,
  });
  await portrait.scrollIntoViewIfNeeded();
  await expect(portrait).toBeVisible();
  await expect
    .poll(() =>
      portrait.evaluate((image) => (image as HTMLImageElement).naturalWidth),
    )
    .toBe(1170);
  await expect(
    page.getByRole("link", { name: "Invitations", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Log in", exact: true }).first(),
  ).toHaveAttribute("href", "/login");
  await expect(page.getByText("Example training week")).toBeVisible();
});

test("the workout section shows the live workout screen as a labelled example", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("http://ui-preview.test/");
  const section = page.getByRole("region", { name: /^Start the session\.\s*Log every set\.$/ });
  await section.scrollIntoViewIfNeeded();
  for (const step of ["Start", "Log", "Rest", "Finish"]) {
    await expect(section.getByRole("heading", { name: step, exact: true })).toBeVisible();
  }
  const preview = section.getByRole("figure", { name: /^Example live workout on a phone/ });
  await expect(preview).toBeVisible();
  // The drawing is decorative: the figure's label is all assistive technology reads,
  // so the static "Log set" is never mistaken for a working button.
  await expect(preview.getByRole("button")).toHaveCount(0);
  await expect(preview.getByText("Last time")).toBeVisible();
  for (const theme of ["light", "dark"] as const) {
    await page.evaluate(
      (dark) => document.documentElement.classList.toggle("dark", dark),
      theme === "dark",
    );
    for (const width of [320, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await section.scrollIntoViewIfNeeded();
      await mkdir("docs/images/live-workouts", { recursive: true });
      await section.screenshot({
        path: `docs/images/live-workouts/landing-workout-${width}-${theme}.png`,
        animations: "disabled",
      });
    }
  }
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
      .getByRole("link", { name: "Privacy" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("the founder note uses one card with aligned portrait and details in both themes", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("http://ui-preview.test/");
  const card = page.locator(".creator-card");
  const portrait = card.getByRole("img", {
    name: "Tanuj Chakraborty",
    exact: true,
  });
  const details = card.getByRole("heading", {
    name: "Tanuj Chakraborty",
    exact: true,
  });
  await expect(
    card.getByRole("heading", { name: "A note from the founder", exact: true }),
  ).toBeVisible();
  await expect(
    card.getByText("Made with intention", { exact: true }),
  ).toHaveCount(0);
  for (const theme of ["light", "dark"] as const) {
    await page.evaluate(
      (dark) => document.documentElement.classList.toggle("dark", dark),
      theme === "dark",
    );
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await portrait.scrollIntoViewIfNeeded();
      await portrait.evaluate((image) => (image as HTMLImageElement).decode());
      const imageBox = (await portrait.boundingBox())!;
      const textBox = (await details.boundingBox())!;
      const contentBox = (await details.locator("..").boundingBox())!;
      if (width >= 768) {
        expect(textBox.x - imageBox.x - imageBox.width).toBeGreaterThanOrEqual(
          40,
        );
        // Portrait and details start on the same line (top-aligned in the wide card).
        expect(Math.abs(imageBox.y - contentBox.y)).toBeLessThanOrEqual(1);
      } else {
        expect(textBox.y).toBeGreaterThanOrEqual(
          imageBox.y + imageBox.height + 32,
        );
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await mkdir("docs/images/epic-3/loaders-creator", { recursive: true });
      await card.screenshot({
        path: `docs/images/epic-3/loaders-creator/creator-${width}-${theme}.png`,
        animations: "disabled",
      });
    }
  }
});
