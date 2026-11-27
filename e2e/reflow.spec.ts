import { expect, test, type Page } from "@playwright/test";
import { createRoutine } from "./planner-helpers";
import {
  hasLocalSecretKey,
  signInAsLocalAdmin,
  signInAsNewLocalMember,
  supabaseState,
} from "./local-supabase";

/**
 * Enlarged text at 320 CSS pixels (WCAG 1.4.4 / 1.4.10). A page-width check
 * alone missed a Library description squeezed to 9px (UI_DESIGN_AUDIT rank 1),
 * so these also measure the controls themselves.
 */

test.beforeEach(async ({ baseURL, page }) => {
  test.skip((await supabaseState(baseURL!)) !== "ok", "Local Supabase stack is not running");
  test.skip(!hasLocalSecretKey(), "Local Supabase secret key is not configured");
  await page.setViewportSize({ width: 320, height: 640 });
});

async function enlargeText(page: Page) {
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
}

async function fitsWidth(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
}

/** Words inside `selector` that are split across lines (each whole word should render on one line). */
async function splitWords(page: Page, selector: string) {
  return page.locator(selector).evaluateAll((roots) => {
    const split: string[] = [];
    for (const root of roots) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.textContent ?? "";
        for (const match of text.matchAll(/\S+/g)) {
          const range = document.createRange();
          range.setStart(node, match.index!);
          range.setEnd(node, match.index! + match[0].length);
          const lines = new Set([...range.getClientRects()].map((r) => Math.round(r.top)));
          if (lines.size > 1) split.push(match[0]);
        }
      }
    }
    return split;
  });
}

async function widthOf(page: Page, selector: string) {
  return page.locator(selector).first().evaluate((el) => el.getBoundingClientRect().width);
}

test("library rows keep whole words readable and Schedule reachable", async ({ page, context, baseURL }) => {
  await signInAsNewLocalMember(context, baseURL!);
  await createRoutine(page, "Easy Run", "running", [["Easy miles", "30 min"]]);
  await page.goto("/library?scope=mine");
  const row = page.locator(".library-routine-row").filter({ hasText: "Easy Run" });
  const text = row.getByRole("link", { name: /^Easy Run/ });
  const schedule = row.getByRole("link", { name: "Schedule Easy Run", exact: true });

  for (const enlarged of [false, true]) {
    if (enlarged) await enlargeText(page);
    const label = enlarged ? "200% text" : "default text";
    expect(await fitsWidth(page), label).toBe(true);
    // The name renders on one line: the description column is not letter-wide.
    const box = (await text.boundingBox())!;
    const lineHeight = await row
      .locator("div.font-medium")
      .evaluate((el) => parseFloat(getComputedStyle(el).lineHeight));
    const name = (await row.locator("div.font-medium").boundingBox())!;
    expect(name.height, `${label}: name stays on one line`).toBeLessThan(lineHeight * 1.5);
    expect(box.width, `${label}: text column`).toBeGreaterThan(200);
    await schedule.scrollIntoViewIfNeeded();
    await expect(schedule).toBeInViewport();
    const scheduleBox = (await schedule.boundingBox())!;
    expect(scheduleBox.x + scheduleBox.width, label).toBeLessThanOrEqual(320);
  }
});

test("privacy choices, Home action and admin notice stay within 320px", async ({ page, context, baseURL }) => {
  await signInAsNewLocalMember(context, baseURL!);

  await page.goto("/home");
  await enlargeText(page);
  expect(await fitsWidth(page), "home").toBe(true);
  expect(await widthOf(page, '[data-testid="quick-start"]')).toBeLessThanOrEqual(320);

  await page.goto("/profile/social");
  await expect(page.getByRole("group", { name: "Who can see your posts" })).toBeVisible();
  await enlargeText(page);
  expect(await fitsWidth(page), "social profile").toBe(true);
  expect(await widthOf(page, "fieldset")).toBeLessThanOrEqual(320);
  // The privacy choices wrap between words, not inside them ("approv-e").
  expect(await splitWords(page, "fieldset label")).toEqual([]);

  await signInAsLocalAdmin(context, baseURL!);
  await page.goto("/admin/invitations");
  await expect(page.getByRole("heading", { name: "Invitations", exact: true })).toBeVisible();
  await enlargeText(page);
  expect(await fitsWidth(page), "admin invitations").toBe(true);
});
