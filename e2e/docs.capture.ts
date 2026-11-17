import { mkdir } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { addDays, mondayOfIsoWeek } from "../lib/calendar-date";
import { todayIn } from "../lib/time-zone";
import {
  backdateLocalProfile,
  deleteLocalInvitations,
  makeLocalMember,
  signInAsLocalAdmin,
  signInAsNewLocalUser,
  supabaseUrl,
} from "./local-supabase";

/**
 * Documentation screenshots for README and docs (npm run screenshots).
 * Seeds a believable member week on the local stack, then captures each
 * screen in light and dark from the production build into docs/images/v1/.
 */

const OUT = "docs/images/v1";
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

function admin() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not set");
  return createClient(supabaseUrl, key, { auth: { persistSession: false } });
}

type Item = { name: string; target?: string; rest?: string; instruction?: string; equipment?: string[] };

async function createRoutine(userId: string, name: string, category: string, description: string, items: Item[]) {
  const db = admin();
  const routine = await db
    .from("routines")
    .insert({ scope: "PERSONAL", owner_user_id: userId, name, category, description })
    .select("id")
    .single();
  if (routine.error) throw new Error(routine.error.message);
  const rows = items.map((item, index) => ({
    routine_id: routine.data.id,
    name: item.name,
    instruction: item.instruction ?? "",
    target: item.target ?? "",
    rest: item.rest ?? "",
    equipment: item.equipment ?? [],
    sort_order: index,
  }));
  const inserted = await db.from("workout_items").insert(rows);
  if (inserted.error) throw new Error(inserted.error.message);
  return routine.data.id as string;
}

async function createSession(
  userId: string,
  fields: { date: string; name: string; category: string; start?: string; minutes?: number; notes?: string; items?: Item[]; routineId?: string },
) {
  const { error } = await admin()
    .from("scheduled_sessions")
    .insert({
      user_id: userId,
      date: fields.date,
      start_time: fields.start ?? null,
      duration_minutes: fields.minutes ?? null,
      name: fields.name,
      category: fields.category,
      notes: fields.notes ?? "",
      source_routine_id: fields.routineId ?? null,
      snapshot: {
        version: 1,
        items: (fields.items ?? []).map((item) => ({
          id: crypto.randomUUID(),
          source_item_id: null,
          name: item.name,
          instruction: item.instruction ?? "",
          rest: item.rest ?? "",
          target: item.target ?? "",
          notes: "",
          equipment: item.equipment ?? [],
          video_url: null,
        })),
      },
    });
  if (error) throw new Error(error.message);
}

const LOWER: Item[] = [
  { name: "Back squat", target: "4 × 6", rest: "2 min", equipment: ["barbell"] },
  { name: "Romanian deadlift", target: "3 × 8", rest: "90 s", equipment: ["barbell"] },
  { name: "Bulgarian split squat", target: "3 × 10 each", rest: "60 s", equipment: ["dumbbell", "bench"] },
  { name: "Plank", target: "3 × 45 s", equipment: ["bodyweight"] },
];
const UPPER: Item[] = [
  { name: "Bench press", target: "4 × 6", rest: "2 min", equipment: ["barbell", "bench"] },
  { name: "Pull-up", target: "4 × 6–8", rest: "90 s", equipment: ["pull-up-bar"] },
  { name: "Overhead press", target: "3 × 8", equipment: ["dumbbell"] },
];
const TEMPO: Item[] = [
  { name: "Warm-up jog", target: "10 min easy" },
  { name: "Tempo", target: "3 × 8 min at threshold", rest: "2 min jog" },
  { name: "Cool-down", target: "10 min easy" },
];

/** A member with a full, varied week, three routines, and a profile from an earlier session. */
async function seedMember(context: BrowserContext, baseURL: string, page: Page) {
  const { userId } = await signInAsNewLocalUser(context, baseURL);
  await makeLocalMember(userId, "Alex Morgan");
  await backdateLocalProfile(userId);
  const zone = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  const today = todayIn(zone, new Date());
  const monday = mondayOfIsoWeek(today.weekId);
  const day = (n: number) => addDays(monday, n);

  const lower = await createRoutine(userId, "Lower A · my way", "strength", "Squat-led lower day with a long finisher.", LOWER);
  const tempo = await createRoutine(userId, "Tempo Tuesdays", "running", "Threshold work, broken into steady blocks.", TEMPO);
  await createRoutine(userId, "Upper A", "strength", "Press and pull, balanced.", UPPER);

  const week = [
    { date: day(0), name: "Easy run", category: "running", start: "06:30", minutes: 40, notes: "Conversational pace, flat route." },
    { date: day(1), name: "Tempo Tuesdays", category: "running", start: "06:30", minutes: 50, items: TEMPO, routineId: tempo },
    { date: day(1), name: "Lower A · my way", category: "strength", start: "17:30", minutes: 60, items: LOWER, routineId: lower },
    { date: day(2), name: "Mobility reset", category: "other", minutes: 20, notes: "Hips, ankles, thoracic spine." },
    { date: day(3), name: "Upper A", category: "strength", start: "18:00", minutes: 55, items: UPPER },
    { date: day(4), name: "Plyo primer", category: "plyometrics", start: "07:00", minutes: 25, items: [{ name: "Box jump", target: "4 × 3", equipment: ["plyometric-box"] }] },
    { date: day(5), name: "Long run", category: "running", start: "07:00", minutes: 95, notes: "Last 20 minutes at marathon pace." },
    { date: day(6), name: "Recovery walk", category: "other", minutes: 45 },
  ];
  // Today gets a second, timed session so the home page shows a full day.
  week.push({ date: today.date, name: "Core finisher", category: "other", start: "19:00", minutes: 15, notes: "Dead bugs, side planks, bird dogs." });
  for (const session of week) await createSession(userId, session);
  return { today };
}

