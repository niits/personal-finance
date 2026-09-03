import { test, expect } from "@playwright/test";
import { resetTestData } from "../helpers";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:8787";

test.describe("Finance accounts API", () => {
  test("GET /api/finance-accounts returns 401 without a session", async () => {
    expect((await fetch(`${BASE_URL}/api/finance-accounts`)).status).toBe(401);
  });
});

test.describe("Tài chính", () => {
  test.beforeAll(async () => { await resetTestData("minimal"); });

  test("shows mode-specific empty account guidance", async ({ page }) => {
    await page.goto("/cards");
    await expect(page.getByRole("heading", { name: "Tài chính" })).toBeVisible();
    await expect(page.getByText(/Chưa có khoản nợ/)).toBeVisible();
    await page.getByRole("tab", { name: "Tiền gửi" }).click();
    await expect(page.getByText(/Chưa có khoản tiền gửi/)).toBeVisible();
  });
  test("shows account balances and linked transaction history", async ({ page }) => {
    await resetTestData("accounts");
    await page.goto("/cards");

    await expect(page.getByText("Minh", { exact: true })).toBeVisible();
    await expect(page.getByText(/Cho vay/)).toBeVisible();
    await expect(page.getByText("Còn được nhận 1.500.000₫", { exact: true })).toBeVisible();
    await page.getByText("Minh", { exact: true }).click();
    await expect(page.getByText(/Cho Minh vay/)).toBeVisible();
    await expect(page.getByText(/Minh trả một phần/)).toBeVisible();

    await page.getByRole("tab", { name: "Tiền gửi" }).click();
    await expect(page.getByText("Quỹ dự phòng", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Quỹ dự phòng.*2\.000\.000₫.*Đang để dành/ })).toBeVisible();
  });

  test("offers contextual account management without creating from Finance", async ({ page }) => {
    await resetTestData("accounts");
    await page.goto("/cards");
    await page.getByText("Minh", { exact: true }).click();
    await expect(page.getByRole("button", { name: "Sửa thông tin" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Thêm khoản nợ/ })).toHaveCount(0);
  });
});
