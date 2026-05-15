import { test, expect } from "@playwright/test";
import { resetTestData } from "../helpers";

test.beforeAll(async () => {
  await resetTestData("minimal");
});

test.describe("Account page — profile", () => {
  test("shows user email", async ({ page }) => {
    await page.goto("/dashboard/account");
    await expect(page.getByText("e2e@test.local")).toBeVisible();
  });

  test("shows 'Tài khoản' heading", async ({ page }) => {
    await page.goto("/dashboard/account");
    await expect(page.getByRole("heading", { name: "Tài khoản" })).toBeVisible();
  });
});

test.describe("Account page — linked accounts", () => {
  test("shows GitHub row in auth methods section", async ({ page }) => {
    await page.goto("/dashboard/account");
    await expect(page.getByText("GitHub")).toBeVisible();
  });

  test("shows password row with set/change option", async ({ page }) => {
    await page.goto("/dashboard/account");
    // Either "Đặt mật khẩu" or "Mật khẩu" heading is visible
    await expect(
      page.getByText("Đặt mật khẩu").or(page.getByText("Mật khẩu"))
    ).toBeVisible();
  });
});

test.describe("Account page — change password", () => {
  test("set password form appears and saves", async ({ page }) => {
    await page.goto("/dashboard/account");

    // Wait for accounts to load (async fetch)
    await page.waitForTimeout(500);

    const btn = page.getByRole("button", { name: /Đặt mật khẩu|Đổi mật khẩu/ });
    await expect(btn).toBeVisible({ timeout: 5000 });
    await btn.click();

    // New password input appears
    const pwInput = page.locator("input[type='password']").last();
    await pwInput.fill("new-test-password-456");
    await page.getByRole("button", { name: "Lưu" }).click();

    // Success message appears
    await expect(page.getByText("Đã lưu thành công")).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Account page — data export", () => {
  test("JSON export triggers download", async ({ page }) => {
    await page.goto("/dashboard/account");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Tải JSON" }).click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/finance-export.*\.json/);
  });

  test("CSV export triggers download", async ({ page }) => {
    await page.goto("/dashboard/account");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Tải CSV" }).click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/transactions.*\.csv/);
  });
});

test.describe("Account page — sign out", () => {
  test("sign out redirects to home", async ({ page }) => {
    await page.goto("/dashboard/account");
    await page.getByRole("button", { name: "Đăng xuất" }).click();
    await expect(page).toHaveURL(/\/(sign-in|$)/, { timeout: 5000 });
  });
});
