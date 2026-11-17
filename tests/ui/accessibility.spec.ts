import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { contrastRatio } from "../helpers/contrast";
import { accessibilityResults } from "../helpers/accessibility";
import { dashboardFixtures } from "./fixtures/dashboard";
import { loginFixtures } from "./fixtures/login";

test.beforeEach(async ({ page }) => {
  await page.route("http://ui-preview.test/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const file =
      pathname === "/"
        ? path.resolve(".next/ui-preview/index.html")
        : pathname.endsWith(".html") || pathname === "/styles.css"
          ? path.join(process.cwd(), ".next/ui-preview", pathname)
          : path.join(process.cwd(), "public", pathname);
    await route.fulfill({
      body: await readFile(file),
      contentType: pathname.endsWith(".css")
        ? "text/css"
        : pathname.endsWith(".svg")
          ? "image/svg+xml"
          : pathname.endsWith(".jpg")
            ? "image/jpeg"
            : pathname.endsWith(".png")
              ? "image/png"
              : "text/html",
    });
  });
});

for (const theme of ["light", "dark"] as const) {
  for (const width of [320, 1440]) {
    test(`WCAG and landmark audit of all presentation states (${theme}, ${width}px)`, async ({
      page,
    }, testInfo) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      const reports = [];
      for (const name of [
        "index",
        ...Object.keys(dashboardFixtures).map((name) => `dashboard-${name}`),
        ...loginFixtures.map((name) => `login-${name}`),
        "invitations-ready",
        "invitations-empty",
        "invitation-email",
      ]) {
        await page.goto(
          `http://ui-preview.test/${name === "index" ? "" : `${name}.html`}`,
        );
        await page.evaluate(
          (dark) => document.documentElement.classList.toggle("dark", dark),
          theme === "dark" && name !== "invitation-email",
        );
        const report = await accessibilityResults(
          page,
          name === "invitation-email",
        );
        // Axe cannot resolve decorative underline images and the hero composition.
        // Check their solid text/surface colors separately; preserve the incomplete report.
        const contrastChecks = await page.evaluate(
          (targets) => {
            const canvas = document.createElement("canvas");
            canvas.width = canvas.height = 1;
            const context = canvas.getContext("2d")!;
            const rgb = (color: string) => {
              context.clearRect(0, 0, 1, 1);
              context.fillStyle = color;
              context.fillRect(0, 0, 1, 1);
              return Array.from(context.getImageData(0, 0, 1, 1).data);
            };
            return targets.map((target) => {
              const element = document.querySelector(target)!;
              let parent: Element | null = element;
              let background = [255, 255, 255, 255];
              while (parent) {
                const candidate = rgb(getComputedStyle(parent).backgroundColor);
                if (candidate[3] === 255) {
                  background = candidate;
                  break;
                }
                parent = parent.parentElement;
              }
              const foreground = rgb(getComputedStyle(element).color);
              return {
                target,
                foreground: `rgb(${foreground.slice(0, 3).join(",")})`,
                background: `rgb(${background.slice(0, 3).join(",")})`,
              };
            });
          },
          report.incomplete
            .filter((item) => item.id === "color-contrast")
            .flatMap((item) => item.targets.map((target) => String(target[0]))),
        );
        for (const check of contrastChecks) {
          expect(
            contrastRatio(check.foreground, check.background),
            `${name}: ${check.target}`,
          ).toBeGreaterThanOrEqual(4.5);
        }
        reports.push({ name, ...report, contrastChecks });
      }
      await mkdir(".next/ui-audit", { recursive: true });
      await writeFile(
        `.next/ui-audit/components-${theme}-${width}.json`,
        JSON.stringify(reports, null, 2),
      );
      await testInfo.attach(`component-accessibility-${theme}`, {
        body: JSON.stringify(reports, null, 2),
        contentType: "application/json",
      });
      expect(
        reports.filter((report) => report.violations.length),
        JSON.stringify(
          reports.filter((report) => report.violations.length),
          null,
          2,
        ),
      ).toEqual([]);
    });
  }
}
