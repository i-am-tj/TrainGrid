import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { dashboardFixtures } from "./fixtures/dashboard";
import { loginFixtures } from "./fixtures/login";

const preview = "http://ui-preview.test";
test.beforeEach(async ({ page }) => {
  await page.route(`${preview}/**`, async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const file =
      pathname.endsWith(".html") || pathname === "/styles.css"
        ? path.join(process.cwd(), ".next/ui-preview", pathname)
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
    test(`${theme}: all member states fit ${width} × ${height}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: width!, height: height! });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      for (const name of [
        ...Object.keys(dashboardFixtures).map((name) => `dashboard-${name}`),
        ...loginFixtures.map((name) => `login-${name}`),
      ]) {
        await page.goto(`${preview}/${name}.html`);
        await page.evaluate(
          (dark) => document.documentElement.classList.toggle("dark", dark),
          theme === "dark",
        );
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          name,
        ).toBe(true);
        await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
        if (
          (width === 360 || (width === 1440 && height === 900)) &&
          [
            "dashboard-ready",
            "dashboard-empty-week",
            "login-signed-out",
          ].includes(name)
        ) {
          await mkdir("docs/images/epic-3/ui-02", { recursive: true });
          await page.screenshot({
            path: `docs/images/epic-3/ui-02/${name}-${width}-${theme}.png`,
            fullPage: true,
          });
        }
      }
    });
  }
}

test("dashboard preserves prepared counts, times, details and navigation targets", async ({
  page,
}) => {
  await page.goto(`${preview}/dashboard-ready.html`);
  await expect(
    page.getByRole("heading", { name: "Today’s planned sessions" }),
  ).toBeVisible();
  await expect(page.getByText("No set time", { exact: true })).toBeVisible();
  await expect(page.getByText("07:00 · 45 min")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open session: Lower A", exact: true }),
  ).toHaveAttribute("href", "/session/example-lift");
  await expect(
    page.getByRole("link", { name: "Schedule routine: Lower A", exact: true }),
  ).toHaveAttribute("href", "/week/current/add?routine=example-lower");
  await expect(
    page.getByRole("link", { name: "Browse My Library" }),
  ).toHaveAttribute("href", "/library?scope=mine");
  const week = page.getByRole("navigation", {
    name: "Weekly planned sessions",
  });
  await expect(week.getByRole("link")).toHaveCount(7);
  await expect(
    week.getByRole("link", { name: "Tue 17, today: 3 planned sessions" }),
  ).toHaveAttribute("aria-current", "date");
  await expect(
    week.getByRole("link", { name: "Wed 18: 0 planned sessions" }),
  ).toHaveAttribute("href", "/week/2026-W47?day=3");
  await expect(
    page.getByText(/completed|streak|calories|performance/i),
  ).toHaveCount(0);
});

test("empty day, empty week and missing routines remain distinct", async ({
  page,
}) => {
  await page.goto(`${preview}/dashboard-empty-today.html`);
  await expect(
    page.getByRole("heading", { name: "A little space in your day." }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Plan a session" }),
  ).toHaveAttribute("href", "/week/2026-W47/add?day=2");
  await expect(
    page.getByRole("link", { name: "Mon 16: 1 planned session", exact: true }),
  ).toBeVisible();
  await page.goto(`${preview}/dashboard-empty-week.html`);
  await expect(page.getByText("An open week.", { exact: false })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Make a routine your own." }),
  ).toBeVisible();
  await page.goto(`${preview}/dashboard-no-routines.html`);
  await expect(
    page.getByRole("link", { name: "Open session: Lower A", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Create your first routine" }),
  ).toHaveAttribute("href", "/library/new");
});

test("loading and recoverable error never resemble empty data", async ({
  page,
}) => {
  await page.goto(`${preview}/dashboard-loading.html`);
  await expect(page.getByRole("status")).toContainText(
    "Loading your training plan",
  );
  await expect(page.locator("[aria-busy=true]")).toHaveCount(1);
  await expect(
    page.getByText("Nothing is planned for today.", { exact: false }),
  ).toHaveCount(0);
  await page.goto(`${preview}/dashboard-error.html`);
  await expect(page.getByRole("alert")).toContainText("couldn’t be loaded");
  await expect(page.getByRole("link", { name: "Try again" })).toHaveAttribute(
    "href",
    "/home",
  );
  await expect(
    page.getByRole("navigation", { name: "Weekly planned sessions" }),
  ).toHaveCount(0);
});

test("login refusal, error, unavailable and pending states are honest", async ({
  page,
}) => {
  await page.goto(`${preview}/login-not-invited.html`);
  await expect(
    page.getByText("TrainGrid is currently invite-only.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toHaveCount(0);
  await page.goto(`${preview}/login-email-error.html`);
  await expect(page.getByRole("alert")).toContainText("verified email");
  await page.goto(`${preview}/login-unavailable.html`);
  await expect(
    page.getByText("Sign-in is not available on this deployment."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toHaveCount(0);
  await page.goto(`${preview}/login-member.html`);
  await expect(page.getByText("example.member@example.test")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Go to the planner" }),
  ).toHaveAttribute("href", "/week/current");
  await page.goto(`${preview}/login-pending.html`);
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Continue with GitHub" }),
  ).toHaveAttribute("aria-busy", "true");
});

test("dashboard links support keyboard focus with reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${preview}/dashboard-ready.html`);
  const planner = page.getByRole("link", { name: "Open weekly planner" });
  await planner.focus();
  await expect(planner).toBeFocused();
  expect(
    await planner.evaluate((el) => getComputedStyle(el).boxShadow),
  ).not.toBe("none");
  const day = page.getByRole("link", {
    name: "Tue 17, today: 3 planned sessions",
  });
  expect(
    await day.evaluate((el) => getComputedStyle(el).transitionDuration),
  ).toBe("0s");
});
