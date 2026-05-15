import { request } from "@playwright/test";

const BASE_URL = "http://localhost:8787";
const TEST_SECRET = process.env.PLAYWRIGHT_TEST_SECRET ?? "";

export default async function globalSetup() {
  if (!TEST_SECRET) {
    throw new Error(
      "PLAYWRIGHT_TEST_SECRET env var is required. " +
      "Add it to .dev.vars and set it in your shell before running Playwright.",
    );
  }

  const ctx = await request.newContext({ baseURL: BASE_URL });

  // Seed the test user and wipe any leftover data from previous runs
  const res = await ctx.post("/api/test/reset", {
    headers: { "X-Test-Secret": TEST_SECRET },
  });

  if (!res.ok()) {
    const body = await res.text();
    throw new Error(`E2E global setup failed (${res.status()}): ${body}`);
  }

  await ctx.dispose();
}