async function settle(page: Page) {
  await expect(page.getByTestId("section-loader")).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
}

async function shot(page: Page, name: string, fullPage = true) {
  await settle(page);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage, animations: "disabled" });
}

test.beforeAll(async () => {
  await mkdir(OUT, { recursive: true });
});

for (const scheme of ["light", "dark"] as const) {
  test(`public pages (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    await page.setViewportSize(DESKTOP);
    await page.goto("/");
    await shot(page, `landing-desktop-${scheme}`, false);
    await page.setViewportSize(PHONE);
    await shot(page, `landing-phone-${scheme}`, false);
    await page.setViewportSize(DESKTOP);
    await page.goto("/login");
    await shot(page, `login-desktop-${scheme}`, false);
  });

  test(`member screens (${scheme})`, async ({ page, context, baseURL }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    await page.setViewportSize(DESKTOP);
    await page.goto("/login");
    const { today } = await seedMember(context, baseURL!, page);

    await page.goto("/home");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Welcome back, Alex Morgan.");
    await shot(page, `home-desktop-${scheme}`);

    await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Feedback" }).click();
    const dialog = page.getByRole("dialog", { name: "Share feedback" });
    await dialog.getByText("Idea", { exact: true }).click();
    await dialog.getByRole("textbox", { name: "Your message" }).fill("Could the week view show total planned minutes per day? It would help me balance easy and hard days.");
    await shot(page, `feedback-desktop-${scheme}`, false);
    await page.keyboard.press("Escape");

    // A taller window shows the morning and the evening sessions together.
    await page.setViewportSize({ width: 1440, height: 1500 });
    await page.goto(`/week/${today.weekId}?day=${today.day}`);
    await expect(page.getByRole("heading", { name: /^Week of/ })).toBeVisible();
    await shot(page, `planner-desktop-${scheme}`, false);
    await page.setViewportSize(DESKTOP);

    await page.goto("/library");
    await shot(page, `library-desktop-${scheme}`, false);
    await page.getByRole("link", { name: /^Lower A · my way/ }).first().click();
    await expect(page.getByRole("heading", { name: "Lower A · my way", level: 1 })).toBeVisible();
    await shot(page, `routine-desktop-${scheme}`, false);

    await page.goto("/whats-new");
    await shot(page, `whats-new-desktop-${scheme}`, false);
    await page.goto("/privacy");
    await shot(page, `privacy-desktop-${scheme}`, false);

    await page.setViewportSize(PHONE);
    await page.goto("/home");
    await shot(page, `home-phone-${scheme}`, false);
    await page.goto(`/week/${today.weekId}?day=${today.day}`);
    await shot(page, `planner-phone-${scheme}`, false);
  });

  test(`a new member's first visit (${scheme})`, async ({ page, context, baseURL }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    await page.setViewportSize(DESKTOP);
    const { userId } = await signInAsNewLocalUser(context, baseURL!);
    await makeLocalMember(userId, "Sam Lee");
    await page.goto("/home");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Welcome, Sam Lee.");
    await expect(page.getByTestId("getting-started")).toBeVisible();
    await shot(page, `home-first-visit-desktop-${scheme}`, false);
  });

  test(`admin invitations (${scheme})`, async ({ page, context, baseURL }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    await page.setViewportSize(DESKTOP);
    await signInAsLocalAdmin(context, baseURL!);
    const addresses = ["jordan.lee@example.test", "priya.shah@example.test"];
    await deleteLocalInvitations(addresses);
    await page.goto("/admin/invitations");
    for (const [address, email] of [
      [addresses[0]!, true],
      [addresses[1]!, false],
    ] as const) {
      await page.getByLabel("Email address").fill(address);
      const box = page.getByLabel("Email the invitation to this address");
      if (email) await box.check();
      else await box.uncheck();
      await page.getByRole("button", { name: "Invite", exact: true }).click();
      await expect(page.getByRole("listitem").filter({ hasText: address })).toBeVisible();
    }
    await shot(page, `invitations-desktop-${scheme}`);
    await deleteLocalInvitations(addresses);
  });
}
