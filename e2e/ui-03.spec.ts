import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { createRoutine } from "./planner-helpers";
import {
  createLocalSessionFor,
  hasLocalSecretKey,
  signInAsLocalAdmin,
  signInAsNewLocalMember,
  supabaseState,
} from "./local-supabase";

async function capture(page: import("@playwright/test").Page, name: string) {
  await mkdir("docs/images/epic-3/ui-03", { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: `docs/images/epic-3/ui-03/${name}.png`,
    fullPage: true,
    style: "nextjs-portal { display: none !important; }",
  });
}

test.beforeEach(async ({ baseURL }) => {
  test.skip(
    (await supabaseState(baseURL!)) !== "ok",
    "Local Supabase stack is not running",
  );
  test.skip(
    !hasLocalSecretKey(),
    "Local Supabase secret key is not configured",
  );
});

test("admin email preview is honest, isolated, responsive and copyable", async ({
  page,
  context,
  baseURL,
}) => {
  await signInAsLocalAdmin(context, baseURL!);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/admin/invitations");
  await expect(
    page.getByRole("heading", { name: "Invitations", exact: true }),
  ).toBeVisible();
  // Sending is configured for E2E (mock provider), and the copy says so honestly.
  await expect(
    page.getByText("TrainGrid emails this sign-in link when the box is ticked.", { exact: false }),
  ).toBeVisible();
  await page.getByText("Preview invitation email", { exact: false }).click();
  await page
    .getByLabel("Preview recipient", { exact: true })
    .fill("preview.member@example.test");
  const email = page.frameLocator('iframe[title="Invitation email preview"]');
  await expect(
    email.getByRole("heading", { name: "You’re invited to TrainGrid." }),
  ).toBeVisible();
  await expect(
    email.getByRole("link", { name: "Open TrainGrid" }),
  ).toHaveAttribute("href", `${baseURL}/login`);
  await page
    .getByRole("button", { name: "Copy invitation text", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain("preview.member@example.test");
  await page
    .getByRole("button", { name: "Copy sign-in link", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe(`${baseURL}/login`);
  // The live page has no hypothetical delivery examples; real status is in the list.
  await expect(
    page.getByText("Future email workflow · design preview", { exact: true }),
  ).toHaveCount(0);
  for (const scheme of ["light", "dark"] as const) {
    await page.evaluate(
      (dark) => document.documentElement.classList.toggle("dark", dark),
      scheme === "dark",
    );
    for (const width of [320, 360, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (width === 360 || width === 1440)
        await capture(page, `invitations-${width}-${scheme}`);
    }
  }
  await page.getByLabel("Preview recipient", { exact: true }).fill("invalid");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Enter a valid email address",
  );
  await expect(
    page.locator('iframe[title="Invitation email preview"]'),
  ).toHaveCount(0);
});

test("planner keeps ordinary desktop footer visible, preserves 24 hours and allows short pages to scroll", async ({
  page,
  context,
  baseURL,
}) => {
  const member = await signInAsNewLocalMember(context, baseURL!);
  for (const [width, height] of [
    [1440, 900],
    [1024, 768],
    [768, 1024],
    [1440, 480],
    [1024, 420],
    [1440, 320],
  ]) {
    await page.setViewportSize({ width: width!, height: height! });
    await page.goto("/week/2026-W47");
    const grid = page.getByRole("region", {
      name: "Weekly calendar time grid",
    });
    await expect(grid).toBeVisible();
    await expect(grid.getByRole("link", { name: /^Add session / })).toHaveCount(
      168,
    );
    expect(await grid.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(
      true,
    );
    await expect
      .poll(() => grid.evaluate((el) => el.scrollTop))
      .toBeGreaterThan(250);
    const bounds = (await grid.boundingBox())!;
    const footer = (await page.getByRole("contentinfo").boundingBox())!;
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(footer.y);
    if (height! >= 768)
      expect(footer.y + footer.height).toBeLessThanOrEqual(height! + 1);
    else
      expect(
        await page.evaluate(
          () => document.documentElement.scrollHeight > innerHeight,
        ),
      ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await createLocalSessionFor(member.userId, "Morning easy run", "2026-11-16");
  await createLocalSessionFor(
    member.userId,
    "Another planned session in the same hour with a longer descriptive name",
    "2026-11-16",
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/week/2026-W47/add?day=2&untimed=1");
  await page.getByRole("radio", { name: "Blank", exact: true }).check();
  await page.getByLabel("Name", { exact: true }).fill("Untimed mobility");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.waitForURL(/\/week\/2026-W47(?:\?|$)/);
  const grid = page.getByRole("region", { name: "Weekly calendar time grid" });
  await expect(grid).toBeVisible();
  const first = (await grid
    .getByRole("link", { name: "Morning easy run, 06:00", exact: true })
    .boundingBox())!;
  const second = (await grid
    .getByRole("link", {
      name: "Another planned session in the same hour with a longer descriptive name, 06:00",
      exact: true,
    })
    .boundingBox())!;
  expect(second.x).toBe(first.x);
  const [top, bottom] = [first, second].sort((a, b) => a.y - b.y);
  expect(bottom!.y).toBeGreaterThanOrEqual(top!.y + top!.height);
  await grid.evaluate((element) => {
    element.scrollTop = 0;
  });
  await expect(
    grid.getByRole("link", { name: "Untimed mobility, no time", exact: true }),
  ).toBeVisible();
  await grid.focus();
  await page.keyboard.press("End");
  await expect
    .poll(() => grid.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(700);
  // A 200% browser zoom on a 1440×900 screen exposes about 720×450 CSS pixels.
  await page.setViewportSize({ width: 720, height: 450 });
  await expect(
    page.getByRole("region", { name: "Weekly calendar time grid" }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  const scaledGrid = (await grid.boundingBox())!;
  const scaledFooter = (await page.getByRole("contentinfo").boundingBox())!;
  expect(scaledGrid.y + scaledGrid.height).toBeLessThanOrEqual(scaledFooter.y);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "";
  });
  for (const scheme of ["light", "dark"] as const) {
    await page.evaluate(
      (dark) => document.documentElement.classList.toggle("dark", dark),
      scheme === "dark",
    );
    for (const width of [360, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/week/2026-W47?day=2");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByTestId("section-loader")).toHaveCount(0);
      await page.evaluate(
        (dark) => document.documentElement.classList.toggle("dark", dark),
        scheme === "dark",
      );
      await capture(page, `planner-${width}-${scheme}`);
    }
  }
});


test("routine and session screens retain structured controls and fit both themes", async ({ page, context, baseURL }) => {
  await signInAsNewLocalMember(context, baseURL!);
  const name = "A strength routine for the week ahead";
  const routineUrl = await createRoutine(page, name, "strength", [
    ["Back squat", "4 × 5–6", { rest: "2–3 minutes", target: "RPE 7–8", notes: "Controlled, full range", equipment: ["Barbell"], video: "https://youtu.be/abcdefghijk" }],
    ["Split squat", "3 × 8 each side", { equipment: ["Dumbbell"] }],
  ]);
  const routinePath = new URL(routineUrl).pathname;
  const routineId = routinePath.split("/").at(-1)!;
  await page.goto(`/week/2026-W47/add?routine=${routineId}&day=2&time=07:00`);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.waitForURL(/\/week\/2026-W47(?:\?|$)/);
  const sessionPath = (await page.getByRole("region", { name: "Weekly calendar time grid" }).getByRole("link", { name: `${name}, 07:00`, exact: true }).getAttribute("href"))!;
  const screens = [
    ["library", "/library?scope=mine"],
    ["routine", routinePath],
    ["routine-editor", `${routinePath}/edit`],
    ["add-session", `/week/2026-W47/add?routine=${routineId}`],
    ["session", sessionPath],
    ["session-edit", `${sessionPath}/edit`],
    ["customize", `${sessionPath}/customize`],
  ];
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    for (const width of [320, 360, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const [screen, href] of screens) {
        await page.goto(href!);
        await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toBeVisible();
        await expect(page.getByTestId("section-loader")).toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${screen} ${width} ${scheme}`).toBe(true);
        if ([360, 1440].includes(width) && (scheme === "light" || ["routine-editor", "session"].includes(screen!))) await capture(page, `${screen}-${width}-${scheme}`);
      }
    }
  }
  await page.goto(`${routinePath}/edit`);
  await expect(page.getByLabel("Rest", { exact: true }).first()).toHaveValue("2–3 minutes");
  await expect(page.getByRole("button", { name: "Barbell", exact: true }).first()).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Delete routine", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${routinePath}/edit$`));
  await page.goto(`${sessionPath}/edit`);
  await page.getByRole("button", { name: "Delete session", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Keep session", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${sessionPath}/edit$`));
});
