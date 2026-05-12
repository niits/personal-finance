import { defineConfig, devices } from "@playwright/test";
import { readFileSync } from "fs";
import { resolve } from "path";

const firebase = JSON.parse(readFileSync(resolve(__dirname, "firebase.json"), "utf8"));
const firestorePort: number = firebase.emulators.firestore.port;
const authPort: number = firebase.emulators.auth.port;

export default defineConfig({
  testDir: "tests/e2e",
  outputDir: "test-results/e2e",
  fullyParallel: false, // share the same Firebase emulator user — run serially
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["junit", { outputFile: "test-results/e2e.xml" }], ["list"]] : "list",
  timeout: 30_000,

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Start Next.js dev server with emulator env vars before running tests.
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-personal-finance",
      NEXT_PUBLIC_FIREBASE_API_KEY: "fake-api-key-for-emulator",
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "demo-personal-finance.firebaseapp.com",
      NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR: `http://localhost:${authPort}`,
      NEXT_PUBLIC_FIRESTORE_EMULATOR: `localhost:${firestorePort}`,
    },
  },
});
