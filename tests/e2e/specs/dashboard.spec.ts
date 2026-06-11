import { test, expect } from "@playwright/test";
import { resetTestData } from "../helpers";

// Read-only tests — reset to "full" so they're independent of file execution order
test.describe("Dashboard — transaction list", () => {
  test.beforeAll(async () => {
    await resetTestData("full");
  });

  test("shows existing transaction after seed", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Bún bò buổi trưa")).toBeVisible();
  });

  test("shows budget bar when monthly budget exists", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/Ngân sách/)).toBeVisible();
  });

  test("shows income/savings panel when income exists", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Thu nhập")).toBeVisible();
    await expect(page.getByText("Tiết kiệm")).toBeVisible();
  });

  test("previous month button navigates to prior month", async ({ page }) => {
    await page.goto("/");
    const monthLabel = page.getByText(/Tháng \d+\/\d+/).first();
    const currentLabel = await monthLabel.textContent();
    expect(currentLabel).toBeTruthy();
    await page.getByRole("button", { name: "‹" }).click();
    const newLabel = await monthLabel.textContent();
    expect(newLabel).not.toBe(currentLabel);
  });
});

// Read-only — tap transaction to open action sheet, then cancel
test.describe("Dashboard — action sheet", () => {
  test.beforeAll(async () => {
    await resetTestData("full");
  });

  test("opens action sheet on transaction tap", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Bún bò buổi trưa").first().click();
    await expect(page.getByRole("button", { name: "Sửa" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Xoá" })).toBeVisible();
  });

  test("edit flow pre-fills form with existing transaction data", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Bún bò buổi trưa").first().click();
    await page.getByRole("button", { name: "Sửa" }).click();
    await expect(page.getByText("Sửa giao dịch")).toBeVisible();
    await expect(page.locator("input[inputmode='numeric']")).toHaveValue("85.000");
  });
});

// Mutating tests — each resets to "full" before running
test.describe("Dashboard — add transaction", () => {
  test.beforeEach(async () => {
    await resetTestData("full");
  });

  test("opens form via FAB and creates an expense", async ({ page }) => {
    await page.goto("/");
    await page.locator("button", { hasText: "+" }).click();
    await expect(page.getByText("Chi tiêu").first()).toBeVisible();

    await page.locator("input[inputmode='numeric']").fill("120000");
    const catBtn = page.getByRole("button", { name: "Ăn uống" }).last();
    await catBtn.scrollIntoViewIfNeeded();
    await catBtn.click();
    await page.getByRole("button", { name: "Lưu", exact: true }).click();
    await expect(page.locator("input[inputmode='numeric']")).not.toBeVisible();
  });

  test("shows validation error when amount is missing", async ({ page }) => {
    await page.goto("/");
    await page.locator("button", { hasText: "+" }).click();
    await page.getByRole("button", { name: "Lưu", exact: true }).click();
    await expect(page.getByText("Nhập số tiền hợp lệ")).toBeVisible();
  });

  test("shows validation error when category is not selected", async ({ page }) => {
    await page.goto("/");
    await page.locator("button", { hasText: "+" }).click();
    await page.locator("input[inputmode='numeric']").fill("50000");
    await page.getByRole("button", { name: "Lưu", exact: true }).click();
    await expect(page.getByText("Chọn danh mục")).toBeVisible();
  });
});

test.describe("Dashboard — delete transaction", () => {
  test.beforeEach(async () => {
    await resetTestData("full");
  });

  test("delete removes transaction from list", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Bún bò buổi trưa").first().click();
    await page.getByRole("button", { name: "Xoá" }).click();
    await expect(page.getByText("Bún bò buổi trưa").first()).not.toBeVisible();
  });
});

// PR #74: remove organize buttons, add ✦ sparkle button
// PR #75: hide all AI features from transaction screen
test.describe("Dashboard — AI surface controls", () => {
  test.beforeAll(async () => {
    await resetTestData("full");
  });

  test("sparkle button (Sắp xếp bằng AI) is visible in header", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTitle("Sắp xếp bằng AI")).toBeVisible();
  });

  test("no Tổ chức button on dashboard", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: /Tổ chức/ })).not.toBeVisible();
  });
});

// PR #78: animate total on category filter + context subtitle
test.describe("Dashboard — category filter subtitle", () => {
  test.beforeAll(async () => {
    await resetTestData("full");
  });

  test("subtitle changes to 'trong tổng' when category chip is active", async ({ page }) => {
    await page.goto("/");
    // Wait for data to load (default subtitle visible first)
    await expect(page.getByText("đã chi tháng này")).toBeVisible();
    // Subtitle should NOT show "trong tổng" before filtering
    await expect(page.getByText(/trong tổng/)).not.toBeVisible();

    // Click the Ăn uống chip (seeded category)
    await page.getByRole("button", { name: "Ăn uống" }).first().click();
    // Subtitle now shows breakdown context
    await expect(page.getByText(/trong tổng/)).toBeVisible();
    await expect(page.getByText(/đã chi tháng này/)).toBeVisible();
  });

  test("subtitle resets when All chip is clicked", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("đã chi tháng này")).toBeVisible();

    await page.getByRole("button", { name: "Ăn uống" }).first().click();
    await expect(page.getByText(/trong tổng/)).toBeVisible();

    // Click "Tất cả" to deselect
    await page.getByRole("button", { name: /Tất cả/ }).click();
    await expect(page.getByText(/trong tổng/)).not.toBeVisible();
    await expect(page.getByText("đã chi tháng này")).toBeVisible();
  });
});
