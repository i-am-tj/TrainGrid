import { expect, test, type Page } from "@playwright/test";
import { todayIn } from "../lib/time-zone";
import {
  createLocalRoutineFor,
  createLocalSessionFor,
  hasLocalSecretKey,
  linkSessionToRoutine,
  readRows,
  signInAsNewLocalMember,
  supabaseState,
} from "./local-supabase";

/**
 * TrainGrid 1.0: feedback, getting started, the information pages, install
 * metadata. No browser-native dialog (alert/confirm/prompt) may ever appear.
 */

test.beforeEach(async ({ page }) => {
  page.on("dialog", (dialog) => {
    throw new Error(`A native ${dialog.type()} dialog appeared: ${dialog.message()}`);
  });
});

async function hydrated(page: Page) {
  await page.waitForFunction(() => {
    const main = document.getElementById("main-content");
    return !!main && Object.keys(main).some((key) => key.startsWith("__reactFiber"));
  });
}

test.describe("signed out", () => {
  for (const [path, heading] of [
    ["/privacy", "Your data, plainly"],
    ["/terms", "Terms of use"],
    ["/whats-new", "Better every release"],
  ] as const) {
    test(`${path} is public, with one header, one main and one footer`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
      await expect(page.getByRole("banner")).toHaveCount(1);
      await expect(page.getByRole("main")).toHaveCount(1);
      await expect(page.getByRole("contentinfo")).toHaveCount(1);
      // The public header's section links lead back to the landing page.
      await expect(page.getByRole("banner").getByRole("link", { name: "Features" }).first()).toHaveAttribute("href", "/#features");
    });
  }

  test("the footer and the sign-in page link to the information pages", async ({ page }) => {
    await page.goto("/login");
    const about = page.getByRole("navigation", { name: "About TrainGrid" });
    await expect(about.getByRole("link", { name: "What’s new" })).toHaveAttribute("href", "/whats-new");
    await expect(about.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
    await expect(about.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
    await expect(page.getByRole("main").getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
    await expect(page.getByRole("main").getByRole("link", { name: "Privacy notice" })).toHaveAttribute("href", "/privacy");
  });

  test("What's new lists releases from the changelog, newest first, without maintainer notes", async ({ page }) => {
    await page.goto("/whats-new");
    await expect(page.getByText("Latest", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "TrainGrid 0.2.0-beta" })).toBeVisible();
    await expect(page.getByText("For maintainers")).toHaveCount(0);
    await expect(page.getByText("Unreleased")).toHaveCount(0);
  });

  test("TrainGrid is installable: manifest, icons and theme colour", async ({ page, request }) => {
    const manifest = await request.get("/manifest.webmanifest");
    expect(manifest.status()).toBe(200);
    const body = await manifest.json();
    expect(body).toMatchObject({ name: "TrainGrid", start_url: "/home", display: "standalone" });
    expect(body.icons.map((icon: { purpose: string }) => icon.purpose)).toEqual(["any", "any", "maskable"]);
    for (const icon of body.icons as Array<{ src: string }>) {
      const response = await request.get(icon.src);
      expect(response.status(), icon.src).toBe(200);
      expect(response.headers()["content-type"]).toContain("image/png");
    }
    await page.goto("/");
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
    await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);
  });

  test("the health check answers without signing in", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ supabase: "ok" });
  });
});

