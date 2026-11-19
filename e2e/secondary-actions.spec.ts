import { mkdir } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { accessibilityResults } from "../tests/helpers/accessibility";
import { todayIn } from "../lib/time-zone";
import {
  createLocalSessionFor,
  signInAsNewLocalMember,
} from "./local-supabase";

const folder = "docs/images/epic-3/secondary-actions";
async function theme(page: Page, value: "light" | "dark") {
  await page.emulateMedia({ colorScheme: value, reducedMotion: "reduce" });
  const toggle = page.getByRole("button", {
    name: `Switch to ${value} mode`,
    exact: true,
  });
  if (await toggle.count()) await toggle.click();
}
/** Screenshots only on request (UI_SHOTS=1), so a test run never rewrites docs/images. */
async function capture(page: Page, name: string) {
  if (!process.env.UI_SHOTS) return;
  await mkdir(folder, { recursive: true });
  await page.screenshot({
    path: `${folder}/${name}.png`,
    animations: "disabled",
    style: "nextjs-portal { display: none !important; }",
  });
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

test("the header leads members to their profile, where their data download lives", async ({
  page,
  context,
  baseURL,
}) => {
  await signInAsNewLocalMember(context, baseURL!);
  await page.goto("/library");
  await page.waitForFunction(() => {
    const main = document.getElementById("main-content");
    return !!main && Object.keys(main).some((key) => key.startsWith("__reactFiber"));
  });
  for (const scheme of ["light", "dark"] as const) {
    await theme(page, scheme);
    for (const width of [320, 360, 1440]) {
      await page.setViewportSize({ width, height: 800 });
      await expect(page.getByRole("banner").getByRole("link", { name: /Export|Download my data/ })).toHaveCount(0);
      if (width < 640) {
        await page.getByLabel("Open menu", { exact: true }).click();
        const profile = page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: /Profile/ });
        await expect(profile).toHaveAttribute("href", "/profile");
        await noOverflow(page);
        if (width !== 320) await capture(page, `account-${width}-${scheme}`);
        await page.keyboard.press("Escape");
        await expect(page.getByLabel("Open menu", { exact: true })).toBeVisible();
      } else {
        await expect(page.getByRole("banner").getByRole("link", { name: "Profile", exact: true })).toHaveAttribute(
          "href",
          "/profile",
        );
        await noOverflow(page);
        await capture(page, `account-${width}-${scheme}`);
      }
    }
  }
});

test("planner exposes only available scheduling controls", async ({ page, context, baseURL }) => {
  const { userId } = await signInAsNewLocalMember(context, baseURL!);
  await createLocalSessionFor(userId, "Planned session", "2026-11-17");
  await page.goto("/week/2026-W47?day=2");
  for (const scheme of ["light", "dark"] as const) {
    await theme(page, scheme);
    for (const width of [360, 1440]) {
      await page.setViewportSize({ width, height: 800 });
      await expect(page.getByRole("link", { name: "Add session", exact: true }).first()).toBeVisible();
      await expect(page.getByRole("button", { name: /duplicate week|week actions/i })).toHaveCount(0);
      await expect(page.locator('input[name="sourceWeekId"], select[name="destWeekId"]')).toHaveCount(0);
      await noOverflow(page);
      await capture(page, `planner-${width}-${scheme}`);
    }
  }
});

test("mobile home prioritizes today's first session ahead of getting started", async ({
  page,
  context,
  baseURL,
}) => {
  const { userId } = await signInAsNewLocalMember(context, baseURL!);
  await createLocalSessionFor(userId, "Today comes first", todayIn("UTC").date);
  await page.goto("/home");
  const first = page.getByRole("link", {
    name: "Today comes first",
    exact: true,
  });
  for (const scheme of ["light", "dark"] as const) {
    await theme(page, scheme);
    for (const width of [320, 360, 1440]) {
      await page.setViewportSize({ width, height: 800 });
      await expect(first).toBeVisible();
      await expect(page.getByTestId("getting-started")).toBeVisible();
      if (width < 640) {
        const session = (await first.boundingBox())!;
        const intro = (await page
          .getByTestId("getting-started")
          .boundingBox())!;
        expect(session.y).toBeLessThan(480);
        expect(intro.y).toBeGreaterThan(session.y + session.height);
        const release = page.locator('main a[href="/whats-new"]');
        if (await release.count())
          expect((await release.boundingBox())!.height).toBeLessThanOrEqual(44);
      }
      await noOverflow(page);
      if (width === 360) expect((await accessibilityResults(page)).violations).toEqual([]);
      if (width !== 320) await capture(page, `home-${width}-${scheme}`);
    }
  }
});

test("public access guidance gives invited and uninvited visitors a next step without registration", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText(/duplicate week|copy an existing training week|keep a good week going/i)).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "No invitation yet? Request one", exact: true }),
  ).toHaveAttribute("href", "/login?request=invite");
  const access = page.locator("#access");
  await expect(access).toContainText(
    "log in with Google or GitHub using that email address",
  );
  await expect(access).toContainText("there is no public sign-up");
  await expect(
    access.getByRole("link", { name: "Request an invite", exact: true }),
  ).toHaveAttribute("href", "/login?request=invite");
  await expect(
    page.getByRole("link", { name: /register|sign up/i }),
  ).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Profile", exact: true })).toHaveCount(0);
  for (const scheme of ["light", "dark"] as const) {
    await theme(page, scheme);
    for (const width of [320, 360, 1440]) {
      await page.setViewportSize({ width, height: 800 });
      await access.scrollIntoViewIfNeeded();
      await noOverflow(page);
      if (width !== 320) await capture(page, `access-${width}-${scheme}`);
    }
  }
  await page.goto("/whats-new");
  await expect(page.getByText(/duplicate week|copy an existing training week/i)).toHaveCount(0);
});
