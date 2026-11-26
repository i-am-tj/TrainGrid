import { mkdir, writeFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { contrastRatio } from "../tests/helpers/contrast";
import { accessibilityResults } from "../tests/helpers/accessibility";
import { docImage } from "../tests/helpers/doc-images";
import { createRoutine } from "./planner-helpers";
import {
  hasLocalSecretKey,
  signInAsLocalAdmin,
  signInAsNewLocalMember,
  supabaseState,
} from "./local-supabase";

const folder = ".next/ui-audit";
async function audit(page: Page, name: string) {
  await expect(
    page.getByRole("main").getByRole("heading", { level: 1 }),
  ).toBeVisible();
  await expect(page.getByTestId("section-loader")).toHaveCount(0);
  for (const field of await page
    .locator(
      'main input.ui-control:not([type="hidden"]), main textarea.ui-control, main select.ui-control',
    )
    .all()) {
    if (!(await field.isVisible())) continue;
    const colors = await field.evaluate((element) => {
      const styles = getComputedStyle(element);
      return {
        border: styles.borderTopColor,
        background: styles.backgroundColor,
      };
    });
    expect(
      contrastRatio(colors.border, colors.background),
      `${name}: visible form boundary`,
    ).toBeGreaterThanOrEqual(3);
  }
  if (/^(planner|library)-/.test(name)) {
    await docImage(page, `docs/images/epic-3/ui-04/${name}.png`, { fullPage: true });
  }
  const results = await accessibilityResults(page);
  await mkdir(folder, { recursive: true });
  await writeFile(`${folder}/${name}.json`, JSON.stringify(results, null, 2));
  expect(
    results.violations,
    `${name}: ${JSON.stringify(results.violations, null, 2)}`,
  ).toEqual([]);
}

test.beforeEach(async ({ baseURL }) => {
  expect(
    await supabaseState(baseURL!),
    "Production audit requires the local Supabase stack",
  ).toBe("ok");
  expect(
    hasLocalSecretKey(),
    "Production audit requires local fixture credentials",
  ).toBe(true);
});

for (const scheme of ["light", "dark"] as const) {
  test(`production login WCAG, keyboard and 400% reflow (${scheme})`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    for (const [name, url] of [
      ["login", "/login"],
      ["email-error", "/login?error=email"],
      ["invite-error", "/login?error=invite"],
    ]) {
      await page.goto(url!);
      await expect(
        page.getByRole("button", { name: /^Switch to/ }),
      ).toBeVisible();
      await audit(page, `${name}-${scheme}`);
    }
    await page.goto("/login");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", {
      name: "Skip to content",
      exact: true,
    });
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("main")).toBeFocused();
    for (const width of [320, 360, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 720 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    // At 400% browser zoom a 1280px-wide display exposes 320 CSS pixels.
    await page.setViewportSize({ width: 320, height: 256 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.getByRole("button", { name: "Continue with Google", exact: true }),
    ).toBeVisible();
  });

  test(`production member screens WCAG (${scheme})`, async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAsNewLocalMember(context, baseURL!);
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    const routineUrl = await createRoutine(
      page,
      "An accessible training routine",
      "strength",
      [["Back squat", "4 × 6", { rest: "2 min", equipment: ["Barbell"] }]],
    );
    const routinePath = new URL(routineUrl).pathname;
    const routineId = routinePath.split("/").at(-1)!;
    await page.goto(`/week/2026-W47/add?routine=${routineId}&day=2&time=07:00`);
    await page.getByRole("button", { name: "Schedule routine", exact: true }).click();
    await page.waitForURL(/\/week\/2026-W47(?:\?|$)/);
    const sessionPath = (await page
      .getByRole("region", { name: "Weekly calendar time grid" })
      .getByRole("link", {
        name: "An accessible training routine, 07:00",
        exact: true,
      })
      .getAttribute("href"))!;
    for (const width of [360, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const [name, url] of [
        ["planner", "/week/2026-W47?day=2"],
        ["library", "/library"],
        ["routine", routinePath],
        ["routine-editor", `${routinePath}/edit`],
        ["add-session", `/week/2026-W47/add?routine=${routineId}`],
        ["session", sessionPath],
        ["session-edit", `${sessionPath}/edit`],
        ["customize", `${sessionPath}/customize`],
      ]) {
        await page.goto(url!);
        await audit(page, `${name}-${width}-${scheme}`);
        if (width === 360) {
          await page.evaluate(() => {
            document.documentElement.style.fontSize = "200%";
          });
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
            `${name} enlarged text`,
          ).toBe(true);
        }
      }
    }
  });

  test(`production invitations WCAG and preview keyboard (${scheme})`, async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAsLocalAdmin(context, baseURL!);
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    await page.goto("/admin/invitations");
    await audit(page, `invitations-${scheme}`);
    const preview = page
      .locator("summary")
      .filter({ hasText: "Preview invitation email" });
    await preview.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByLabel("Preview recipient", { exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(
      page.getByLabel("Preview recipient", { exact: true }),
    ).toBeFocused();
    // The same email HTML is audited as a standalone document in the component suite.
    await page.getByLabel("Preview recipient", { exact: true }).fill("invalid");
    await audit(page, `invalid-preview-${scheme}`);
  });
}

