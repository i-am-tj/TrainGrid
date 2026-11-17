import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

/** Audits the optimized app, never the development toolbar or dev bundles. Build first. */
export default defineConfig({
  ...base,
  testMatch: "**/ui-04.audit.ts",
  timeout: 120_000,
  outputDir: ".next/audit-results",
  webServer: {
    command: "npx next start --hostname 127.0.0.1 --port 3010",
    url: "http://127.0.0.1:3010",
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      ...process.env,
      TRAINGRID_ADMIN_USER_IDS: "e2e00000-0000-4000-8000-00000000ad01",
      TRAINGRID_SITE_URL: "http://127.0.0.1:3010",
    },
  },
});
