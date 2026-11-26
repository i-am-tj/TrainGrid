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

/** Whether the submit button follows the whole preview in document (and so Tab) order. */
async function submitFollowsPreview(page: Page, submit: string) {
  return page.getByRole("button", { name: submit, exact: true }).evaluate((button) =>
    ["post-preview"].every((id) => {
      const el = document.querySelector(`[data-testid="${id}"]`)!;
      return Boolean(el.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING);
    }),
  );
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
      expect(await submitFollowsPreview(page, submit), `${path}: Tab order`).toBe(true);

      // Desktop: live preview beside the form, submit under the caption.
      await page.setViewportSize({ width: 1366, height: 900 });
      const wide = await layout(page, submit);
      expect(wide.preview.x, `${path}: preview on the right`).toBeGreaterThan(wide.caption.x + wide.caption.width);
      expect(wide.button.x, path).toBeLessThan(wide.preview.x);
      expect(wide.button.y, `${path}: submit near the form`).toBeLessThan(900);
    }
  });
}
