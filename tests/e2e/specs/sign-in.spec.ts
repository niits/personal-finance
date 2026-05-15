import { test, expect } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Sign-in page — layout", () => {
  test("renders GitHub SSO button and email form", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.getByRole("button", { name: /GitHub/i })).toBeVisible();
    await expect(page.locator("input[type='email']")).toBeVisible();
    await expect(page.locator("input[type='password']")).toBeVisible();
    // Scope to main to avoid matching Navbar's "Đăng nhập" link
    await expect(page.locator("main").getByRole("button", { name: "Đăng nhập" })).toBeVisible();
  });

  test("toggles to sign-up mode and back", async ({ page }) => {
    await page.goto("/sign-in");
    await page.locator("main").getByRole("button", { name: "Đăng ký" }).click();
    await expect(page.locator("input[type='text']")).toBeVisible();
    await expect(page.locator("main").getByRole("button", { name: "Tạo tài khoản" })).toBeVisible();
    await page.locator("main").getByRole("button", { name: "Đăng nhập" }).click();
    await expect(page.locator("input[type='text']")).not.toBeVisible();
  });
});

test.describe("Sign-in page — email/password auth", () => {
  test("signs in with valid credentials and redirects to dashboard", async ({ page }) => {
    await page.goto("/sign-in");
    await page.locator("input[type='email']").fill("e2e@test.local");
    await page.locator("input[type='password']").fill("e2e-test-password-123");
    await page.locator("main").getByRole("button", { name: "Đăng nhập" }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 8000 });
  });

  test("shows error on wrong password", async ({ page }) => {
    await page.goto("/sign-in");
    await page.locator("input[type='email']").fill("e2e@test.local");
    await page.locator("input[type='password']").fill("wrong-password");
    await page.locator("main").getByRole("button", { name: "Đăng nhập" }).click();
    await expect(page.locator("p").filter({ hasText: /thất bại|sai|Invalid|incorrect/i })).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("unauthenticated visit to /dashboard redirects to /sign-in", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/sign-in/, { timeout: 5000 });
  });
});
