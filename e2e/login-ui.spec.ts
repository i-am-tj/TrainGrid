import { expect, test } from "@playwright/test";
import { docImage } from "../tests/helpers/doc-images";
import { supabaseState } from "./local-supabase";

for (const scheme of ["light", "dark"] as const) {
  test(`login fits narrow and short displays (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    for (const [width, height] of [
      [320, 740],
      [360, 800],
      [768, 1024],
      [1024, 768],
      [1440, 480],
    ]) {
      await page.setViewportSize({ width: width!, height: height! });
      await page.goto("/login?error=email&next=%2Flibrary%3Fscope%3Dmine");
      await expect(
        page.getByRole("heading", { name: "Welcome to TrainGrid" }),
      ).toBeVisible();
      await expect(page.getByRole("main").getByRole("alert")).toContainText(
        "verified email",
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (width === 360 || width === 1440) {
        if (width === 1440) await page.setViewportSize({ width, height: 900 });
        await page.goto("/login");
        await expect(
          page.getByRole("button", { name: /^Switch to/ }),
        ).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        await docImage(page, `docs/images/epic-3/ui-02/login-live-${width}-${scheme}.png`, {
          fullPage: true,
          style: "nextjs-portal { display: none !important; }",
        });
      }
    }
  });
}

test("provider controls preserve next and show real Server Action progress", async ({
  page,
  baseURL,
}) => {
  test.skip(
    (await supabaseState(baseURL!)) === "unconfigured",
    "Supabase is not configured",
  );
  await page.goto("/login?next=%2Flibrary%3Fscope%3Dmine");
  await expect(page.getByRole("button", { name: /^Switch to/ })).toBeVisible();
  const google = page.getByRole("button", {
    name: "Continue with Google",
    exact: true,
  });
  const github = page.getByRole("button", {
    name: "Continue with GitHub",
    exact: true,
  });
  await expect(page.locator('input[name="next"]')).toHaveCount(2);
  for (const input of await page.locator('input[name="next"]').all())
    await expect(input).toHaveValue("/library?scope=mine");
  await google.focus();
  await page.keyboard.press("Tab");
  await expect(github).toBeFocused();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/login**", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await gate;
    await route.abort();
  });
  try {
    await google.click();
    await expect(google).toBeDisabled();
    await expect(google).toHaveAttribute("aria-busy", "true");
    await expect(google).toContainText("Connecting to Google…");
  } finally {
    release();
  }
});
