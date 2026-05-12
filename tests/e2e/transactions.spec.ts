import { test, expect } from "./fixtures";

// The fixture lands us on /dashboard as a signed-in user with seeded categories.
// Tests need a monthly budget to exist before they can add an expense — create it
// via the budget page first.

async function createBudgetForCurrentMonth(page: import("@playwright/test").Page) {
  await page.goto("/dashboard/budget");
  // Check if a budget already exists for the current month.
  const hasAmount = await page.locator("text=/₫/").count();
  if (hasAmount > 0) return;

  // Fill in the budget amount input.
  const input = page.locator("input[type='number'], input[inputmode='numeric']").first();
  if (await input.isVisible()) {
    await input.fill("10000000");
    await page.locator("button", { hasText: /Lưu|Tạo|Cập nhật/ }).first().click();
    await page.waitForTimeout(500);
  }
}

test.describe("Transaction form — add income", () => {
  test("can open and close the transaction form", async ({ page }) => {
    await createBudgetForCurrentMonth(page);
    await page.goto("/dashboard");

    // Wait for the + button (shown when a budget exists).
    const addBtn = page.locator("button", { hasText: "+" });
    await expect(addBtn).toBeVisible({ timeout: 10_000 });
    await addBtn.click();

    // Form should slide up with the "Lưu giao dịch" button.
    await expect(page.locator("button", { hasText: "Lưu giao dịch" })).toBeVisible();

    // Drag or click outside to close — swipe the sheet down.
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  });

  test("adds an income transaction", async ({ page }) => {
    await createBudgetForCurrentMonth(page);
    await page.goto("/dashboard");

    const addBtn = page.locator("button", { hasText: "+" });
    await expect(addBtn).toBeVisible({ timeout: 10_000 });
    await addBtn.click();

    // Switch to Thu nhập (income).
    await page.locator("button", { hasText: "Thu nhập" }).click();

    // Fill amount.
    await page.locator("input[placeholder='0']").fill("15000000");

    // Pick the first available category leaf (Thu nhập > Lương).
    const thuNhapGroup = page.locator("button", { hasText: "Thu nhập" }).last();
    if (await thuNhapGroup.isVisible()) await thuNhapGroup.click();
    const luongBtn = page.locator("button", { hasText: "Lương" }).first();
    if (await luongBtn.isVisible()) await luongBtn.click();

    // Add a note.
    await page.locator("input[placeholder='Ghi chú (tuỳ chọn)']").fill("Lương tháng 5");

    // Save.
    await page.locator("button", { hasText: "Lưu giao dịch" }).click();

    // Form should close and we should still be on dashboard.
    await expect(page).toHaveURL(/\/dashboard/);
    await page.waitForTimeout(500);
  });
});

test.describe("Transaction form — add expense", () => {
  test("adds an expense transaction", async ({ page }) => {
    await createBudgetForCurrentMonth(page);
    await page.goto("/dashboard");

    const addBtn = page.locator("button", { hasText: "+" });
    await expect(addBtn).toBeVisible({ timeout: 10_000 });
    await addBtn.click();

    // Default should be Chi tiêu (expense).
    await expect(page.locator("button", { hasText: "Chi tiêu" })).toBeVisible();

    // Fill amount.
    await page.locator("input[placeholder='0']").fill("50000");

    // Select expense category (Ăn uống → Ăn ngoài).
    const anUong = page.locator("button", { hasText: "Ăn uống" }).first();
    if (await anUong.isVisible()) await anUong.click();
    const anNgoai = page.locator("button", { hasText: "Ăn ngoài" }).first();
    if (await anNgoai.isVisible()) await anNgoai.click();

    // Save.
    await page.locator("button", { hasText: "Lưu giao dịch" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await page.waitForTimeout(500);
  });

  test("shows validation error when no category is selected", async ({ page }) => {
    await createBudgetForCurrentMonth(page);
    await page.goto("/dashboard");

    const addBtn = page.locator("button", { hasText: "+" });
    await expect(addBtn).toBeVisible({ timeout: 10_000 });
    await addBtn.click();

    // Fill amount but don't pick a category.
    await page.locator("input[placeholder='0']").fill("50000");
    await page.locator("button", { hasText: "Lưu giao dịch" }).click();

    // An error message should appear.
    const error = page.locator("text=/Vui lòng|không hợp lệ|bắt buộc|lỗi/i");
    await expect(error).toBeVisible({ timeout: 5_000 });
  });
});
