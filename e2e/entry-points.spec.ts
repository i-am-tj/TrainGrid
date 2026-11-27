import { expect, test } from "@playwright/test";
import { addDays } from "../lib/calendar-date";
import { todayIn } from "../lib/time-zone";
import {
  backdateLocalProfile,
  createLocalSessionFor,
  hasLocalSecretKey,
  signInAsNewLocalMember,
  supabaseState,
} from "./local-supabase";

/**
 * Home leads with the right start, and the session page's edit links say
 * which editor they open (UI_DESIGN_AUDIT ranks 6 and 10).
 */

test.beforeEach(async ({ baseURL }) => {
  test.skip((await supabaseState(baseURL!)) !== "ok", "Local Supabase stack is not running");
  test.skip(!hasLocalSecretKey(), "Local Supabase secret key is not configured");
});

test("a new member is led to a routine; unplanned work is one action away", async ({ page, context, baseURL }) => {
  await signInAsNewLocalMember(context, baseURL!);
  await page.goto("/home");
  await expect(page.getByRole("link", { name: /Choose a routine/ })).toBeVisible();
  const start = page.getByTestId("quick-start");
  await expect(start).toHaveText("Start an unplanned workout");
  await expect(start).toHaveAttribute("data-prominence", "secondary");
  await start.click();
  await expect(page.getByRole("dialog", { name: "Start an unplanned workout" })).toBeVisible();
});

test("a returning member's planned session leads; with nothing today the unplanned start does", async ({ page, context, baseURL }) => {
  const member = await signInAsNewLocalMember(context, baseURL!);
  await backdateLocalProfile(member.userId);
  const today = todayIn("UTC").date;
  await createLocalSessionFor(member.userId, "Evening strength", today);
  await page.goto("/home");
  await expect(page.getByRole("link", { name: "Start workout: Evening strength" })).toBeVisible();
  await expect(page.getByTestId("quick-start")).toHaveAttribute("data-prominence", "secondary");

  const other = await signInAsNewLocalMember(context, baseURL!);
  await backdateLocalProfile(other.userId);
  // Planned this week, but not today: no invitation, nothing to start today.
  const elsewhere = addDays(today, todayIn("UTC").day === 7 ? -1 : 1);
  await createLocalSessionFor(other.userId, "Long run", elsewhere);
  await page.goto("/home");
  await expect(page.getByTestId("quick-start")).toHaveAttribute("data-prominence", "primary");
});

test("session detail names each editor, and the editors use the same names", async ({ page, context, baseURL }) => {
  const member = await signInAsNewLocalMember(context, baseURL!);
  const sessionId = await createLocalSessionFor(member.userId, "Tempo run", todayIn("UTC").date);
  for (const [link, heading] of [
    ["Edit schedule & details", "Edit schedule & details"],
    ["Edit exercises", "Edit exercises"],
  ]) {
    await page.goto(`/session/${sessionId}`);
    await page.getByRole("link", { name: link, exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
  }
});
