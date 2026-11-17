import { mkdir } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { hasLocalSecretKey, signInAsNewLocalMember, supabaseState } from "./local-supabase";

/**
 * Loaders: the TrainGrid logo turning clockwise, as a page loader for client
 * navigations and as section loaders where a page streams its data.
 * Navigations are slowed on purpose (only the RSC request of the next page),
 * so the loading state is observable on a fast local machine.
 */

test.beforeEach(async ({ context, baseURL }) => {
  test.skip((await supabaseState(baseURL!)) !== "ok", "Local Supabase stack is not running");
  test.skip(!hasLocalSecretKey(), "SUPABASE_SECRET_KEY is not set for the local stack");
  await signInAsNewLocalMember(context, baseURL!);
});

/** Delays client-side navigation requests (React Server Component fetches) matching `pattern`. */
async function slowNavigations(page: Page, pattern: RegExp, ms = 1500) {
  await page.route(
    (url) => pattern.test(url.pathname + url.search),
    async (route) => {
      if (route.request().headers()["rsc"] === "1") await new Promise((resolve) => setTimeout(resolve, ms));
      await route.continue();
    },
  );
}

const pageLoader = (page: Page) => page.getByTestId("page-loader");

test("following a link shows the spinning logo until the next page arrives", async ({ page }) => {
  await slowNavigations(page, /^\/library\/[0-9a-f-]{36}/);
  await page.goto("/library");
  await page.waitForFunction(() => {
    const summary = document.querySelector("header summary");
    return !!summary && Object.keys(summary).some((key) => key.startsWith("__reactFiber"));
  });
  await page.locator("main section li a[href^='/library/']").first().click();

  await expect(pageLoader(page)).toBeVisible();
  await expect(pageLoader(page).getByRole("status")).toHaveText("Loading page…");
  await page.waitForURL(/\/library\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(pageLoader(page)).toHaveCount(0);
});

test("the library search shows a loader while results load, keeping the view control", async ({ page }) => {
  await page.goto("/library");
  await slowNavigations(page, /^\/library\?/);
  await page.getByRole("searchbox", { name: "Search routines" }).fill("lower");
  await page.getByRole("button", { name: "Search", exact: true }).click();

  await expect(page.getByTestId("section-loader")).toBeVisible();
  await expect(page.getByTestId("section-loader")).toContainText("Loading routines…");
  await expect(page.getByRole("navigation", { name: "Library view" })).toBeVisible();
  await page.waitForURL(/q=lower/);
  await expect(page.getByTestId("section-loader")).toHaveCount(0);
  await expect(pageLoader(page)).toHaveCount(0);
});

test("fast navigations do not flash the loader", async ({ page }) => {
  await page.goto("/library");
  let seen = false;
  await page.exposeFunction("markLoader", () => (seen = true));
  await page.evaluate(() => {
    new MutationObserver(() => {
      if (document.querySelector("[data-testid=page-loader]")) (window as unknown as { markLoader: () => void }).markLoader();
    }).observe(document.body, { childList: true, subtree: true });
  });
  // Same URL: not a navigation at all.
  await page.getByRole("navigation", { name: "Library view" }).getByRole("link", { name: "All" }).click();
  // A link that opens elsewhere: not this page's navigation.
  await page.getByRole("contentinfo").getByRole("link", { name: "GitHub" }).click({ modifiers: ["ControlOrMeta"] });
  await page.waitForTimeout(400);
  expect(seen).toBe(false);
});

test("the logo turns clockwise", async ({ page }) => {
  await page.goto("/library");
  await slowNavigations(page, /^\/library\/[0-9a-f-]{36}/, 2000);
  await page.locator("main section li a[href^='/library/']").first().click();
  const logo = pageLoader(page).locator("svg");
  // Tailwind's spin turns from 0 to +360deg, which on screen is clockwise.
  await expect(logo).toHaveCSS("animation-name", "spin");
  await expect(logo).toHaveCSS("animation-duration", "1.1s");
  const keyframes = await page.evaluate(() => {
    for (const sheet of Array.from(document.styleSheets)) {
      for (const rule of Array.from(sheet.cssRules ?? [])) {
        if (rule instanceof CSSKeyframesRule && rule.name === "spin") return rule.cssText;
      }
    }
    return "";
  });
  expect(keyframes).toMatch(/rotate\(360deg\)/);
  await page.waitForURL(/\/library\/[0-9a-f-]{36}$/);
});

test("with reduced motion the logo stays still", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/library");
  await slowNavigations(page, /^\/library\/[0-9a-f-]{36}/, 2000);
  await page.locator("main section li a[href^='/library/']").first().click();
  await expect(pageLoader(page).locator("svg")).toHaveCSS("animation-name", "none");
  await page.waitForURL(/\/library\/[0-9a-f-]{36}$/);
});

