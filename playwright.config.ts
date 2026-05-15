import { defineConfig, devices } from "@playwright/test";
import { STORAGE_STATE } from "./tests/e2e/global-setup";

export default defineConfig({
  testDir: "./tests/e2e/specs",
  // Single worker — D1 is a single SQLite file, parallel writes cause conflicts
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  // Kill the whole run if it exceeds 10 min (CI) / 5 min (local)
  globalTimeout: process.env.CI ? 10 * 60_000 : 5 * 60_000,
  // Per-test timeout: 15 s local, 20 s CI
  timeout: process.env.CI ? 20_000 : 15_000,
  reporter: process.env.CI
    ? [["github"], ["html"], ["junit", { outputFile: "test-results/e2e.xml" }]]
    : [["line"]],

  use: {
    baseURL: "http://localhost:8787",
    trace: "on-first-retry",
    // iPhone 14 Pro — primary target device per DESIGN.md
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    storageState: STORAGE_STATE,
    // Per-action timeout (click, fill, expect…)
    actionTimeout: 8_000,
    navigationTimeout: 10_000,
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],

  // Reuse existing server locally (run `npm run dev:cf` separately).
  // In CI, build first then start preview server.
  webServer: {
    command: "npx wrangler dev .open-next/worker.js --port 8787 --local",
    url: "http://localhost:8787",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },

  globalSetup: "./tests/e2e/global-setup.ts",
});
