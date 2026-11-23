import { spawn } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import { docImage } from "../tests/helpers/doc-images";
import { todayIn } from "../lib/time-zone";
import { hasLocalSecretKey, signInAsNewLocalMember, supabaseState } from "./local-supabase";

/**
 * Loaders: the TrainGrid logo turning clockwise, as a page loader for client
 * navigations and as section loaders where a page streams its data.
 * Navigations are slowed on purpose (only the RSC request of the next page),
 * so the loading state is observable on a fast local machine.
 */

test.beforeEach(async ({ page, context, baseURL }) => {
  test.skip((await supabaseState(baseURL!)) !== "ok", "Local Supabase stack is not running");
  test.skip(!hasLocalSecretKey(), "SUPABASE_SECRET_KEY is not set for the local stack");
  await signInAsNewLocalMember(context, baseURL!);
  // These cases exercise an uncached navigation, not speculative prefetch.
  await page.route("**/*", async (route) => {
    if (route.request().headers()["next-router-prefetch"] === "1") await route.abort();
    else await route.continue();
  });
});

/**
 * Records every loader that appears from now on, as it is inserted. A section
 * loader can be on screen for only a few hundred milliseconds, which polling
 * assertions can miss on a busy machine; the record cannot.
 */
async function recordLoaders(page: Page) {
  await page.evaluate(() => {
    const seen: string[] = [];
    (window as unknown as { __loadersSeen: string[] }).__loadersSeen = seen;
    const note = () => {
      for (const el of document.querySelectorAll("[data-testid=section-loader], [data-testid=page-loader]")) {
        const entry = `${el.getAttribute("data-testid")}: ${el.textContent ?? ""}`;
        if (!seen.includes(entry)) seen.push(entry);
      }
    };
    new MutationObserver(note).observe(document.body, { childList: true, subtree: true });
  });
  return () => page.evaluate(() => (window as unknown as { __loadersSeen: string[] }).__loadersSeen);
}

/** Delays client-side navigation requests (React Server Component fetches) matching `pattern`. */
async function slowNavigations(page: Page, pattern: RegExp, ms = 1500) {
  await page.route(
    (url) => pattern.test(url.pathname + url.search),
    async (route) => {
      if (route.request().headers()["next-router-prefetch"] === "1") {
        await route.abort();
        return;
      }
      if (route.request().headers()["rsc"] === "1") await new Promise((resolve) => setTimeout(resolve, ms));
      await route.continue();
    },
  );
}

const pageLoader = (page: Page) => page.getByTestId("page-loader");

/**
 * Waits until React has hydrated the page. A click or submit before that is
 * handled by the browser as a full page load, which shows no client loader;
 * on a slower machine (CI) the first interaction can easily come that early.
 */
async function waitForHydration(page: Page) {
  await page.waitForFunction(() => {
    const main = document.getElementById("main-content");
    return !!main && Object.keys(main).some((key) => key.startsWith("__reactFiber"));
  });
}

test("following a link shows the spinning logo until the next page arrives", async ({ page }) => {
  await slowNavigations(page, /^\/library\/[0-9a-f-]{36}/);
  await page.goto("/library");
  await waitForHydration(page);
  await page.locator("main section li a[href^='/library/']").first().click();

  await expect(pageLoader(page)).toBeVisible();
  await expect(pageLoader(page).getByRole("status")).toHaveText("Loading page…");
  await page.waitForURL(/\/library\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(pageLoader(page)).toHaveCount(0);
});

test("the library search shows a loader while results load, keeping the view control", async ({ page }) => {
  await page.goto("/library");
  await waitForHydration(page);
  await slowNavigations(page, /^\/library\?/);
  const loadersSeen = await recordLoaders(page);
  await page.getByRole("searchbox", { name: "Search routines" }).fill("lower");
  await page.getByRole("button", { name: "Search", exact: true }).click();

  await expect.poll(loadersSeen).toContainEqual(expect.stringMatching(/^section-loader: Loading routines…/));
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
  await waitForHydration(page);
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
  expect(keyframes).toMatch(/rotate\((?:360deg|1turn)\)/);
  await page.waitForURL(/\/library\/[0-9a-f-]{36}$/);
});

test("with reduced motion the logo stays still", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/library");
  await waitForHydration(page);
  await slowNavigations(page, /^\/library\/[0-9a-f-]{36}/, 2000);
  await page.locator("main section li a[href^='/library/']").first().click();
  await expect(pageLoader(page).locator("svg")).toHaveCSS("animation-name", "none");
  await page.waitForURL(/\/library\/[0-9a-f-]{36}$/);
});

