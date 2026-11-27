import { expect, test, type Page } from "@playwright/test";
import { todayIn } from "../lib/time-zone";
import {
  createLocalPostFor,
  createLocalSessionFor,
  createLocalSocialProfile,
  hasLocalSecretKey,
  signInAsNewLocalMember,
  supabaseState,
} from "./local-supabase";

/**
 * On a phone, the author reaches the whole preview and its audience before
 * the submit button, by scrolling and by Tab (UI_DESIGN_AUDIT rank 5). The
 * desktop keeps the side-by-side live preview.
 */

test.beforeEach(async ({ baseURL }) => {
  test.skip((await supabaseState(baseURL!)) !== "ok", "Local Supabase stack is not running");
  test.skip(!hasLocalSecretKey(), "Local Supabase secret key is not configured");
});

const AUDIENCE = {
  private: "For approved followers",
  public: "For all signed-in members",
} as const;

async function layout(page: Page, submit: string) {
  const preview = (await page.getByTestId("post-preview").boundingBox())!;
  const audience = (await page.getByTestId("post-audience").boundingBox())!;
  const button = (await page.getByRole("button", { name: submit, exact: true }).boundingBox())!;
  const caption = (await page.getByLabel("Caption").boundingBox())!;
  return { preview, audience, button, caption };
}

/**
 * Presses Tab from the caption until submit has focus, and returns what was
 * focused on the way (accessible names; the preview region as "Preview").
 */
async function tabToSubmit(page: Page, submit: string) {
  await page.getByLabel("Caption").focus();
  const stops: string[] = [];
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    const name = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      const labelled = el.getAttribute("aria-labelledby");
      return (
        (labelled ? document.getElementById(labelled)?.textContent : null) ??
        el.getAttribute("aria-label") ??
        el.innerText ??
        el.tagName
      ).trim();
    });
    stops.push(name);
    if (name === submit) return stops;
  }
  return stops;
}

for (const visibility of ["private", "public"] as const) {
  test(`new and edited ${visibility} posts put the preview before submit on a phone`, async ({ page, context, baseURL }) => {
    const { userId } = await signInAsNewLocalMember(context, baseURL!);
    await createLocalSocialProfile(userId, {
      username: `review_${visibility}_${crypto.randomUUID().slice(0, 6)}`,
      displayName: "Review Member",
      visibility,
    });
    const sessionId = await createLocalSessionFor(userId, "Tempo run", todayIn("UTC").date);
    const postId = await createLocalPostFor(userId, sessionId, "Already posted");

    for (const [path, submit] of [
      [`/session/${sessionId}/post`, "Post update"],
      [`/posts/${postId}/edit`, "Save changes"],
    ] as const) {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(path);
      await page.getByLabel("Caption").fill("Negative splits!");
      await expect(page.getByTestId("post-preview")).toContainText("Negative splits!");
      await expect(page.getByTestId("post-audience")).toHaveText(AUDIENCE[visibility]);

      const phone = await layout(page, submit);
      expect(phone.button.y, `${path}: submit after preview`).toBeGreaterThan(phone.preview.y + phone.preview.height);
      expect(Math.abs(phone.audience.y - phone.button.y), `${path}: audience beside submit`).toBeLessThan(phone.button.height);

      // Keyboard: Tab meets the preview, as one stop, right before submit, and
      // shows it; submit carries the audience as its description.
      const long = Array.from({ length: 12 }, (_, i) => `Line ${i + 1} of a long caption.`).join("\n");
      await page.getByLabel("Caption").fill(long);
      const stops = await tabToSubmit(page, submit);
      expect(stops.at(-1), `${path}: Tab reaches submit`).toBe(submit);
      expect(stops.at(-2), `${path}: preview just before submit`).toBe("Preview");
      expect(stops.filter((s) => s === "Preview"), path).toHaveLength(1);
      await page.keyboard.press("Shift+Tab");
      const preview = page.getByRole("region", { name: "Preview" });
      await expect(preview).toBeFocused();
      await expect(page.locator("#preview-title")).toBeInViewport();
      expect(
        await preview.evaluate((el) => getComputedStyle(el).boxShadow),
        `${path}: visible focus ring`,
      ).not.toBe("none");
      await expect(page.getByRole("button", { name: submit, exact: true })).toHaveAccessibleDescription(
        AUDIENCE[visibility],
      );

      // Desktop: live preview beside the form, submit under the caption.
      await page.setViewportSize({ width: 1366, height: 900 });
      const wide = await layout(page, submit);
      expect(wide.preview.x, `${path}: preview on the right`).toBeGreaterThan(wide.caption.x + wide.caption.width);
      expect(wide.button.x, path).toBeLessThan(wide.preview.x);
      expect(wide.button.y, `${path}: submit near the form`).toBeLessThan(900);
    }
  });
}
