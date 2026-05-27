import { test, expect } from "@playwright/test";

test.describe("Navigation — tab bar", () => {
  test("shows 5 tabs: Tổng quan, Thống kê, Nợ, Ngân sách, Tài khoản", async ({ page }) => {
    await page.goto("/");
    const nav = page.locator("nav").last(); // bottom tab bar
    await expect(nav.getByText("Tổng quan")).toBeVisible();
    await expect(nav.getByText("Thống kê")).toBeVisible();
    await expect(nav.getByText("Nợ")).toBeVisible();
    await expect(nav.getByText("Ngân sách")).toBeVisible();
    await expect(nav.getByText("Tài khoản")).toBeVisible();
    await expect(nav.getByText("Danh mục")).not.toBeVisible();
  });

  test("Nợ tab navigates to /debts", async ({ page }) => {
    await page.goto("/");
    await page.locator("nav").last().getByText("Nợ").click();
    await expect(page).toHaveURL(/\/debts$/);
  });
});

test.describe("Navigation — categories route move", () => {
  test("/categories redirects to /account/categories", async ({ page }) => {
    await page.goto("/categories");
    await expect(page).toHaveURL(/\/account\/categories$/);
  });

  test("/account/categories renders categories page", async ({ page }) => {
    await page.goto("/account/categories");
    await expect(page.getByRole("button", { name: "+ Thêm" })).toBeVisible();
  });
});

test.describe("Navigation — account settings hub", () => {
  test("account page shows Danh mục row", async ({ page }) => {
    await page.goto("/account");
    // Use role=link to avoid strict-mode violation — "Danh mục" text appears
    // in the link label, its subtitle, and other page copy.
    await expect(page.getByRole("link", { name: /Danh mục/ }).first()).toBeVisible();
  });

  test("tapping Danh mục row navigates to /account/categories", async ({ page }) => {
    await page.goto("/account");
    await page.getByRole("link", { name: /Danh mục/ }).first().click();
    await expect(page).toHaveURL(/\/account\/categories$/);
  });
});
