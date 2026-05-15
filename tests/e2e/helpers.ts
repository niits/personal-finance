import { request } from "@playwright/test";

const BASE_URL = "http://localhost:8787";
const TEST_SECRET = process.env.PLAYWRIGHT_TEST_SECRET ?? "";

export const TEST_EMAIL = "e2e@test.local";

/** Wipes and re-seeds the test user's app data. Call in `beforeAll` of each spec file. */
export async function resetTestData(seed?: "minimal" | "categories" | "budget" | "full") {
  const ctx = await request.newContext({ baseURL: BASE_URL });
  const res = await ctx.post("/api/test/reset", {
    headers: { "X-Test-Secret": TEST_SECRET },
    data: { email: TEST_EMAIL, seed },
  });
  if (!res.ok()) throw new Error(`resetTestData failed: ${await res.text()}`);
  await ctx.dispose();
}
