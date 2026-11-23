import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { Locator, LocatorScreenshotOptions, Page, PageScreenshotOptions } from "@playwright/test";

/**
 * Documentation screenshots taken along the way by a test. They are saved only
 * when asked for, with UI_SHOTS=1, so an ordinary test run (locally or on CI)
 * never rewrites the committed images under docs/images:
 *
 *   UI_SHOTS=1 npm run test:ui
 *   UI_SHOTS=1 npx playwright test e2e/loaders.spec.ts
 *
 * The test's assertions run either way; only the file is skipped.
 */
export function docImagesRequested(): boolean {
  return process.env.UI_SHOTS === "1";
}

export async function docImage(target: Page, path: string, options?: Omit<PageScreenshotOptions, "path">): Promise<void>;
export async function docImage(target: Locator, path: string, options?: Omit<LocatorScreenshotOptions, "path">): Promise<void>;
export async function docImage(
  target: Page | Locator,
  path: string,
  options: Omit<PageScreenshotOptions, "path"> | Omit<LocatorScreenshotOptions, "path"> = {},
): Promise<void> {
  if (!docImagesRequested()) return;
  await mkdir(dirname(path), { recursive: true });
  await (target as Page).screenshot({ ...(options as PageScreenshotOptions), path });
}
