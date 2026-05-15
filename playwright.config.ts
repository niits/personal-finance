import { defineConfig, devices } from "@playwright/test";
import { STORAGE_STATE } from "./tests/e2e/global-setup";

export default defineConfig({
  testDir: "./tests/e2e/specs",
  // Single worker — D1 is a single SQLite file, parallel writes cause conflicts
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "html",

  use: {
    baseURL: "http://localhost:8787",
    trace: "on-first-retry",
    // iPhone 14 Pro — primary target device per DESIGN.md
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    storageState: STORAGE_STATE,
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],

  // Reuse existing server locally (run `npm run dev:cf` separately).
  // In CI, build first then start preview server.
  webServer: {
    command: "npm run preview:cf",
    url: "http://localhost:8787",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },

  globalSetup: "./tests/e2e/global-setup.ts",
});
