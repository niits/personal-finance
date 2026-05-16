import { test, expect } from "@playwright/test";
import { STORAGE_STATE, TEST_EMAIL } from "../global-setup";

// Read-only — share globalSetup session
test.describe("Account page — profile", () => {
  test("shows user email", async ({ page }) => {
    await page.goto("/account");
    await expect(page.getByText(TEST_EMAIL)).toBeVisible();
  });

  test("shows Tài khoản heading", async ({ page }) => {
    await page.goto("/account");
    await expect(page.getByRole("heading", { name: "Tài khoản" })).toBeVisible();
  });
});

test.describe("Account page — linked accounts", () => {
  test("shows GitHub row", async ({ page }) => {
    await page.goto("/account");
    await expect(page.getByText("GitHub")).toBeVisible();
  });

  test("shows reset password action for credential accounts", async ({ page }) => {
    await page.goto("/account");
    await expect(page.getByRole("button", { name: "Đặt lại mật khẩu" })).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByRole("button", { name: "Đặt mật khẩu" })).toHaveCount(0);
  });

  test("can trigger the reset password flow from account page", async ({ page }) => {
    await page.goto("/account");
    await page.getByRole("button", { name: "Đặt lại mật khẩu" }).click();
    await expect(
      page.getByText(`Nếu địa chỉ email ${TEST_EMAIL} tồn tại trong hệ thống, email hướng dẫn đặt lại mật khẩu đã được gửi.`),
    ).toBeVisible({ timeout: 5000 });
  });
});


test.describe("Account page — data export", () => {
  test("JSON export triggers download with correct filename", async ({ page }) => {
    await page.goto("/account");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Tải JSON" }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/finance-export.*\.json/);
  });

  test("CSV export triggers download with correct filename", async ({ page }) => {
    await page.goto("/account");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Tải CSV" }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/transactions.*\.csv/);
  });
});

// Sign-out invalidates the server session → must use an isolated browser context
// so the shared storageState.json cookie is not affected for other tests.
test.describe("Account page — sign out", () => {
  test("sign out redirects to sign-in", async ({ browser }) => {
    // Create a fresh context from storageState but do NOT share it with other tests
    const ctx = await browser.newContext({ storageState: STORAGE_STATE });
    const page = await ctx.newPage();
    await page.goto("/account");
    await page.locator("main").getByRole("button", { name: "Đăng xuất" }).click();
    await expect(page).toHaveURL(/\/sign-in$/, { timeout: 5000 });
    await ctx.close();
  });
});
