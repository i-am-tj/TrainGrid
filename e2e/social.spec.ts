import { expect, test, type Browser, type Page } from "@playwright/test";
import { addDays } from "../lib/calendar-date";
import { todayIn } from "../lib/time-zone";
import { accessibilityResults } from "../tests/helpers/accessibility";
import {
  createLocalFollow,
  createLocalPostFor,
  createLocalSessionFor,
  createLocalSocialProfile,
  revokeLocalMember,
  signInAsNewLocalMember,
} from "./local-supabase";

/**
 * Social profiles, following, session posts and the feed, as real members
 * in separate browsers. Every rule shown here is also enforced by the
 * database (supabase/tests/database/12_social.test.sql) and the data layer
 * (tests/integration/social.test.ts); these check the screens.
 */

const uniq = () => crypto.randomUUID().replace(/-/g, "").slice(0, 8);

async function hydrated(page: Page) {
  await page.waitForFunction(() => {
    const main = document.getElementById("main-content");
    return !!main && Object.keys(main).some((key) => key.startsWith("__reactFiber"));
  });
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

/** A second (or third) member in their own browser. */
async function member(browser: Browser, baseURL: string, social?: { username: string; displayName: string; visibility: "public" | "private"; bio?: string }) {
  const context = await browser.newContext({ baseURL, timezoneId: "UTC" });
  const user = await signInAsNewLocalMember(context, baseURL);
  if (social) await createLocalSocialProfile(user.userId, social);
  const page = await context.newPage();
  return { ...user, context, page };
}

test("a member sets up a private profile, posts a session update, edits and deletes it", async ({ page, context, baseURL }) => {
  const { userId } = await signInAsNewLocalMember(context, baseURL!);
  const today = todayIn("UTC").date;
  const sessionId = await createLocalSessionFor(userId, "Tempo run", today);

  await page.goto("/feed");
  await hydrated(page);
  await expect(page.getByTestId("feed-setup")).toContainText("Set up your social profile");
  await page.getByRole("link", { name: "Set up profile" }).first().click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Set up your social profile");
  await hydrated(page);
  // Private is the default, and the name is prefilled from the account.
  await expect(page.getByRole("radio", { name: /Private/ })).toBeChecked();
  await expect(page.getByLabel("Display name")).toHaveValue("E2E Member");
  const username = `e2e_${uniq()}`;
  await page.getByLabel("Username").fill("a");
  await page.getByLabel("Display name").focus();
  await expect(page.getByText("Use at least 3 characters.")).toBeVisible();
  await page.getByLabel("Username").fill(`@${username.toUpperCase()}`);
  await page.getByRole("textbox", { name: /Bio/ }).fill("Early runs, heavy lifts.");
  await page.getByRole("button", { name: "Create profile" }).click();

  // Back where they came from, with an empty feed that points somewhere useful.
  await expect(page).toHaveURL(/\/feed$/);
  await expect(page.getByTestId("feed-empty")).toContainText("Your feed is quiet");
  await expect(page.getByTestId("feed-empty").getByRole("link", { name: "Discover people" })).toHaveAttribute("href", "/people");

  // Post update, from the session itself.
  await page.goto(`/session/${sessionId}`);
  await page.getByRole("link", { name: "Post update" }).click();
  await expect(page).toHaveURL(new RegExp(`/session/${sessionId}/post$`));
  await hydrated(page);
  const preview = page.getByTestId("post-preview");
  await expect(preview).toContainText("Tempo run");
  await expect(preview).toContainText(username);
  await expect(page.getByLabel(/Duration/)).toBeDisabled(); // this session has none
  await expect(page.getByText(/Never shared: the start time, your notes, the exercises/)).toBeVisible();
  await page.getByLabel("Caption").fill("Negative splits!\nLegs felt good.");
  await expect(preview).toContainText("Negative splits!");
  await page.getByRole("button", { name: "Post update" }).click();

  await expect(page).toHaveURL(/\/feed\?posted=/);
  await expect(page.getByRole("status").filter({ hasText: "Posted." })).toBeVisible();
  const card = page.getByTestId("post-card");
  await expect(card).toHaveCount(1);
  await expect(card).toContainText("Negative splits!");
  await expect(card).toContainText("Tempo run");
  // The start time, the session's items and its id are not part of the post.
  await expect(card).not.toContainText("06:00");
  await expect(card).not.toContainText("Original item");
  expect(await card.innerHTML()).not.toContain(sessionId);

  // Edit the caption: the snapshot stays, the post is marked as edited.
  await card.getByRole("link", { name: "Edit post" }).click();
  await hydrated(page);
  await page.getByLabel("Caption").fill("Negative splits, edited.");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
  await expect(page.getByTestId("post-card")).toContainText("Negative splits, edited.");
  await expect(page.getByTestId("post-card")).toContainText("edited");

  // Delete asks first, in TrainGrid's dialog; Escape keeps the post.
  await hydrated(page);
  await page.getByRole("button", { name: "Delete post" }).click();
  const dialog = page.getByRole("dialog", { name: "Delete this post?" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: "Delete post" }).click();
  await dialog.getByRole("button", { name: "Delete post" }).click();
  await expect(page).toHaveURL(new RegExp(`/people/${username}$`));
  await expect(page.getByTestId("profile-no-posts")).toContainText("You haven’t posted yet");

  // Posting never marks the session as done.
  await page.goto(`/session/${sessionId}`);
  await expect(page.getByText("Workout done")).toHaveCount(0);
});

test("following a private profile needs approval; removing a follower takes access away", async ({ page, context, baseURL, browser }) => {
  const ownerName = `priv_${uniq()}`;
  const owner = await member(browser, baseURL!, { username: ownerName, displayName: "Priya Private", visibility: "private", bio: "Track Tuesdays" });
  const ownerSession = await createLocalSessionFor(owner.userId, "Track intervals", todayIn("UTC").date);
  await createLocalPostFor(owner.userId, ownerSession, "Only for my people");

  const fan = await signInAsNewLocalMember(context, baseURL!);
  const fanName = `fan_${uniq()}`;
  await createLocalSocialProfile(fan.userId, { username: fanName, displayName: "Fan Follower", visibility: "public" });

  // Discover by username.
  await page.goto("/people");
  await hydrated(page);
  await page.getByRole("searchbox", { name: /Search members/ }).fill(ownerName);
  await page.getByRole("button", { name: "Search" }).click();
  await page.getByTestId("person-row").getByRole("link", { name: /Priya Private/ }).click();
  await expect(page).toHaveURL(new RegExp(`/people/${ownerName}$`));

  // Basic identity only; posts and lists are private.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Priya Private");
  await expect(page.getByText("Track Tuesdays")).toBeVisible();
  await expect(page.getByTestId("social-stats")).toContainText("1"); // one post, counted but hidden
  await expect(page.getByTestId("private-profile")).toBeVisible();
  await expect(page.getByText("Only for my people")).toHaveCount(0);
  await page.goto(`/people/${ownerName}/followers`);
  await expect(page.getByTestId("private-list")).toBeVisible();
  await page.goto(`/people/${ownerName}`);
  await hydrated(page);

  // Request, cancel, request again.
  await page.getByRole("button", { name: /Request to follow/ }).click();
  await expect(page.getByTestId("follow-button")).toHaveText("Requested");
  await hydrated(page);
  await page.getByTestId("follow-button").click();
  await page.getByRole("dialog", { name: "Cancel your request?" }).getByRole("button", { name: "Cancel request" }).click();
  await expect(page.getByTestId("follow-button")).toHaveText("Request to follow");
  await page.getByTestId("follow-button").click();
  await expect(page.getByTestId("follow-button")).toHaveText("Requested");

  // The owner sees the request (badge on People) and approves it.
  await owner.page.goto("/home");
  await expect(owner.page.getByTestId("follow-requests-badge").first()).toHaveText("1");
  await owner.page.goto("/people/requests");
  await hydrated(owner.page);
  const request = owner.page.getByRole("list", { name: "Requests to follow you" }).getByTestId("person-row");
  await expect(request).toContainText("Fan Follower");
  await request.getByRole("button", { name: "Approve Fan Follower" }).click();
  await expect(owner.page.getByTestId("requests-empty")).toBeVisible();

  // Now the fan sees the posts and appears in the followers list.
  await page.reload();
  await expect(page.getByText("Only for my people")).toBeVisible();
  await expect(page.getByTestId("follow-button")).toHaveText("Following");
  await page.goto("/feed");
  await expect(page.getByTestId("post-card")).toContainText("Only for my people");

  // The owner removes the fan: access goes at once.
  await owner.page.goto(`/people/${ownerName}/followers`);
  await hydrated(owner.page);
  await owner.page.getByRole("button", { name: "Remove Fan Follower as a follower" }).click();
  await owner.page.getByRole("dialog").getByRole("button", { name: "Remove follower" }).click();
  await expect(owner.page.getByText("No followers yet")).toBeVisible();

  await page.goto(`/people/${ownerName}`);
  await expect(page.getByTestId("private-profile")).toBeVisible();
  await page.goto("/feed");
  await expect(page.getByTestId("feed-empty")).toBeVisible();
  await owner.context.close();
});

test("public profiles follow at once; the feed is newest first and paginated; revoked members vanish", async ({
  page,
  context,
  baseURL,
  browser,
}) => {
  const coachName = `coach_${uniq()}`;
  const coach = await member(browser, baseURL!, { username: coachName, displayName: "Coach Public", visibility: "public" });
  const today = todayIn("UTC").date;
  const sessionId = await createLocalSessionFor(coach.userId, "Hill repeats", addDays(today, -1));
  for (let i = 1; i <= 23; i += 1) await createLocalPostFor(coach.userId, sessionId, `Update ${i}`);

  const reader = await signInAsNewLocalMember(context, baseURL!);
  await createLocalSocialProfile(reader.userId, { username: `reader_${uniq()}`, displayName: "Reader", visibility: "private" });

  await page.goto(`/people/${coachName}`);
  await hydrated(page);
  // A public profile's posts are visible before following.
  await expect(page.getByText("Update 23")).toBeVisible();
  await page.getByRole("button", { name: /^Follow: Coach Public/ }).click();
  await expect(page.getByTestId("follow-button")).toHaveText("Following");
  await expect(page.getByTestId("social-stats").getByRole("link", { name: "Followers: 1 follower" })).toBeVisible();

  await page.goto("/feed");
  const cards = page.getByTestId("post-card");
  await expect(cards).toHaveCount(20);
  await expect(cards.first()).toContainText("Update 23");
  await expect(cards.last()).toContainText("Update 4");
  await page.getByTestId("older-posts").click();
  await expect(cards).toHaveCount(3);
  await expect(cards.first()).toContainText("Update 3");
  await expect(page.getByText("You’re all caught up.")).toBeVisible();

  // Unfollow asks first, then the feed empties.
  await page.goto(`/people/${coachName}`);
  await hydrated(page);
  await page.getByTestId("follow-button").click();
  await page.getByRole("dialog", { name: "Unfollow Coach Public?" }).getByRole("button", { name: "Unfollow" }).click();
  await expect(page.getByTestId("follow-button")).toHaveText("Follow");
  await page.goto("/feed");
  await expect(page.getByTestId("feed-empty")).toBeVisible();

  // A revoked member's profile and posts are gone for everyone.
  const postId = await createLocalPostFor(coach.userId, sessionId, "Last one");
  await revokeLocalMember(coach.userId);
  expect((await page.goto(`/people/${coachName}`))?.status()).toBe(404);
  expect((await page.goto(`/posts/${postId}`))?.status()).toBe(404);
  await page.goto(`/people?q=${coachName}`);
  await expect(page.getByTestId("people-empty")).toBeVisible();

  // And the revoked member is signed out of everything social.
  await coach.page.goto("/feed");
  await expect(coach.page).toHaveURL(/\/login/);
  await coach.context.close();
});

test("another member's sessions and private posts are not reachable by link; pages are never indexed", async ({
  page,
  context,
  baseURL,
  browser,
  request,
}) => {
  const ownerName = `own_${uniq()}`;
  const owner = await member(browser, baseURL!, { username: ownerName, displayName: "Owner", visibility: "private" });
  const sessionId = await createLocalSessionFor(owner.userId, "Secret session", todayIn("UTC").date);
  const postId = await createLocalPostFor(owner.userId, sessionId, "Private post");

  const other = await signInAsNewLocalMember(context, baseURL!);
  await createLocalSocialProfile(other.userId, { username: `oth_${uniq()}`, displayName: "Other", visibility: "public" });

  expect((await page.goto(`/session/${sessionId}/post`))?.status()).toBe(404);
  expect((await page.goto(`/session/${sessionId}`))?.status()).toBe(404);
  expect((await page.goto(`/posts/${postId}`))?.status()).toBe(404);
  expect((await page.goto(`/posts/${postId}/edit`))?.status()).toBe(404);
  expect((await page.goto(`/people/not_a_member_${uniq()}`))?.status()).toBe(404);

  // Members only: signed-out visitors are sent to sign in, and nothing is cacheable or indexable.
  const anonymous = await request.get(`/people/${ownerName}`, { maxRedirects: 0 });
  expect(anonymous.status()).toBe(307);
  expect(anonymous.headers()["location"]).toContain("/login");
  const response = await page.goto("/feed");
  const headers = response!.headers();
  expect(headers["x-robots-tag"]).toContain("noindex");
  expect(headers["cache-control"]).toMatch(/no-store|private/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  expect(await page.title()).toBe("Feed · TrainGrid");
  await owner.context.close();
});

for (const theme of ["light", "dark"] as const) {
  test(`social pages work on a phone and pass accessibility checks (${theme})`, async ({ page, context, baseURL }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: theme });
    const me = await signInAsNewLocalMember(context, baseURL!);
    const myName = `phone_${uniq()}`;
    await createLocalSocialProfile(me.userId, { username: myName, displayName: "Phone Member", visibility: "private", bio: "Mobile first" });
    const sessionId = await createLocalSessionFor(me.userId, "Lunch run", todayIn("UTC").date);
    await createLocalPostFor(me.userId, sessionId, "A post with a reasonably long caption to check that it wraps on a narrow phone screen.");

    for (const path of ["/feed", `/people/${myName}`, "/people", "/people/requests", "/profile/social", `/session/${sessionId}/post`, "/feed/new"]) {
      await page.goto(path);
      // Audit the page, not its loading fallback: the feed's loading.tsx (no h1)
      // also covers /feed/new, and under load it can still be streaming here.
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await hydrated(page);
      await noOverflow(page);
      const { violations } = await accessibilityResults(page);
      expect(violations, `${path} (${theme})`).toEqual([]);
    }

    // The phone menu reaches Feed and People.
    await page.goto("/home");
    await hydrated(page);
    await page.getByRole("button", { name: "Open menu" }).or(page.locator("summary[aria-label='Open menu']")).click();
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Feed" })).toBeVisible();
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: /People/ }).last().click();
    await expect(page).toHaveURL(/\/people$/);
  });
}

test("the follow dialog works from the keyboard and returns focus", async ({ page, context, baseURL, browser }) => {
  const targetName = `kbd_${uniq()}`;
  const target = await member(browser, baseURL!, { username: targetName, displayName: "Keyboard Target", visibility: "public" });
  const me = await signInAsNewLocalMember(context, baseURL!);
  await createLocalSocialProfile(me.userId, { username: `me_${uniq()}`, displayName: "Me", visibility: "private" });
  await createLocalFollow(me.userId, target.userId, "accepted");

  await page.goto(`/people/${targetName}`);
  await hydrated(page);
  const button = page.getByTestId("follow-button");
  await button.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Unfollow Keyboard Target?" });
  await expect(dialog).toBeVisible();
  // Focus starts on the safe choice.
  await expect(dialog.getByRole("button", { name: "Keep" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(button).toBeFocused();
  await expect(button).toHaveText("Following");
  await target.context.close();
});
