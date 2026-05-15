import { test, expect } from "@playwright/test";
import { resetTestData } from "../helpers";

// Read-only: seed "categories" and assert list renders
test.describe("Categories — list", () => {
  test.beforeAll(async () => {
    await resetTestData("categories");
  });

  test("shows seeded categories", async ({ page }) => {
    await page.goto("/dashboard/categories");
    await expect(page.getByText("Ăn uống").first()).toBeVisible();
    await expect(page.getByText("Lương").first()).toBeVisible();
  });
});

// Separate state for empty-state check
test.describe("Categories — empty state", () => {
  test.beforeAll(async () => {
    await resetTestData("minimal");
  });

  test("shows empty state when no categories exist", async ({ page }) => {
    await page.goto("/dashboard/categories");
    await expect(page.getByRole("button", { name: "+ Thêm" })).toBeVisible();
    await expect(page.getByText("Ăn uống")).not.toBeVisible();
  });
});

// Mutating: each test gets a clean "categories" seed
test.describe("Categories — create", () => {
  test.beforeEach(async () => {
    await resetTestData("categories");
  });

  test("creates a new expense category", async ({ page }) => {
    await page.goto("/dashboard/categories");
    await page.getByRole("button", { name: "+ Thêm" }).click();

    await page.getByRole("textbox", { name: "Tên danh mục" }).fill("Sức khoẻ");
    await page.getByRole("button", { name: "Lưu" }).click();

    await expect(page.getByText("Sức khoẻ").first()).toBeVisible({ timeout: 5000 });
  });
});