test("changing the planner's day shows the week's section loader, not the page loader", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/week/current");
  await page.waitForURL(/\/week\//);
  await slowNavigations(page, /^\/week\/[^/]+\?day=/);
  await page.getByRole("link", { name: "Next day" }).click();
  await expect(page.getByTestId("section-loader")).toContainText("Loading your week…");
  await expect(page.getByRole("heading", { name: /^Week of/ })).toBeVisible();
  await expect(pageLoader(page)).toHaveCount(0);
  await expect(page.getByTestId("section-loader")).toHaveCount(0);
});

test("the planner streams the week behind a section loader without breaking 404s", async ({ page }) => {
  // The page shell (week navigation) and data both render; an invalid week is still a real 404.
  await page.goto("/week/current");
  await expect(page.getByRole("heading", { name: /^Week of/ })).toBeVisible();
  await expect(page.getByText("Duplicate week onto")).toBeVisible();
  const response = await page.goto("/week/2026-W99");
  expect(response?.status()).toBe(404);
});

test("member home uses the existing navigation logo while loading", async ({
  page,
}) => {
  await page.goto("/library");
  await slowNavigations(page, /^\/home(?:\?|$)/);
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Home", exact: true })
    .click();
  await expect(pageLoader(page)).toBeVisible();
  await expect(pageLoader(page).locator("svg")).toHaveCSS(
    "animation-name",
    "spin",
  );
  await expect(page).toHaveURL(/\/home$/);
  await expect(pageLoader(page)).toHaveCount(0);
  await expect(page.getByTestId("section-loader")).toHaveCount(0);
});

test("public landing uses the existing navigation logo while loading", async ({
  page,
  context,
}) => {
  await context.clearCookies();
  await page.goto("/login");
  await slowNavigations(page, /^\/(?:\?|$)/);
  await page
    .getByRole("banner")
    .getByRole("link", { name: "TrainGrid", exact: true })
    .click();
  await expect(pageLoader(page)).toBeVisible();
  await expect(page).toHaveURL(/:\d+\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Plan the week.",
  );
  await expect(pageLoader(page)).toHaveCount(0);
});

for (const theme of ["light", "dark"] as const) {
  for (const width of [360, 1440]) {
    test(`signout shows real pending progress (${theme}, ${width})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.goto("/home");
      await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toBeVisible();
      await page.route("**/*", async (route) => {
        if (
          route.request().method() === "POST" &&
          route.request().headers()["next-action"]
        ) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
        await route.continue();
      });
      if (width === 360) {
        await page.waitForFunction(() => {
          const summary = document.querySelector("header summary");
          return (
            !!summary &&
            Object.keys(summary).some((key) => key.startsWith("__reactFiber"))
          );
        });
        await page.getByLabel("Open menu", { exact: true }).click();
      }
      await page.getByRole("button", { name: "Sign out", exact: true }).click();
      const loader = page.getByTestId("signout-loader");
      await expect(loader.getByRole("status")).toHaveText("Signing you out...");
      await expect(
        page.getByRole("button", { name: "Signing you out...", exact: true }),
      ).toBeDisabled();
      await expect(loader.locator("svg")).toHaveCSS("animation-name", "none");
      await mkdir("docs/images/epic-3/loaders-creator", { recursive: true });
      await page.screenshot({
        path: `docs/images/epic-3/loaders-creator/signout-${width}-${theme}.png`,
        animations: "disabled",
        style: "nextjs-portal { display: none !important; }",
      });
      await expect(page).toHaveURL(/\/login$/);
      await expect(loader).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Sign out", exact: true }),
      ).toHaveCount(0);
    });
  }
}