test("changing the planner's day shows the week's section loader, not the page loader", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  // Start mid-week (Wednesday), so the next day is in the same week whatever
  // today is: from a Sunday, "Next day" would open the following week's page.
  const { weekId } = todayIn("UTC");
  await page.goto(`/week/${weekId}?day=3`);
  await waitForHydration(page);
  await slowNavigations(page, /^\/week\/[^/]+\?day=/);
  const loadersSeen = await recordLoaders(page);
  await page.getByRole("link", { name: "Next day" }).click();
  await expect.poll(loadersSeen).toContainEqual(expect.stringMatching(/^section-loader: Loading your calendar…/));
  await page.waitForURL(`/week/${weekId}?day=4`);
  await expect(page.getByRole("heading", { name: /^Week of/ })).toBeVisible();
  await expect(page.getByTestId("section-loader")).toHaveCount(0);
  // Same page, another day: the page loader never shows.
  expect((await loadersSeen()).filter((entry) => entry.startsWith("page-loader"))).toEqual([]);
});

test("the planner streams the week behind a section loader without breaking 404s", async ({ page }) => {
  // The page shell (week navigation) and data both render; an invalid week is still a real 404.
  await page.goto("/week/current");
  await expect(page.getByRole("heading", { name: /^Week of/ })).toBeVisible();
  const response = await page.goto("/week/2026-W99");
  expect(response?.status()).toBe(404);
});

test("member home names the destination while loading, then streams its sections", async ({
  page,
}) => {
  await page.goto("/library");
  await waitForHydration(page);
  await slowNavigations(page, /^\/home(?:\?|$)/);
  const loadersSeen = await recordLoaders(page);
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Home", exact: true })
    .click();
  // Home has no route loading screen (its sections stream instead), so in
  // development and production alike the page loader covers the wait, named.
  await expect.poll(loadersSeen).toContainEqual(expect.stringMatching(/^page-loader: Loading your home…/));
  await expect(page).toHaveURL(/\/home$/);
  await expect(pageLoader(page)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "My routines", exact: true })).toBeVisible();
  await expect(page.getByTestId("section-loader")).toHaveCount(0);
});

