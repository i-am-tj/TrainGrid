import { existsSync } from "fs";
import path from "path";
import { defineConfig, devices } from "@playwright/test";

// Give the test process the same local Supabase settings Next.js reads.
const envFile = path.join(__dirname, ".env.local");
if (existsSync(envFile)) process.loadEnvFile(envFile);

export const e2eDataDir = path.join(__dirname, "e2e", ".data");

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://127.0.0.1:3010",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npx next dev --hostname 127.0.0.1 --port 3010",
    url: "http://127.0.0.1:3010",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      TRAINGRID_DATA_DIR: e2eDataDir,
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
