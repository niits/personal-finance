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

  test("shows the four canonical destinations and marks Account current", async ({ page }) => {
    await page.goto("/account");
    const navigation = page.getByRole("navigation", { name: "Điều hướng chính" });
    await expect(navigation.getByRole("link")).toHaveCount(4);
    await expect(navigation.getByRole("link", { name: "Tổng quan" })).toBeVisible();
    await expect(navigation.getByRole("link", { name: "Thống kê" })).toBeVisible();
    await expect(navigation.getByRole("link", { name: "Tài chính" })).toBeVisible();
    await expect(navigation.getByRole("link", { name: "Tài khoản" })).toHaveAttribute("aria-current", "page");
  });
});

test.describe("Account page — linked accounts", () => {
  test("shows GitHub row", async ({ page }) => {
    await page.goto("/account");
    await expect(page.getByText("GitHub")).toBeVisible();
  });

  test("shows password features as coming soon", async ({ page }) => {
    await page.goto("/account");
    await expect(page.getByText("Email và mật khẩu đang được tạm dừng.")).toBeVisible();
    await expect(page.getByText("Sắp có lại")).toHaveCount(2);
  });

  test("shows Google auth as temporarily disabled", async ({ page }) => {
    await page.goto("/account");
    await expect(page.getByText("Google")).toBeVisible();
    await expect(page.getByText("Tạm dừng", { exact: true })).toBeVisible();
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
  test("requires named confirmation before signing out", async ({ browser }) => {
    // Create a fresh context from storageState but do NOT share it with other tests
    const ctx = await browser.newContext({ storageState: STORAGE_STATE });
    const page = await ctx.newPage();
    await page.goto("/account");
    await page.locator("main").getByRole("button", { name: "Đăng xuất" }).click();
    const dialog = page.getByRole("dialog", { name: /Đăng xuất khỏi tài khoản/ });
    await expect(dialog).toContainText(TEST_EMAIL);
    await dialog.getByRole("button", { name: "Đăng xuất" }).click();
    await expect(page).toHaveURL(/\/sign-in$/, { timeout: 5000 });
    await ctx.close();
  });
});
