import { expect, test, type Browser } from "@playwright/test";
import { formatDashboardDate } from "../lib/dashboard/prepare";
import { todayIn } from "../lib/time-zone";
import { signInAsNewLocalMember } from "./local-supabase";

/**
 * "Today" is decided in the member's own time zone, including on a request
 * made before the browser has reported it (no `tg_tz` cookie yet, or a stale
 * one after travelling), when the server can only guess (UTC here).
 *
 * To make the guess wrong whatever the time of day the suite runs, the
 * browser is placed in a zone whose calendar date differs from UTC's right
 * now: UTC+14 is a day ahead from 10:00 UTC, UTC-11 a day behind until 11:00.
 */
function zoneOffTheUtcDay(): string {
  const utc = todayIn("UTC").date;
  const zone = ["Pacific/Kiritimati", "Pacific/Pago_Pago"].find((tz) => todayIn(tz).date !== utc);
  if (!zone) throw new Error("No zone off the UTC day");
  return zone;
}

async function memberIn(browser: Browser, baseURL: string, timezoneId: string, cookieZone?: string) {
  const context = await browser.newContext({ timezoneId });
  const { userId } = await signInAsNewLocalMember(context, baseURL);
  await context.clearCookies({ name: "tg_tz" });
  if (cookieZone) {
    await context.addCookies([{ name: "tg_tz", value: encodeURIComponent(cookieZone), url: baseURL }]);
  }
  return { context, userId, page: await context.newPage() };
}

for (const [name, cookieZone] of [
  ["first request, before the browser has reported its zone", undefined],
  ["first request after travelling (stale zone cookie)", "UTC"],
] as const) {
  test(`home and planner use the member's day on the ${name}`, async ({ browser, baseURL }) => {
    const zone = zoneOffTheUtcDay();
    const local = todayIn(zone);
    const { context, page } = await memberIn(browser, baseURL!, zone, cookieZone);

    await page.goto("/home");
    await expect(page.getByRole("main")).toContainText(formatDashboardDate(local.date));

    await page.goto("/week/current");
    await expect(page).toHaveURL(new RegExp(`/week/${local.weekId}\\?day=${local.day}$`));

    const cookies = await context.cookies();
    expect(decodeURIComponent(cookies.find((c) => c.name === "tg_tz")?.value ?? "")).toBe(zone);
    await context.close();
  });
}

test("the planner highlights the member's today, not the server's", async ({ browser, baseURL }) => {
  const zone = zoneOffTheUtcDay();
  const local = todayIn(zone);
  const utc = todayIn("UTC");
  const { context, page } = await memberIn(browser, baseURL!, zone, zone);
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/week/${local.weekId}?day=${local.day}`);
    const days = page.getByRole("main").locator("[data-today]:visible");
    await expect(days.first()).toBeVisible();
    for (const marked of await days.all()) {
      await expect(marked).toHaveAttribute("data-date", local.date);
    }
    if (utc.weekId === local.weekId) {
      await expect(page.getByRole("main").locator(`[data-today][data-date="${utc.date}"]`)).toHaveCount(0);
    }
  }
  expect(errors.filter((text) => /hydrat/i.test(text))).toEqual([]);
  await context.close();
});
