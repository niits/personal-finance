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

  test("shows empty account sections", async ({ page }) => {
    await page.goto("/cards");
    await expect(page.getByRole("heading", { name: "Tài chính" })).toBeVisible();
    await expect(page.getByText("Chưa có tài khoản.")).toHaveCount(2);
  });
  test("shows account balances and linked transaction history", async ({ page }) => {
    await resetTestData("accounts");
    await page.goto("/cards");

    await expect(page.getByRole("heading", { name: "Nợ" })).toBeVisible();
    await expect(page.getByText("Minh", { exact: true })).toBeVisible();
    await expect(page.getByText("Cho vay")).toBeVisible();
    await expect(page.getByText(/1[.,]500[.,]000/)).toBeVisible();
    await expect(page.getByText(/Cho Minh vay/)).toBeVisible();
    await expect(page.getByText(/Minh trả một phần/)).toBeVisible();

    await expect(page.getByRole("heading", { name: "Tiết kiệm", exact: true })).toBeVisible();
    await expect(page.getByText("Quỹ dự phòng", { exact: true })).toBeVisible();
    await expect(page.getByText("2.000.000₫", { exact: true })).toBeVisible();
  });

  test("offers account management", async ({ page }) => {
    await resetTestData("accounts");
    await page.goto("/cards");
    await expect(page.getByRole("button", { name: "Thêm" }).first()).toBeVisible();
  });
});
