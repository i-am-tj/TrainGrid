import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";

async function filesIn(folder: string): Promise<string[]> {
  const entries = await readdir(folder, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) =>
        entry.isDirectory()
          ? filesIn(path.join(folder, entry.name))
          : [path.join(folder, entry.name)],
      ),
    )
  ).flat();
}

test.beforeEach(async ({ page }) => {
  await page.route("http://ui-preview.test/**", async (route) => {
    const name = new URL(route.request().url()).pathname;
    const file =
      name === "/"
        ? path.resolve(".next/ui-preview/index.html")
        : name.endsWith(".html") || name === "/styles.css"
          ? path.join(process.cwd(), ".next/ui-preview", name)
          : path.join(process.cwd(), "public", name);
    await route.fulfill({
      body: await readFile(file),
      contentType: name.endsWith(".css")
        ? "text/css"
        : name.endsWith(".svg")
          ? "image/svg+xml"
          : name.endsWith(".jpg")
            ? "image/jpeg"
            : name.endsWith(".png")
              ? "image/png"
              : "text/html",
    });
  });
});

test("production sources never import example fixtures or test engines", async () => {
  for (const file of [
    ...(await filesIn("app")),
    ...(await filesIn("components")),
    ...(await filesIn("lib")),
  ].filter((file) => /\.[tj]sx?$/.test(file) && !file.endsWith(".test.ts"))) {
    const source = await readFile(file, "utf8");
    expect(source, file).not.toMatch(
      /(?:from\s*|import\s*\(|require\s*\()\s*["'][^"']*(?:tests\/ui\/fixtures|build-ui-preview|axe-core|playwright)/,
    );
  }
});

test("landing, dashboard and empty states reflow at enlarged text without clipped titles", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 720 });
    for (const url of [
      "/",
      "/dashboard-ready.html",
      "/dashboard-empty-week.html",
      "/dashboard-long-names.html",
      "/login-signed-out.html",
    ]) {
      await page.goto(`http://ui-preview.test${url}`);
      await page.evaluate(() => {
        document.documentElement.style.fontSize = "200%";
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${url} ${width}`,
      ).toBe(true);
      for (const control of await page
        .locator("main button, main a.ui-control")
        .all()) {
        expect(
          await control.evaluate(
            (element) => element.scrollWidth <= element.clientWidth + 1,
          ),
          `${url} ${width}: ${await control.textContent()}`,
        ).toBe(true);
      }
      for (const heading of await page
        .locator("main h1, main h2, main h3")
        .all()) {
        expect(
          await heading.evaluate(
            (element) => element.scrollWidth <= element.clientWidth + 1,
          ),
          `${url} ${width}: ${await heading.textContent()}`,
        ).toBe(true);
      }
    }
  }
});

test("hero animation does not block its CTA and artwork has stable lazy dimensions", async ({
  page,
}) => {
  await page.route("http://ui-preview.test/login", (route) =>
    route.fulfill({ body: "Sign-in destination", contentType: "text/plain" }),
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("http://ui-preview.test/");
  const portrait = page.getByRole("img", {
    name: "Tanuj Chakraborty",
    exact: true,
  });
  await expect(portrait).toHaveAttribute("width", "1170");
  await expect(portrait).toHaveAttribute("height", "1170");
  await expect(portrait).toHaveAttribute("loading", "lazy");
  await expect(portrait).toHaveAttribute("src", /^\/marketing\//);
  expect(
    await page
      .locator(".hero-copy")
      .evaluate((element) => getComputedStyle(element).animationDuration),
  ).toBe("0.35s");
  await page
    .getByRole("main")
    .getByRole("link", { name: "Log in", exact: true })
    .click();
  await expect(page).toHaveURL("http://ui-preview.test/login");
});
