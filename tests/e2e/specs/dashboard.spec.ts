import { test, expect } from "@playwright/test";
import { resetTestData } from "../helpers";

test.beforeAll(async () => {
  // Seed categories + budget + 1 expense + 1 income transaction
  await resetTestData("full");
});

test.describe("Dashboard — transaction list", () => {
  test("shows existing transaction after seed", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText("Bún bò buổi trưa")).toBeVisible();
  });

  test("shows budget bar when monthly budget exists", async ({ page }) => {
    await page.goto("/dashboard");
    // Budget bar is rendered inside the header when monthly_budget is non-null
    await expect(page.getByText(/Ngân sách/)).toBeVisible();
  });

  test("shows income/savings panel when income exists", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText("Thu nhập")).toBeVisible();
    await expect(page.getByText("Tiết kiệm")).toBeVisible();
  });
});

test.describe("Dashboard — add transaction", () => {
  test("opens form via FAB and creates an expense", async ({ page }) => {
    await page.goto("/dashboard");

    // FAB is the + button
    await page.locator("button", { hasText: "+" }).click();

    // Form sheet appears
    const sheet = page.locator("text=Chi tiêu").first();
    await expect(sheet).toBeVisible();

    // Enter amount
    const amountInput = page.locator("input[inputmode='numeric']");
    await amountInput.fill("120000");

    // Category list should show — click the first leaf category (Ăn uống is level 1 with no children)
    await page.getByText("Ăn uống").click();

    // Submit
    await page.locator("button", { hasText: "Lưu giao dịch" }).click();

    // Form closes and new transaction appears
    await expect(page.getByText("Lưu giao dịch")).not.toBeVisible();
  });

  test("shows validation error when amount is missing", async ({ page }) => {
    await page.goto("/dashboard");
    await page.locator("button", { hasText: "+" }).click();

    // Try to save without filling amount
    await page.locator("button", { hasText: "Lưu giao dịch" }).click();
    await expect(page.getByText("Nhập số tiền hợp lệ")).toBeVisible();
  });

  test("shows validation error when category is not selected", async ({ page }) => {
    await page.goto("/dashboard");
    await page.locator("button", { hasText: "+" }).click();

    const amountInput = page.locator("input[inputmode='numeric']");
    await amountInput.fill("50000");

    await page.locator("button", { hasText: "Lưu giao dịch" }).click();
    await expect(page.getByText("Chọn danh mục")).toBeVisible();
  });
});

test.describe("Dashboard — edit and delete", () => {
  test("opens action sheet on transaction tap", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByText("Bún bò buổi trưa").click();

    // Action sheet shows edit + delete buttons
    await expect(page.getByRole("button", { name: "Sửa" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Xoá" })).toBeVisible();
  });

  test("edit flow pre-fills form with existing transaction data", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByText("Bún bò buổi trưa").click();
    await page.getByRole("button", { name: "Sửa" }).click();

    // "Sửa giao dịch" heading appears in edit mode
    await expect(page.getByText("Sửa giao dịch")).toBeVisible();
    // Amount is pre-filled
    const amountInput = page.locator("input[inputmode='numeric']");
    await expect(amountInput).toHaveValue("85.000");
  });

  test("delete removes transaction from list", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByText("Bún bò buổi trưa").click();
    await page.getByRole("button", { name: "Xoá" }).click();

    // Transaction disappears from list
    await expect(page.getByText("Bún bò buổi trưa")).not.toBeVisible();
  });
});

test.describe("Dashboard — month navigation", () => {
  test("previous month button navigates to prior month", async ({ page }) => {
    await page.goto("/dashboard");

    // Get current month label (e.g. "Tháng 5/2026")
    const currentLabel = await page.locator("span").filter({ hasText: /Tháng \d+\/\d+/ }).textContent();
    expect(currentLabel).toBeTruthy();

    // Click previous month chevron (‹)
    await page.locator("button", { hasText: "‹" }).click();

    // Label changes
    const newLabel = await page.locator("span").filter({ hasText: /Tháng \d+\/\d+/ }).textContent();
    expect(newLabel).not.toBe(currentLabel);
  });
});
