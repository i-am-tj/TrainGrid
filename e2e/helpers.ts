import { mkdir, rm, writeFile } from "fs/promises";
import path from "path";
import { e2eDataDir } from "../playwright.config";

export async function resetData() {
  await rm(e2eDataDir, { recursive: true, force: true });
  await mkdir(path.join(e2eDataDir, "templates"), { recursive: true });
  await writeFile(
    path.join(e2eDataDir, "schedule.json"),
    `${JSON.stringify({ sessions: [] }, null, 2)}\n`,
  );
}

export async function addWorkoutItem(
  page: import("@playwright/test").Page,
  index: number,
  title: string,
  body: string,
) {
  if (index > 0) {
    await page.getByRole("button", { name: "Add workout item" }).click();
  }
  await page
    .getByRole("textbox", { name: new RegExp(`^Workout item ${index + 1}`) })
    .fill(title);
  await page.getByRole("textbox", { name: /^Details/ }).nth(index).fill(body);
}

export async function saveTemplate(page: import("@playwright/test").Page) {
  const creating = page.url().includes("/library/new");
  await page.getByRole("button", { name: "Save" }).click();
  if (creating) {
    await page.waitForURL((url) => {
      const path = new URL(url).pathname;
      return /^\/library\/[a-z0-9-]+$/.test(path) && path !== "/library/new";
    });
  }
}

export async function scheduleTemplate(
  page: import("@playwright/test").Page,
  templateName: string,
  day: string,
  time: string,
) {
  await page.goto("/library");
  await page
    .getByRole("listitem")
    .filter({ hasText: templateName })
    .getByRole("link", { name: "Schedule" })
    .click();
  await page.waitForURL(/\/add/);
  await page.locator('select[name="day"]').selectOption(day);
  await page.locator('select[name="time"]').selectOption(time);
  await page.getByRole("button", { name: "Add" }).click();
  await page.waitForURL(/\/week\//);
}
