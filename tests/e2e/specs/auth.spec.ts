import { test, expect } from "@playwright/test";

// These tests verify unauthenticated behavior.
// Override the global storageState so no session cookie is sent.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Auth — API protection", () => {
  test("GET /api/transactions returns 401 without session", async ({ request }) => {
    const res = await request.get("/api/transactions");
    expect(res.status()).toBe(401);
  });

  test("home page is accessible without auth", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/localhost:8787/);
  });

  test("dashboard redirects to sign-in when not authenticated", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).not.toHaveURL(/\/dashboard/);
  });

  test("/api/test/reset does not exist in production build", async ({ request }) => {
    // Route is deleted before every build (E2E and production alike)
    const res = await request.post("/api/test/reset");
    expect(res.status()).toBe(404);
  });
});
