import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

/**
 * Documentation screenshots (npm run screenshots): seeds a realistic member
 * on the local stack and captures docs/images/v1/*.png from a production
 * build (E2E_SERVER=build), in light and dark. Not part of the test suites,
 * so test runs never rewrite committed images.
 */
export default defineConfig({
  ...base,
  testMatch: "**/*.capture.ts",
  retries: 0,
  timeout: 300_000,
  outputDir: ".next/screenshot-results",
});
