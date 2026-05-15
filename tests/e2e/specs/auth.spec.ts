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
    // Should redirect away from /dashboard — either to / or /sign-in
    await expect(page).not.toHaveURL(/\/dashboard/);
  });
});

test.describe("Auth — /api/test/* protection", () => {
  test("POST /api/test/reset returns 403 without X-Test-Secret header", async ({ request }) => {
    const res = await request.post("/api/test/reset");
    expect(res.status()).toBe(403);
  });

  test("POST /api/test/reset returns 403 with wrong secret", async ({ request }) => {
    const res = await request.post("/api/test/reset", {
      headers: { "X-Test-Secret": "wrong-secret" },
    });
    expect(res.status()).toBe(403);
  });
});
