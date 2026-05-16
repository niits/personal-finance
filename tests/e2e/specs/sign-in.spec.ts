import { test, expect } from "@playwright/test";
import { STORAGE_STATE } from "../global-setup";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Sign-in page — layout", () => {
  test("renders GitHub SSO button and disabled coming-soon auth methods", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.getByRole("button", { name: /GitHub/i })).toBeVisible();
    await expect(page.getByText("Google đang tạm dừng")).toBeVisible();
    await expect(page.getByText("Email & mật khẩu đang tạm dừng")).toBeVisible();
    await expect(page.getByText("Sắp có lại")).toHaveCount(2);
    await expect(page.locator("input[type='email']")).toHaveCount(0);
    await expect(page.locator("input[type='password']")).toHaveCount(0);
  });
});

test.describe("Sign-in page — route protection", () => {
  test("unauthenticated visit to / redirects to /sign-in", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/sign-in/, { timeout: 5000 });
  });

  test("forgot-password page shows coming-soon message", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.getByText("Tính năng khôi phục mật khẩu đang được tạm dừng.")).toBeVisible();
  });
});

test.describe("Sign-in page — authenticated redirects", () => {
  test.use({ storageState: STORAGE_STATE });

  test("authenticated visit to /sign-in redirects to home", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page).toHaveURL(/\/$/, { timeout: 5000 });
  });

  test("authenticated visit to /forgot-password redirects to home", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page).toHaveURL(/\/$/, { timeout: 5000 });
  });
});
