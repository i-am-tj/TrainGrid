import { existsSync } from "fs";
import path from "path";
import { defineConfig } from "vitest/config";

// Integration tests run against the LOCAL Supabase stack (npm run supabase:start)
// with the settings from .env.local.
const envFile = path.join(__dirname, ".env.local");
if (existsSync(envFile)) process.loadEnvFile(envFile);

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
