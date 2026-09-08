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
    await expect(page.getByText(/hạn mức/)).toBeVisible();
    await expect(page.getByRole("progressbar")).toBeVisible();
  });

  test("month picker navigates to a prior month", async ({ page }) => {
    await page.goto("/");
    const picker = page.getByLabel("Chọn tháng");
    const current = await picker.inputValue();
    await picker.selectOption({ index: 1 });
    await expect(picker).not.toHaveValue(current);
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

  test("opens form via the labeled transaction action and creates an expense", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Ghi giao dịch" }).click();
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
    await page.getByRole("button", { name: "Ghi giao dịch" }).click();
    await page.getByRole("button", { name: "Lưu", exact: true }).click();
    await expect(page.getByText("Nhập số tiền hợp lệ")).toBeVisible();
  });

  test("shows validation error when category is not selected", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Ghi giao dịch" }).click();
    await page.locator("input[inputmode='numeric']").fill("50000");
    await page.getByRole("button", { name: "Lưu", exact: true }).click();
    await expect(page.getByText("Chọn danh mục")).toBeVisible();
  });
});

test.describe("Dashboard — delete transaction", () => {
  test.beforeEach(async () => {
    await resetTestData("full");
  });

  test("requires named confirmation before deleting a transaction", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Bún bò buổi trưa").first().click();
    await page.getByRole("button", { name: "Xoá" }).click();
    await expect(page.getByRole("heading", { name: "Xoá “Bún bò buổi trưa”?" })).toBeVisible();
    await expect(page.getByText(/không thể hoàn tác/)).toBeVisible();
    await expect(page.getByText("Bún bò buổi trưa").first()).toBeVisible();
    await page.getByRole("button", { name: "Xác nhận xoá" }).click();
    await expect(page.getByText("Bún bò buổi trưa").first()).not.toBeVisible();
  });

  test("keeps confirmation open and explains a failed delete", async ({ page }) => {
    await page.route("**/api/transactions/*", async (route) => {
      if (route.request().method() === "DELETE") {
        await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "failed" }) });
        return;
      }
      await route.continue();
    });

    await page.goto("/");
    await page.getByText("Bún bò buổi trưa").first().click();
    await page.getByRole("button", { name: "Xoá" }).click();
    await page.getByRole("button", { name: "Xác nhận xoá" }).click();

    await expect(page.getByRole("alert").filter({ hasText: "Không thể xoá giao dịch" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Xác nhận xoá" })).toBeEnabled();
  });
});

test.describe("Dashboard — AI surface controls", () => {
  test.beforeAll(async () => {
    await resetTestData("full");
  });

  test("labeled AI organize action is visible for the current month", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "AI sắp xếp" })).toBeVisible();
  });

  test("AI organize action is hidden for a historical month", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Chọn tháng").selectOption({ index: 1 });
    await expect(page.getByRole("button", { name: "AI sắp xếp" })).not.toBeVisible();
  });
});

test.describe("Dashboard — continuous ledger", () => {
  test.beforeAll(async () => {
    await resetTestData("full");
  });

  test("does not show transaction filter controls", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: /Tất cả/ })).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Ăn uống" })).not.toBeVisible();
    await expect(page.getByText("Bún bò buổi trưa")).toBeVisible();
  });
});