test("going to the planner says it is loading the calendar", async ({ page }) => {
  await page.goto("/library");
  await waitForHydration(page);
  await slowNavigations(page, /^\/week\//);
  const loadersSeen = await recordLoaders(page);
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Planner", exact: true }).click();
  await expect.poll(loadersSeen).toContainEqual(expect.stringMatching(/^page-loader: Loading your calendar…/));
  await expect(page.getByRole("heading", { name: /^Week of/ })).toBeVisible();
  await expect(pageLoader(page)).toHaveCount(0);
});

/**
 * Holds the first RSC request matching `pattern` for `ms` and later ones for
 * `laterMs`, and counts them all, so a retry and its message are observable.
 */
async function slowFirstRequest(page: Page, pattern: RegExp, ms: number, laterMs = 3000) {
  const seen = { count: 0 };
  await page.route(
    (url) => pattern.test(url.pathname + url.search),
    async (route) => {
      if (route.request().headers()["next-router-prefetch"] === "1") {
        await route.abort();
        return;
      }
      if (route.request().headers()["rsc"] === "1") {
        seen.count += 1;
        await new Promise((resolve) => setTimeout(resolve, seen.count === 1 ? ms : laterMs));
      }
      await route.continue().catch(() => {});
    },
  );
  return seen;
}

test("a slow page says so after five seconds and asks the server again", async ({ page }) => {
  test.slow();
  await page.goto("/library");
  await waitForHydration(page);
  const requests = await slowFirstRequest(page, /^\/library\/[0-9a-f-]{36}/, 9000);
  await page.locator("main section li a[href^='/library/']").first().click();

  await expect(pageLoader(page)).toBeVisible();
  await expect(pageLoader(page).getByTestId("loader-detail")).toHaveCount(0);
  await expect(pageLoader(page).getByTestId("loader-detail")).toHaveText(
    "This is taking longer than usual. Trying again…",
    { timeout: 7000 },
  );
  // The retry is a second request for the same page, which is not held up.
  await page.waitForURL(/\/library\/[0-9a-f-]{36}$/, { timeout: 8000 });
  expect(requests.count).toBeGreaterThanOrEqual(2);
  await expect(pageLoader(page)).toHaveCount(0);
});

/**
 * Makes one server-side read genuinely slow: holds an exclusive lock on the
 * routines table of the local database for `ms`, so the server streams the
 * page and keeps that section waiting. Resolves once the lock is held.
 */
async function lockRoutinesTable(ms: number): Promise<{ released: Promise<void> } | null> {
  // Statements go one by one over stdin, so "locked" is printed while the lock is held.
  const child = spawn("docker", ["exec", "-i", "supabase_db_traingrid", "psql", "-U", "postgres", "-At", "-f", "-"]);
  child.stdin.end(
    `begin;\nlock table public.routines in access exclusive mode;\nselect 'locked';\nselect pg_sleep(${ms / 1000});\ncommit;\n`,
  );
  const released = new Promise<void>((resolve) => child.on("close", () => resolve()));
  const locked = await new Promise<boolean>((resolve) => {
    child.stdout.on("data", (chunk: Buffer) => {
      if (chunk.toString().includes("locked")) resolve(true);
    });
    child.on("error", () => resolve(false));
    child.on("close", () => resolve(false));
  });
  return locked ? { released } : null;
}

test("a slow section says so after five seconds and asks the server again", async ({ page }) => {
  test.slow();
  // Compile/hydrate the shell before starting the timed database hold.
  await page.goto("/home");
  await waitForHydration(page);
  await expect(page.getByTestId("section-loader")).toHaveCount(0);
  const lock = await lockRoutinesTable(9000);
  test.skip(!lock, "Needs docker access to the local database container");
  const requests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/home") requests.push(request.headers()["rsc"] ?? "document");
  });

  await page.goto("/home", { waitUntil: "commit" });
  // The frame and the unaffected sections arrive; the routines wait behind their loader.
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Weekly planned sessions" })).toBeVisible();
  const loader = page.getByTestId("section-loader").filter({ hasText: "Loading your routines…" });
  await expect(loader).toBeVisible();
  const note = loader.getByText("This is taking longer than usual. Trying again…");
  await expect(note).toBeHidden();
  await expect(note).toBeVisible({ timeout: 7000 });
  await expect(page.getByTestId("slow-section-announcer")).toHaveText(
    "This is taking longer than usual. Trying again…",
  );
  // The retry is one fresh request for the page's data, not a loop, and the
  // loader it re-renders keeps the note on screen.
  await expect.poll(() => requests.filter((kind) => kind === "1").length).toBe(1);
  await page.waitForTimeout(1500);
  await expect(page.getByTestId("section-loader").getByText("This is taking longer than usual. Trying again…")).toBeVisible();

  await lock!.released;
  await expect(page.getByRole("heading", { name: "Make a routine your own." })).toBeVisible();
  await expect(page.getByTestId("section-loader")).toHaveCount(0);
  expect(requests.filter((kind) => kind === "1")).toHaveLength(1);
});

test("public landing uses the existing navigation logo while loading", async ({
  page,
  context,
}) => {
  await context.clearCookies();
  await page.goto("/login");
  await waitForHydration(page);
  await slowNavigations(page, /^\/(?:\?|$)/);
  const loadersSeen = await recordLoaders(page);
  await page
    .getByRole("banner")
    .getByRole("link", { name: "TrainGrid", exact: true })
    .click();
  // The page loader (next dev) or the landing page's own prefetched loading
  // screen (production build): either way the spinning logo is shown.
  await expect.poll(loadersSeen).toContainEqual(expect.stringMatching(/^(page|section)-loader: Loading/));
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
      await docImage(page, `docs/images/epic-3/loaders-creator/signout-${width}-${theme}.png`, {
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
