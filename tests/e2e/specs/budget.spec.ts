import { test, expect } from "@playwright/test";
import { resetTestData } from "../helpers";

// Read-only: reset to "full" so this is independent of file execution order
test.describe("Budget — existing budget view", () => {
  test.beforeAll(async () => {
    await resetTestData("full");
  });

  test("shows monthly budget amount", async ({ page }) => {
    await page.goto("/dashboard/budget");
    await expect(page.getByText("5.000.000₫").first()).toBeVisible();
  });

  test("shows adjust budget button", async ({ page }) => {
    await page.goto("/dashboard/budget");
    await expect(page.getByRole("button", { name: /Điều chỉnh ngân sách/ })).toBeVisible();
  });
});

// Mutating: each test needs a "categories" seed (no budget yet so create form shows)
test.describe("Budget — monthly budget creation", () => {
  test.beforeEach(async () => {
    await resetTestData("categories");
  });

  test("shows create form when no monthly budget exists", async ({ page }) => {
    await page.goto("/dashboard/budget");
    await expect(page.getByText("Chưa đặt ngân sách")).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("textbox")).toBeVisible();
  });

  test("creates monthly budget with a preset amount", async ({ page }) => {
    await page.goto("/dashboard/budget");
    await page.getByRole("button", { name: "5tr" }).click();
    await page.getByRole("button", { name: "Xác nhận ngân sách" }).click();
    await expect(page.getByText("5.000.000₫").first()).toBeVisible({ timeout: 5000 });
  });
});
