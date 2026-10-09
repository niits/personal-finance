import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/storybook",
  fullyParallel: true,
  expect: { timeout: 15000 },
  use: { baseURL: "http://127.0.0.1:6006", trace: "retain-on-failure" },
  projects: [
    { name: "chromium-phone", use: { browserName: "chromium", viewport: { width: 375, height: 667 } } },
    { name: "webkit-phone", use: { browserName: "webkit", viewport: { width: 375, height: 667 } } },
    { name: "chromium-desktop", use: { browserName: "chromium", viewport: { width: 1280, height: 900 } } },
  ],
  webServer: {
    command: "npm run storybook -- --ci --no-open --disable-telemetry",
    url: "http://127.0.0.1:6006",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