test.describe("members", () => {
  test.beforeEach(async ({ baseURL }) => {
    test.skip((await supabaseState(baseURL!)) !== "ok", "Local Supabase stack is not running");
    test.skip(!hasLocalSecretKey(), "SUPABASE_SECRET_KEY is not set for the local stack");
  });

  test("feedback is sent from a themed dialog and stored for the member only", async ({ page, context, baseURL }) => {
    const { userId } = await signInAsNewLocalMember(context, baseURL!);
    await page.goto("/home");
    await hydrated(page);
    await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Feedback" }).click();

    const dialog = page.getByRole("dialog", { name: "Share feedback" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("radio", { name: "Idea" })).toBeFocused();
    const send = dialog.getByRole("button", { name: "Send feedback" });
    await expect(send).toBeDisabled();

    await dialog.getByText("Problem", { exact: true }).click();
    await expect(dialog.getByText("Something broken, confusing or slow")).toBeVisible();
    await dialog.getByRole("textbox", { name: "Your message" }).fill("The week view could show totals.");
    await expect(dialog.getByText("32 / 2,000")).toBeVisible();
    await send.click();

    await expect(dialog.getByRole("heading", { name: "Thank you" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Done" })).toBeFocused();
    const rows = await readRows("member_feedback", { user_id: userId });
    expect(rows).toEqual([
      expect.objectContaining({ kind: "problem", message: "The week view could show totals.", page_path: "/home" }),
    ]);

    // The owner's copy comes from "TrainGrid Feedback" on the sending domain,
    // and a reply goes to the member.
    const sent = (await (await fetch("http://127.0.0.1:3011/__sent")).json()) as Array<{
      to: string;
      from: string;
      replyTo: string | null;
      text: string;
    }>;
    const copy = sent.filter((email) => email.to === "owner-feedback@example.test" && email.text.includes("The week view could show totals."));
    expect(copy).toHaveLength(1);
    expect(copy[0]!.from).toBe("TrainGrid Feedback <feedback@example.test>");
    expect(copy[0]!.replyTo).toMatch(/^e2e-[0-9a-f-]+@example\.test$/);

    await dialog.getByRole("button", { name: "Done" }).click();
    await expect(dialog).toBeHidden();
    // Opening it again starts afresh.
    await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Feedback" }).click();
    await expect(dialog.getByRole("textbox", { name: "Your message" })).toHaveValue("");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("on a phone, Feedback in the menu closes the menu and opens the dialog", async ({ page, context, baseURL }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInAsNewLocalMember(context, baseURL!);
    await page.goto("/home");
    await hydrated(page);
    await page.getByLabel("Open menu", { exact: true }).click();
    await page.getByRole("button", { name: "Feedback" }).click();
    const dialog = page.getByRole("dialog", { name: "Share feedback" });
    await expect(dialog).toBeVisible();
    await expect(page.locator('header details:has(> summary[aria-label$=" menu"])')).not.toHaveAttribute("open", "");
    // A click on the backdrop closes it.
    await page.mouse.click(5, 5);
    await expect(dialog).toBeHidden();
  });

  test("getting started ticks itself off from real data, and can be hidden", async ({ page, context, baseURL }) => {
    const { userId } = await signInAsNewLocalMember(context, baseURL!);
    await page.goto("/home");
    const card = page.getByTestId("getting-started");
    await expect(card.getByRole("heading", { name: "Make TrainGrid yours" })).toBeVisible();
    await expect(card.getByRole("progressbar", { name: "Getting started progress" })).toHaveAttribute("aria-valuenow", "0");
    await expect(card.getByText("0 of 3 done")).toBeVisible();

    const today = todayIn(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone), new Date());
    const routineId = await createLocalRoutineFor(userId, "Starter routine");
    await page.reload();
    await expect(card.getByText("1 of 3 done")).toBeVisible();
    await expect(card.getByRole("heading", { name: "Make a routine your own (done)" })).toBeVisible();

    const sessionId = await createLocalSessionFor(userId, "Starter session", today.date);
    await linkSessionToRoutine(sessionId, routineId);
    await page.reload();
    // All three done: the card steps aside on its own.
    await expect(card).toHaveCount(0);
  });

  test("hiding getting started is remembered", async ({ page, context, baseURL }) => {
    await signInAsNewLocalMember(context, baseURL!);
    await page.goto("/home");
    await hydrated(page);
    await page.getByRole("button", { name: "Hide getting started" }).click();
    await expect(page.getByTestId("getting-started")).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByTestId("getting-started")).toHaveCount(0);
  });

  test("members read the information pages inside the app, with their own header", async ({ page, context, baseURL }) => {
    await signInAsNewLocalMember(context, baseURL!);
    await page.goto("/whats-new");
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Home", exact: true })).toBeVisible();
    await expect(page.getByRole("banner")).toHaveCount(1);
    await page.goto("/privacy");
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Feedback" })).toBeVisible();
  });
});