test("production login keeps network and layout costs bounded", async ({
  page,
  baseURL,
}) => {
  const external = new Set<string>();
  page.on("request", (request) => {
    if (!request.url().startsWith(baseURL!))
      external.add(new URL(request.url()).origin);
  });
  await page.addInitScript(() => {
    const entry = window as typeof window & { __layoutShift: number };
    entry.__layoutShift = 0;
    new PerformanceObserver((list) => {
      for (const item of list.getEntries() as Array<
        PerformanceEntry & { value: number; hadRecentInput: boolean }
      >)
        if (!item.hadRecentInput) entry.__layoutShift += item.value;
    }).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto("/login", { waitUntil: "networkidle" });
  const metrics = await page.evaluate(() => ({
    cls: (window as typeof window & { __layoutShift: number }).__layoutShift,
    resources: (
      performance.getEntriesByType("resource") as PerformanceResourceTiming[]
    ).map((entry) => ({
      name: new URL(entry.name).pathname,
      bytes: entry.encodedBodySize,
      type: entry.initiatorType,
    })),
  }));
  const scripts = metrics.resources.filter((entry) =>
    entry.name.endsWith(".js"),
  );
  const bytes = scripts.reduce((sum, entry) => sum + entry.bytes, 0);
  await mkdir(folder, { recursive: true });
  await writeFile(
    `${folder}/production-performance.json`,
    JSON.stringify(
      {
        cls: metrics.cls,
        scriptBytes: bytes,
        externalOrigins: [...external],
        resources: metrics.resources,
      },
      null,
      2,
    ),
  );
  expect([...external]).toEqual([]);
  expect(metrics.cls).toBeLessThan(0.1);
  expect(bytes).toBeGreaterThan(0);
  expect(bytes).toBeLessThan(350_000);
  expect(scripts.some((entry) => /axe/i.test(entry.name))).toBe(false);
});

test("production admin preview defers its image and makes no send requests", async ({
  page,
  context,
  baseURL,
}) => {
  await signInAsLocalAdmin(context, baseURL!);
  const requests: string[] = [];
  const posts: string[] = [];
  page.on("request", (request) => {
    requests.push(request.url());
    if (request.method() === "POST") posts.push(request.url());
  });
  await page.goto("/admin/invitations", { waitUntil: "networkidle" });
  expect(
    requests.some((url) =>
      url.endsWith("/brand/traingrid-logo-google-120.png"),
    ),
  ).toBe(false);
  const logo = page.waitForRequest((request) =>
    request.url().endsWith("/brand/traingrid-logo-google-120.png"),
  );
  await page
    .locator("summary")
    .filter({ hasText: "Preview invitation email" })
    .click();
  await logo;
  await page
    .getByLabel("Preview recipient", { exact: true })
    .fill("example.preview@example.test");
  await expect(
    page
      .getByRole("main")
      .getByText("This preview uses an example address.", { exact: false }),
  ).toBeVisible();
  expect(posts).toEqual([]);
});
