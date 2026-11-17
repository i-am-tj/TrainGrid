import { defineConfig, devices } from "@playwright/test";

/** Component-only browser checks; no Supabase, secrets, dev server or production requests. */
export default defineConfig({
  outputDir: ".next/ui-test-results",
  testDir: "tests/ui",
  fullyParallel: false,
  workers: 1,
  use: { ...devices["Desktop Chrome"] },
  projects: [{ name: "chromium" }],
});
