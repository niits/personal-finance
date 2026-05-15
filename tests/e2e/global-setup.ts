import { request } from "@playwright/test";
import path from "path";

const BASE_URL = "http://localhost:8787";
const TEST_SECRET = process.env.PLAYWRIGHT_TEST_SECRET ?? "";
const TEST_EMAIL = "e2e@test.local";
const TEST_PASSWORD = "e2e-test-password-123";

export const STORAGE_STATE = path.join(__dirname, "storageState.json");

export default async function globalSetup() {
  if (!TEST_SECRET) {
    throw new Error(
      "PLAYWRIGHT_TEST_SECRET env var is required. " +
        "Add it to .dev.vars and set it in your shell before running Playwright.",
    );
  }

  const ctx = await request.newContext({ baseURL: BASE_URL });

  // Try sign-in first; if the account doesn't exist yet, sign up then sign in
  let signInRes = await ctx.post("/api/auth/sign-in/email", {
    data: { email: TEST_EMAIL, password: TEST_PASSWORD },
  });

  if (!signInRes.ok()) {
    const signUpRes = await ctx.post("/api/auth/sign-up/email", {
      data: { email: TEST_EMAIL, password: TEST_PASSWORD, name: "E2E Test User" },
    });
    if (!signUpRes.ok()) {
      const body = await signUpRes.text();
      throw new Error(`E2E sign-up failed (${signUpRes.status()}): ${body}`);
    }

    // Sign in after sign-up to get the session cookie
    signInRes = await ctx.post("/api/auth/sign-in/email", {
      data: { email: TEST_EMAIL, password: TEST_PASSWORD },
    });
  }

  if (!signInRes.ok()) {
    const body = await signInRes.text();
    throw new Error(`E2E sign-in failed (${signInRes.status()}): ${body}`);
  }

  // Wipe any leftover data from previous runs (keep the account, wipe app data)
  const resetRes = await ctx.post("/api/test/reset", {
    headers: { "X-Test-Secret": TEST_SECRET },
    data: { email: TEST_EMAIL, seed: "minimal" },
  });
  if (!resetRes.ok()) {
    const body = await resetRes.text();
    throw new Error(`E2E data reset failed (${resetRes.status()}): ${body}`);
  }

  // Save the authenticated browser state so all tests start pre-logged-in
  await ctx.storageState({ path: STORAGE_STATE });
  await ctx.dispose();
}
