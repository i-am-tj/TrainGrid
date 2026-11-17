import { expect, test, type Page } from "@playwright/test";
import { todayIn } from "../lib/time-zone";
import {
  createLocalRoutineFor,
  createLocalSessionFor,
  hasLocalSecretKey,
  signInAsNewLocalMember,
  supabaseState,
} from "./local-supabase";

/**
 * Epic 3 integration: the public landing page at / and the member home at
 * /home, with real member data.
 */

async function landmarks(page: Page) {
  // A <header> is a banner landmark only outside main/article/aside/nav/section.
  return page.evaluate(() => ({
    banner: [...document.querySelectorAll("header, [role=banner]")].filter(
      (el) => el.getAttribute("role") === "banner" || !el.parentElement?.closest("main, article, aside, nav, section"),
    ).length,
    main: document.querySelectorAll("main").length,
    mainId: document.querySelector("main")?.id,
    footer: document.querySelectorAll("footer").length,
  }));
}

test.describe("public landing page", () => {
  test("anonymous / is public marketing only, with one header, main and footer", async ({ page, request }) => {
    const response = await request.get("/", { maxRedirects: 0 });
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toContain("Plan the week.");
    // Nothing from the member app or the session makes it into public HTML.
    for (const privateText of ["Sign out", "Invitations", "Export", "Welcome back", "/api/export"]) {
      expect(html, privateText).not.toContain(privateText);
    }
    // Metadata uses the configured origin for absolute URLs and canonical.
    expect(html).toMatch(/<link rel="canonical" href="http:\/\/127\.0\.0\.1:3010\/?"/);
    expect(html).toContain('content="http://127.0.0.1:3010/marketing/og-preview.png"');

    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Own the work.");
    const banner = page.getByRole("banner");
    await expect(banner.getByRole("link", { name: "Log in" }).first()).toHaveAttribute("href", "/login");
    await expect(banner.getByRole("link", { name: "TrainGrid", exact: true })).toHaveAttribute("href", "/");
    for (const name of ["Home", "Planner", "Library"]) {
      await expect(banner.getByRole("link", { name, exact: true })).toHaveCount(0);
    }
    expect(await landmarks(page)).toEqual({ banner: 1, main: 1, mainId: "main-content", footer: 1 });

    // In-page anchors work from the public header.
    await page.setViewportSize({ width: 1280, height: 800 });
    await banner.getByRole("link", { name: "Features" }).click();
    await expect(page).toHaveURL(/\/#features$/);
  });

  test("the landing page renders the same for a signed-in member, with no member data", async ({
    page,
    context,
    baseURL,
  }) => {
    test.skip((await supabaseState(baseURL!)) !== "ok", "Local Supabase stack is not running");
    test.skip(!hasLocalSecretKey(), "SUPABASE_SECRET_KEY is not set for the local stack");
    const { userId } = await signInAsNewLocalMember(context, baseURL!);
    const today = todayIn("UTC");
    await createLocalSessionFor(userId, "Private landing check", today.date);

    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Plan the week.");
    expect(await page.content()).not.toContain("Private landing check");
    await expect(page.getByRole("banner").getByRole("link", { name: "Planner" })).toHaveCount(0);
  });

  test("an unknown page still asks an anonymous visitor to sign in first", async ({ page }) => {
    await page.goto("/no-such-page-here");
    await expect(page).toHaveURL(/\/login\?next=%2Fno-such-page-here$/);
  });
});

test.describe("member home", () => {
  test.beforeEach(async ({ baseURL }) => {
    test.skip((await supabaseState(baseURL!)) !== "ok", "Local Supabase stack is not running");
    test.skip(!hasLocalSecretKey(), "SUPABASE_SECRET_KEY is not set for the local stack");
  });

  test("shows the member's own sessions, week counts and routines, never another member's", async ({
    page,
    context,
    browser,
    baseURL,
  }) => {
    const today = todayIn("UTC");
    const { userId } = await signInAsNewLocalMember(context, baseURL!);
    await createLocalSessionFor(userId, "Mine today", today.date);
    await createLocalRoutineFor(userId, "My dashboard routine");

    const other = await browser.newContext({ baseURL });
    try {
      const { userId: otherId } = await signInAsNewLocalMember(other, baseURL!);
      await createLocalSessionFor(otherId, "Someone else's today", today.date);
      await createLocalSessionFor(otherId, "Someone else's again", today.date);
      await createLocalRoutineFor(otherId, "Someone else's routine");
    } finally {
      await other.close();
    }

    await page.goto("/home");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Welcome back, E2E Member.");
    const todaySection = page.getByRole("region", { name: "Today’s planned sessions" });
    await expect(todaySection.getByRole("link", { name: "Mine today", exact: true })).toBeVisible();
    await expect(page.getByText("Someone else's", { exact: false })).toHaveCount(0);

    // Today's count is this member's only: one session.
    const todayLink = page
      .getByRole("navigation", { name: "Weekly planned sessions" })
      .getByRole("link", { name: /, today: 1 planned session$/ });
    await expect(todayLink).toHaveAttribute("aria-current", "date");
    await expect(todayLink).toHaveAttribute("href", `/week/${today.weekId}?day=${today.day}`);

    const routines = page.getByRole("region", { name: "My routines" });
    await expect(routines.getByRole("link", { name: "My dashboard routine", exact: true })).toBeVisible();

    // Real links into the app.
    await todaySection.getByRole("link", { name: "Mine today", exact: true }).click();
    await expect(page).toHaveURL(/\/session\/[0-9a-f-]{36}$/);
    await page.goto("/home");
    await page.getByRole("link", { name: "Open weekly planner" }).click();
    await expect(page).toHaveURL(new RegExp(`/week/${today.weekId}\\?day=${today.day}$`));
  });

  test("an empty member sees honest empty states", async ({ page, context, baseURL }) => {
    await signInAsNewLocalMember(context, baseURL!);
    await page.goto("/home");
    await expect(page.getByText("A little space in your day.")).toBeVisible();
    await expect(page.getByText("Make a routine your own.")).toBeVisible();
    await expect(page.getByText("An open week.", { exact: false })).toBeVisible();
    expect(await landmarks(page)).toEqual({ banner: 1, main: 1, mainId: "main-content", footer: 1 });
  });

  test("today follows the member's own time zone, not the server's", async ({ browser, baseURL }) => {
    // UTC+14 and UTC−11 are always on different calendar days.
    const ahead = todayIn("Pacific/Kiritimati");
    const behind = todayIn("Pacific/Pago_Pago");
    expect(ahead.date).not.toBe(behind.date);

    for (const [zone, expected, other] of [
      ["Pacific/Kiritimati", ahead, behind],
      ["Pacific/Pago_Pago", behind, ahead],
    ] as const) {
      const context = await browser.newContext({ baseURL, timezoneId: zone });
      try {
        const { userId } = await signInAsNewLocalMember(context, baseURL!);
        await createLocalSessionFor(userId, `Session on ${expected.date}`, expected.date);
        await createLocalSessionFor(userId, `Session on ${other.date}`, other.date);
        const page = await context.newPage();
        // The first page load records the browser's zone in the tg_tz cookie.
        await page.goto("/login");
        expect((await context.cookies()).find((c) => c.name === "tg_tz")?.value).toBe(encodeURIComponent(zone));

        await page.goto("/home");
        const todaySection = page.getByRole("region", { name: "Today’s planned sessions" });
        await expect(todaySection.getByRole("link", { name: `Session on ${expected.date}`, exact: true })).toBeVisible();
        await expect(todaySection.getByRole("link", { name: `Session on ${other.date}`, exact: true })).toHaveCount(0);

        // The planner agrees about today.
        await page.goto("/week/current");
        await expect(page).toHaveURL(new RegExp(`/week/${expected.weekId}\\?day=${expected.day}$`));
      } finally {
        await context.close();
      }
    }
  });

  test("a member's 404 keeps one header and one main landmark", async ({ page, context, baseURL }) => {
    await signInAsNewLocalMember(context, baseURL!);
    const response = await page.goto("/session/00000000-0000-4000-8000-000000000000");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Not found" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to planner" })).toHaveAttribute("href", "/week/current");
    await expect(page.getByRole("banner").getByRole("link", { name: "Home", exact: true })).toBeVisible();
    expect(await landmarks(page)).toEqual({ banner: 1, main: 1, mainId: "main-content", footer: 1 });
  });

  test("an invalid time-zone cookie falls back safely", async ({ page, context, baseURL }) => {
    await signInAsNewLocalMember(context, baseURL!);
    await context.addCookies([{ name: "tg_tz", value: "Not%2FA_Zone", url: baseURL! }]);
    const response = await page.goto("/home");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Welcome back");
  });

  test("the login page's planner link and the brand lead to real member pages", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAsNewLocalMember(context, baseURL!);
    await page.goto("/login");
    await page.getByRole("link", { name: "Go to the planner" }).click();
    await expect(page).toHaveURL(/\/week\/\d{4}-W\d{2}\?day=[1-7]$/);
    await page.getByRole("banner").getByRole("link", { name: "TrainGrid", exact: true }).click();
    await expect(page).toHaveURL(/\/home$/);
  });
});
