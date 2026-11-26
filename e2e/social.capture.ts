import { mkdir } from "node:fs/promises";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { addDays } from "../lib/calendar-date";
import { todayIn } from "../lib/time-zone";
import {
  backdateLocalProfile,
  createLocalFollow,
  createLocalPostFor,
  createLocalSocialProfile,
  makeLocalMember,
  signInAsNewLocalUser,
  requireEmptyCaptureDirectory,
  serviceClient as admin,
} from "./local-supabase";

/**
 * Screenshots of the social features (docs/images/social), from a production
 * build, in light and dark, desktop and phone:
 *
 *   npm run build
 *   E2E_SERVER=build npx playwright test --config playwright.screenshots.config.ts e2e/social.capture.ts
 *
 * Every member here is a throwaway user on the LOCAL stack with made-up
 * names; no production data is involved.
 */

const OUT = "docs/images/social";
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };


const captureUsers: string[] = [];

async function otherMember(displayName: string) {
  const { data, error } = await admin().auth.admin.createUser({
    email: `capture-${crypto.randomUUID()}@example.test`,
    password: `local-${crypto.randomUUID()}`,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(error?.message);
  captureUsers.push(data.user.id);
  await makeLocalMember(data.user.id, displayName);
  await backdateLocalProfile(data.user.id);
  return data.user.id;
}

async function session(userId: string, name: string, category: string, date: string, minutes: number | null, notes = "") {
  const { data, error } = await admin()
    .from("scheduled_sessions")
    .insert({
      user_id: userId,
      date,
      start_time: "06:30",
      name,
      category,
      duration_minutes: minutes,
      notes,
      snapshot: { version: 1, items: [] },
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

const ago = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

async function seed(context: BrowserContext, baseURL: string) {
  await requireEmptyCaptureDirectory();
  const { userId: alex } = await signInAsNewLocalUser(context, baseURL);
  captureUsers.push(alex);
  await makeLocalMember(alex, "Alex Morgan");
  await backdateLocalProfile(alex);
  const sam = await otherMember("Sam Rivera");
  const priya = await otherMember("Priya Shah");
  const jordan = await otherMember("Jordan Lee");
  const mei = await otherMember("Mei Tanaka");
  const chris = await otherMember("Chris Okafor");

  await createLocalSocialProfile(alex, { username: "alex_morgan", displayName: "Alex Morgan", bio: "Half marathon in March. Lifting twice a week.", visibility: "private" });
  await createLocalSocialProfile(sam, { username: "sam_runs", displayName: "Sam Rivera", bio: "Trail runner. Coffee before miles.", visibility: "public" });
  await createLocalSocialProfile(priya, { username: "priya_lifts", displayName: "Priya Shah", bio: "Powerlifting, slowly and surely.", visibility: "private" });
  await createLocalSocialProfile(jordan, { username: "jordan_lee", displayName: "Jordan Lee", bio: "Plyo and sprints.", visibility: "public" });
  await createLocalSocialProfile(mei, { username: "mei_tanaka", displayName: "Mei Tanaka", bio: "New to running, loving it.", visibility: "private" });
  await createLocalSocialProfile(chris, { username: "chris_o", displayName: "Chris Okafor", visibility: "public" });

  await createLocalFollow(alex, sam);
  await createLocalFollow(alex, priya);
  await createLocalFollow(sam, alex);
  await createLocalFollow(priya, alex);
  await createLocalFollow(jordan, sam);
  await createLocalFollow(mei, alex, "pending");
  await createLocalFollow(chris, alex, "pending");

  const today = todayIn("UTC").date;
  const samLong = await session(sam, "Long trail run", "running", addDays(today, -1), 105);
  const samEasy = await session(sam, "Easy shakeout", "running", addDays(today, -3), 30);
  const priyaHeavy = await session(priya, "Heavy lower", "strength", today, 75, "Belt on the top sets.");
  const alexTempo = await session(alex, "Tempo Tuesdays", "running", addDays(today, -2), 50, "Hamstring a little tight.");
  const alexLower = await session(alex, "Lower A · my way", "strength", today, 60);
  await session(alex, "Plyo primer", "plyometrics", addDays(today, 2), 25);
  const jordanSprints = await session(jordan, "Hill sprints", "plyometrics", addDays(today, -1), 35);

  // Priya's session was a finished workout, so her post shares its totals.
  await admin().from("workout_logs").insert({
    user_id: priya,
    session_id: priyaHeavy,
    status: "completed",
    started_at: ago(2.8),
    finished_at: ago(1.6),
    unit: "kg",
    entries: {
      version: 1,
      items: [
        { item_id: crypto.randomUUID(), name: "Back squat", mode: "load", sets: [100, 110, 120, 130, 140].map((weight) => ({ weight, reps: weight === 140 ? 1 : 3, done: true })) },
        { item_id: crypto.randomUUID(), name: "Romanian deadlift", mode: "load", sets: [80, 80, 80].map((weight) => ({ weight, reps: 8, done: true })) },
        { item_id: crypto.randomUUID(), name: "Walking lunge", mode: "load", sets: [20, 20].map((weight) => ({ weight, reps: 12, done: true })) },
      ],
    },
  });
  const { data: priyaPost, error: priyaError } = await admin()
    .from("session_posts")
    .insert({
      author_id: priya,
      session_id: priyaHeavy,
      caption: "New squat single at RPE 8. Moved well, kept it there. Deadlifts next week.",
      shows_duration: true,
      shows_sets: true,
      shows_volume: true,
      created_at: ago(1.5),
    } as never)
    .select("id")
    .single();
  if (priyaError) throw new Error(priyaError.message);
  const priyaPostId = (priyaPost as { id: string }).id;
  const samPostId = await createLocalPostFor(sam, samLong, "Two hours on the ridge trail. Fogged in at the top, perfect at the bottom. Legs are cooked in the best way.", true, ago(5));
  await createLocalPostFor(alex, alexTempo, "Three blocks at threshold, all on pace. The last one hurt, in a good way.", false, ago(30));
  await createLocalPostFor(sam, samEasy, "Easy 30 to flush the legs.", false, ago(74));
  await createLocalPostFor(jordan, jordanSprints, "8 × 10 s hill sprints. Short, sharp, done.", true, ago(20));

  // Likes and a short conversation.
  await admin().from("post_likes").insert([
    { post_id: priyaPostId, user_id: sam },
    { post_id: priyaPostId, user_id: jordan },
    { post_id: samPostId, user_id: priya },
  ]);
  await admin().from("post_comments").insert([
    { post_id: priyaPostId, author_id: sam, body: "140 for a single at RPE 8 is huge. What’s the plan for deadlifts?", created_at: ago(1.2) },
    { post_id: priyaPostId, author_id: priya, body: "Working up to a heavy triple next week, then we’ll see!", created_at: ago(0.9) },
    { post_id: samPostId, author_id: priya, body: "That ridge is brutal. Nice work.", created_at: ago(4) },
  ]);
  return { alex, alexLower, priyaPostId };
}

async function settle(page: Page) {
  await expect(page.getByTestId("feed-loading")).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
}

async function shot(page: Page, name: string, fullPage = false) {
  await settle(page);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage, animations: "disabled" });
}

test.afterEach(async () => {
  // Follow edges and comments reference several fixtures. Concurrent cascades
  // can lock the same rows in opposite orders.
  const client = admin();
  for (const id of captureUsers.splice(0)) {
    const { error } = await client.auth.admin.deleteUser(id);
    if (error) throw new Error("Could not clean up a capture user.");
  }
});

test.beforeAll(async () => {
  await mkdir(OUT, { recursive: true });
});

for (const scheme of ["light", "dark"] as const) {
  test(`social screens (${scheme})`, async ({ page, context, baseURL }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    await page.setViewportSize(DESKTOP);
    await page.goto("/login");
    const { alexLower } = await seed(context, baseURL!);

    await page.goto("/feed");
    await expect(page.getByTestId("post-card").first()).toBeVisible();
    await shot(page, `feed-desktop-${scheme}`);

    await page.goto("/people/sam_runs");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sam Rivera");
    await shot(page, `profile-public-desktop-${scheme}`);

    await page.goto("/people/mei_tanaka");
    await expect(page.getByTestId("private-profile")).toBeVisible();
    await shot(page, `profile-private-desktop-${scheme}`);

    await page.goto("/people");
    await shot(page, `people-desktop-${scheme}`);

    await page.goto("/people/requests");
    await shot(page, `requests-desktop-${scheme}`);

    await page.goto(`/session/${alexLower}/post`);
    await page.getByLabel("Caption").fill("Squats felt smooth today. Added a set of walking lunges at the end.");
    await page.getByLabel("Duration").check();
    await shot(page, `composer-desktop-${scheme}`);

    await page.goto("/profile/social");
    await shot(page, `settings-desktop-${scheme}`, true);

    await page.goto("/people/alex_morgan/followers");
    await shot(page, `followers-desktop-${scheme}`);

    await page.setViewportSize(PHONE);
    await page.goto("/feed");
    await expect(page.getByTestId("post-card").first()).toBeVisible();
    await shot(page, `feed-phone-${scheme}`);
    await page.goto("/people/alex_morgan");
    await shot(page, `profile-own-phone-${scheme}`);
    await page.goto(`/session/${alexLower}/post`);
    await page.getByLabel("Caption").fill("Squats felt smooth today.");
    await shot(page, `composer-phone-${scheme}`, true);
    await page.goto("/people/requests");
    await shot(page, `requests-phone-${scheme}`);
  });
}

for (const scheme of ["light", "dark"] as const) {
  test(`quick workout, likes and comments (${scheme})`, async ({ page, context, baseURL }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    await page.setViewportSize(DESKTOP);
    await page.goto("/login");
    const { priyaPostId } = await seed(context, baseURL!);

    await page.goto("/home");
    await shot(page, `home-start-desktop-${scheme}`);
    await page.goto(`/posts/${priyaPostId}`);
    await expect(page.getByTestId("comment").first()).toBeVisible();
    await shot(page, `post-comments-desktop-${scheme}`, true);
    await page.goto("/feed");
    await expect(page.getByTestId("post-card").first()).toBeVisible();
    await shot(page, `feed-reactions-desktop-${scheme}`);

    await page.setViewportSize(PHONE);
    await page.goto("/home");
    await page.getByTestId("quick-start").click();
    await expect(page.getByRole("dialog", { name: "Start an unplanned workout" })).toBeVisible();
    await shot(page, `quick-start-phone-${scheme}`);
    await page.getByRole("dialog", { name: "Start an unplanned workout" }).getByRole("button", { name: /^Lift/ }).click();
    await page.waitForURL(/\/workout\//);
    const sessionId = page.url().split("/").at(-1)!;
    await expect(page.getByTestId("add-first-exercise")).toBeVisible();
    await shot(page, `quick-running-phone-${scheme}`);
    await page.getByTestId("add-first-exercise").click();
    const add = page.getByRole("dialog", { name: "Add exercise" });
    await add.getByRole("textbox", { name: "Exercise" }).fill("Back squat");
    await add.getByRole("radio", { name: "1:30" }).click();
    await shot(page, `quick-add-exercise-phone-${scheme}`);
    await add.getByRole("button", { name: "Add exercise" }).click();
    for (const reps of ["5", "5", "5"]) {
      await page.getByRole("textbox", { name: /Weight/ }).fill("100");
      await page.getByRole("textbox", { name: "Reps" }).fill(reps);
      await page.getByRole("button", { name: "Log set" }).click();
      const timer = page.getByRole("region", { name: "Rest timer" });
      if (await timer.count()) await timer.getByRole("button", { name: "Skip" }).click();
    }
    await page.getByRole("button", { name: "Finish workout" }).click();
    const finish = page.getByRole("dialog", { name: "Finish workout?" });
    await finish.getByRole("textbox", { name: "Name this workout" }).fill("Squat triples");
    await shot(page, `quick-finish-phone-${scheme}`);
    await finish.getByRole("button", { name: "Finish workout" }).click();
    await expect(page.getByText("Workout complete")).toBeVisible();
    await shot(page, `quick-summary-phone-${scheme}`);
    await page.getByTestId("post-about-it").click();
    await page.waitForURL(`/session/${sessionId}/post`);
    await page.getByLabel(/Volume lifted/).check();
    await page.getByLabel("Caption").fill("Three clean triples at 100.");
    await shot(page, `quick-composer-phone-${scheme}`, true);
    await page.setViewportSize(DESKTOP);
    await shot(page, `quick-composer-desktop-${scheme}`);
  });
}
