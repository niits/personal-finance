import { test, expect } from "@playwright/test";

// These tests verify unauthenticated behavior.
// Override the global storageState so no session cookie is sent.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Auth — API protection", () => {
  test("GET /api/transactions returns 401 without session", async ({ request }) => {
    const res = await request.get("/api/transactions");
    expect(res.status()).toBe(401);
  });

  test("root redirects to sign-in when not authenticated", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/sign-in/, { timeout: 5000 });
  });

  test("budget redirects to sign-in when not authenticated", async ({ page }) => {
    await page.goto("/budget");
    await expect(page).toHaveURL(/\/sign-in/, { timeout: 5000 });
  });

  for (const route of ["/cards", "/debts"]) {
    test(`${route} redirects to sign-in when not authenticated`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(new RegExp(`/sign-in\\?from=${encodeURIComponent(route)}`), { timeout: 5000 });
    });
  }

  test("/api/test/reset does not exist in production build", async ({ request }) => {
    // Route is deleted before every build (E2E and production alike)
    const res = await request.post("/api/test/reset");
    expect(res.status()).toBe(404);
  });
});
