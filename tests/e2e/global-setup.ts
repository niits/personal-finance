import { request } from "@playwright/test";
import path from "path";
import { getUserId, wipeUserData, seedUserData } from "./db-reset";

const BASE_URL = "http://localhost:8787";
export const TEST_EMAIL = "e2e@test.local";
const TEST_PASSWORD = "e2e-test-password-123";

export const STORAGE_STATE = path.join(__dirname, "storageState.json");

export default async function globalSetup() {
  const ctx = await request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { Origin: BASE_URL },
  });

  // Try sign-in first; if the account doesn't exist yet, sign up then sign in.
  // Auth goes through the real app — this is intentional (tests the auth code path).
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

    signInRes = await ctx.post("/api/auth/sign-in/email", {
      data: { email: TEST_EMAIL, password: TEST_PASSWORD },
    });
  }

  if (!signInRes.ok()) {
    const body = await signInRes.text();
    throw new Error(`E2E sign-in failed (${signInRes.status()}): ${body}`);
  }

  // Seed "full" once — read-only tests share this state without resetting.
  const userId = getUserId(TEST_EMAIL);
  wipeUserData(userId);
  seedUserData(userId, "full");

  await ctx.storageState({ path: STORAGE_STATE });
  await ctx.dispose();
}
