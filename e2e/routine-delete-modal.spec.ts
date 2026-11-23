import { expect, test } from "@playwright/test";
import { docImage } from "../tests/helpers/doc-images";
import { accessibilityResults } from "../tests/helpers/accessibility";
import { createRoutine } from "./planner-helpers";
import { signInAsNewLocalMember } from "./local-supabase";

test("routine deletion modal is accessible, responsive and safely dismissible", async ({
  page,
  context,
  baseURL,
}) => {
  await signInAsNewLocalMember(context, baseURL!);
  const routine = await createRoutine(
    page,
    "Modal review routine",
    "strength",
    [["Squat", "3 × 5"]],
  );
  await page.goto(`${routine}/edit`);
  page.on("dialog", () => {
    throw new Error("Routine deletion must not use a browser prompt");
  });
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    for (const width of [320, 1440]) {
      await page.setViewportSize({ width, height: 740 });
      const trigger = page.getByRole("button", {
        name: "Delete routine",
        exact: true,
      });
      await trigger.click();
      const dialog = page.getByRole("dialog", { name: "Delete this routine?" });
      await expect(dialog).toBeVisible();
      await expect(
        dialog.getByRole("button", { name: "Cancel", exact: true }),
      ).toBeFocused();
      await expect(dialog).toContainText("keep their own copy of the workout");
      await page.keyboard.press("Tab");
      await expect(
        dialog.getByRole("button", { name: "Delete routine", exact: true }),
      ).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(
        dialog.getByRole("button", { name: "Cancel", exact: true }),
      ).toBeFocused();
      await page.getByLabel("Name", { exact: true }).evaluate((element) => element.focus());
      await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
      const box = (await dialog.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect((await accessibilityResults(page)).violations).toEqual([]);
      await docImage(page, `docs/images/epic-3/enhancements/delete-routine-${width}-${scheme}.png`, {
        style: "nextjs-portal { display: none !important; }",
      });
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
      await expect(trigger).toBeFocused();
      await trigger.click();
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(dialog).not.toBeVisible();
      await expect(trigger).toBeFocused();
      await expect(page).toHaveURL(`${routine}/edit`);
      await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
        "Modal review routine",
      );
    }
  }
});
