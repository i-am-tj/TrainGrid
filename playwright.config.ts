import { existsSync } from "fs";
import path from "path";
import { defineConfig, devices } from "@playwright/test";

// Give the test process the same local Supabase settings Next.js reads.
const envFile = path.join(__dirname, ".env.local");
if (existsSync(envFile)) process.loadEnvFile(envFile);

/**
 * E2E_SERVER=build runs the suite against a production build (`next start`;
 * run `npm run build` first). CI uses it: `next dev` compiles each route on
 * its first request, which on a CI runner can take longer than a test's
 * timeouts. Locally the default stays `next dev`.
 */
const useBuild = process.env.E2E_SERVER === "build";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  // On CI a failed test runs once more; Playwright still reports it as flaky.
  retries: process.env.CI ? 1 : 0,
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://127.0.0.1:3010",
    // Tests plan sessions on UTC dates (todayIn("UTC")); the browser agrees, whatever
    // the machine's zone and time of day. e2e/time-zone.spec.ts sets its own zones.
    timezoneId: "UTC",
    trace: "on-first-retry",
  },
  webServer: [
    {
      // Local stand-in for the email provider; never sends real mail.
      command: "node e2e/mock-resend.mjs",
      url: "http://127.0.0.1:3011",
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: useBuild
        ? "npx next start --hostname 127.0.0.1 --port 3010"
        : "npx next dev --hostname 127.0.0.1 --port 3010",
      url: "http://127.0.0.1:3010",
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...process.env,
        // Fixed id of the local E2E admin (see e2e/local-supabase.ts).
        TRAINGRID_ADMIN_USER_IDS: "e2e00000-0000-4000-8000-00000000ad01",
        // Trusted origin for invitation links, and the mock email provider.
        TRAINGRID_SITE_URL: "http://127.0.0.1:3010",
        RESEND_API_URL: "http://127.0.0.1:3011",
        RESEND_API_KEY: "re_local_e2e_mock",
        TRAINGRID_EMAIL_FROM: "TrainGrid <invites@example.test>",
        // Owner's copy of member feedback, sent through the same mock.
        TRAINGRID_FEEDBACK_TO: "owner-feedback@example.test",
      },
    },
  ],
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
