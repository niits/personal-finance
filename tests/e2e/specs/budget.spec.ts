import { test, expect } from "@playwright/test";
import { resetTestData } from "../helpers";

test.beforeAll(async () => {
  // Need categories to exist but no budget — tests create it
  await resetTestData("categories");
});

test.describe("Budget — monthly budget creation", () => {
  test("shows setup prompt when no monthly budget exists", async ({ page }) => {
    await page.goto("/dashboard/budget");
    // Page should show the create form
    await expect(page.getByPlaceholder(/triệu|amount|số tiền/i).or(
      page.locator("input[type='text']").first()
    )).toBeVisible({ timeout: 5000 });
  });

  test("creates monthly budget with a valid amount", async ({ page }) => {
    await page.goto("/dashboard/budget");

    const amountInput = page.locator("input").first();
    await amountInput.fill("5.000.000");

    await page.getByRole("button", { name: /Đặt ngân sách|Tạo|Lưu/i }).click();

    // After creation, budget info appears
    await expect(page.getByText(/5\.000\.000/)).toBeVisible();
  });
});

test.describe("Budget — adjustment", () => {
  test("can add a positive adjustment", async ({ page }) => {
    await page.goto("/dashboard/budget");

    // Adjustment button
    const adjBtn = page.getByRole("button", { name: /Điều chỉnh|Adjust/i });
    await adjBtn.click();

    // Fill adjustment amount
    const adjInput = page.locator("input").filter({ hasText: "" }).first();
    await adjInput.fill("500.000");

    await page.getByRole("button", { name: /Lưu|Xác nhận|OK/i }).last().click();

    // No error visible
    await expect(page.locator("text=Lỗi")).not.toBeVisible();
  });
});

test.describe("Budget — custom budgets", () => {
  test("creates a custom budget", async ({ page }) => {
    await page.goto("/dashboard/budget");

    // Find the custom budget create form — look for name input
    const nameInput = page.locator("input[placeholder*='tên']").or(
      page.locator("input[placeholder*='Tên']")
    ).first();
    await nameInput.fill("Quỹ du lịch");

    const amountInput = page.locator("input").nth(1);
    await amountInput.fill("2.000.000");

    await page.getByRole("button", { name: /Tạo quỹ|Thêm|Lưu/i }).click();

    await expect(page.getByText("Quỹ du lịch")).toBeVisible();
  });

  test("can toggle a custom budget off", async ({ page }) => {
    await page.goto("/dashboard/budget");

    // The toggle button next to "Quỹ du lịch"
    const row = page.locator("text=Quỹ du lịch").locator("..");
    await row.getByRole("button").filter({ hasText: /Tắt|Dừng|off/i }).click();

    // Status changes
    await expect(page.getByText(/đã tắt|Không hoạt động/i)).toBeVisible();
  });
});
