import { request } from "@playwright/test";

const BASE_URL = "http://localhost:8787";
const TEST_SECRET = process.env.PLAYWRIGHT_TEST_SECRET ?? "";

/** Call before each spec file to wipe and re-seed the test user's data. */
export async function resetTestData(seed?: "minimal" | "categories" | "budget" | "full") {
  const ctx = await request.newContext({ baseURL: BASE_URL });
  const res = await ctx.post("/api/test/reset", {
    headers: { "X-Test-Secret": TEST_SECRET },
    data: { seed },
  });
  if (!res.ok()) throw new Error(`resetTestData failed: ${await res.text()}`);
  await ctx.dispose();
}
