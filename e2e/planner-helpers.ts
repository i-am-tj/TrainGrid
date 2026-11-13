import { expect, type Page } from "@playwright/test";

/** Fills workout item `index` (0-based) in the structured item editor. */
export async function fillItem(
  page: Page,
  index: number,
  name: string,
  instruction: string,
  details: { rest?: string; target?: string; notes?: string; equipment?: string[]; video?: string } = {},
) {
  if (index > 0) await page.getByRole("button", { name: "Add workout item" }).click();
  await page.getByRole("textbox", { name: `Workout item ${index + 1}`, exact: true }).fill(name);
  await page.getByRole("textbox", { name: "Instruction" }).nth(index).fill(instruction);

  if (Object.keys(details).length === 0) return;
  // Scoped to main: the header's phone menu is a <details> too.
  const more = page.locator("main").getByText("More details").nth(index);
  const box = page.locator("main details").nth(index);
  if (!(await box.evaluate((el) => (el as HTMLDetailsElement).open))) await more.click();
  if (details.rest) await box.getByRole("textbox", { name: "Rest" }).fill(details.rest);
  if (details.target) await box.getByRole("textbox", { name: "Target" }).fill(details.target);
  if (details.notes) await box.getByRole("textbox", { name: "Notes" }).fill(details.notes);
  for (const tag of details.equipment ?? []) {
    await box.getByRole("button", { name: tag, exact: true }).click();
  }
  if (details.video) await box.getByRole("textbox", { name: "YouTube URL" }).fill(details.video);
}

/** Creates a personal routine and waits for its detail page. Returns its URL. */
export async function createRoutine(
  page: Page,
  name: string,
  type: string,
  items: Array<Parameters<typeof fillItem> extends [Page, number, ...infer R] ? R : never>,
): Promise<string> {
  await page.goto("/library/new");
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Type").selectOption(type);
  for (const [index, item] of items.entries()) await fillItem(page, index, ...item);
  await page.getByRole("button", { name: "Save" }).click();
  await page.waitForURL(/\/library\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
  return page.url();
}

/** Schedules a routine from the library onto this week. */
export async function scheduleRoutine(page: Page, routineName: string, day: string, time: string) {
  await page.goto("/library");
  await page
    .getByRole("listitem")
    .filter({ hasText: new RegExp(`^${routineName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`) })
    .getByRole("link", { name: "Schedule" })
    .click();
  await page.waitForURL(/\/add/);
  await page.locator('select[name="day"]').selectOption(day);
  await page.locator('select[name="time"]').selectOption(time);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.waitForURL(/\/week\//);
}
