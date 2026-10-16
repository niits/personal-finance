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
    await expect(page.getByRole("button", { name: /Quỹ dự phòng.*2\.000\.000₫.*Số dư tiền gửi/ })).toBeVisible();
  });

  // Contract: docs/product/behavior/transactions.md, Debt And Savings Movements.
  test("records a partial repayment from a Finance account", async ({ page }) => {
    await resetTestData("accounts");
    await page.goto("/cards");
    await page.getByText("Minh", { exact: true }).click();
    await page.getByRole("button", { name: "Nhận tiền trả nợ", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Nhận tiền trả nợ" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("textbox", { name: "Số tiền", exact: true }).fill("500000");
    await expect(dialog.getByRole("textbox")).toHaveCount(1);
    const saved = page.waitForResponse((response) => response.url().endsWith("/api/transactions")
      && response.request().method() === "POST");
    await dialog.getByRole("button", { name: "Lưu", exact: true }).click();
    expect((await saved).status()).toBe(201);
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText("Còn được nhận 1.000.000₫", { exact: true })).toBeVisible();
    await expect(page.getByText("Cho Minh vay", { exact: true })).toBeVisible();
    await expect(page.getByText("Nhận tiền trả nợ", { exact: true }).last()).toBeVisible();
    await page.reload();
    await page.getByText("Minh", { exact: true }).click();
    await expect(page.getByText("Nhận tiền trả nợ", { exact: true }).last()).toBeVisible();
  });

  test("records a withdrawal using only an amount", async ({ page }) => {
    await resetTestData("accounts");
    await page.goto("/cards");
    await page.getByRole("tab", { name: "Tiền gửi" }).click();
    await page.getByText("Quỹ dự phòng", { exact: true }).click();
    await page.getByRole("button", { name: "Rút tiền gửi", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Rút tiền gửi" });
    await expect(dialog.getByRole("textbox")).toHaveCount(1);
    await dialog.getByRole("textbox", { name: "Số tiền", exact: true }).fill("500000");
    await dialog.getByRole("button", { name: "Lưu", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Quỹ dự phòng.*1\.500\.000₫/ })).toBeVisible();
    await expect(page.getByText("Gửi quỹ dự phòng", { exact: true })).toBeVisible();
  });

  // Contract: edits recompute both accounts without changing related withdrawals.
  test("preserves related withdrawals when editing and moving a deposit", async ({ page }) => {
    await resetTestData("accounts");
    const categoriesResponse = await page.request.get("/api/categories");
    expect(categoriesResponse.ok()).toBeTruthy();
    const { categories } = await categoriesResponse.json() as {
      categories: { id: number; system_kind: string | null }[];
    };
    const depositCategory = categories.find((category) => category.system_kind === "savings_deposit")!;
    const withdrawalCategory = categories.find((category) => category.system_kind === "savings_withdrawal")!;
    const accountsResponse = await page.request.get("/api/finance-accounts");
    const { accounts } = await accountsResponse.json() as { accounts: {
      id: string; type: string; balance: number; transactions: { id: number; amount: number; type: string; date: string; note: string | null }[];
    }[] };
    const savings = accounts.find((account) => account.type === "savings")!;
    const deposit = savings.transactions[0];
    const withdrawalResponse = await page.request.post("/api/transactions", { data: {
      amount: 500000, type: "income", category_id: withdrawalCategory.id,
      finance_account_id: savings.id, date: deposit.date, note: "Rút tiền gửi để kiểm tra chỉnh sửa",
    } });
    expect(withdrawalResponse.status()).toBe(201);
    const { transaction: withdrawal } = await withdrawalResponse.json() as { transaction: { id: number } };
    const destinationResponse = await page.request.post("/api/finance-accounts", { data: {
      type: "savings", name: "Quỹ nhận khoản gửi chuyển",
    } });
    expect(destinationResponse.status()).toBe(201);
    const { account: destination } = await destinationResponse.json() as { account: { id: string } };
    const edited = await page.request.patch(`/api/transactions/${deposit.id}`, { data: {
      amount: 300000, category_id: depositCategory.id,
    } });
    expect(edited.status()).toBe(200);
    const afterEdit = await (await page.request.get("/api/finance-accounts")).json() as { accounts: typeof accounts };
    const originalAfterEdit = afterEdit.accounts.find((account) => account.id === savings.id)!;
    expect(originalAfterEdit.balance).toBe(200000);
    const relatedBeforeMove = originalAfterEdit.transactions.find((transaction) => transaction.id === withdrawal.id);
    expect(relatedBeforeMove).toMatchObject({ amount: 500000, type: "income" });
    const moved = await page.request.patch(`/api/transactions/${deposit.id}`, { data: {
      finance_account_id: destination.id,
    } });
    expect(moved.status()).toBe(200);
    const afterMove = await (await page.request.get("/api/finance-accounts")).json() as { accounts: typeof accounts };
    expect(afterMove.accounts.find((account) => account.id === savings.id)).toMatchObject({
      balance: 500000, transactions: [relatedBeforeMove],
    });
    expect(afterMove.accounts.find((account) => account.id === destination.id)).toMatchObject({
      balance: -300000, transactions: [{ id: deposit.id, amount: 300000 }],
    });
  });

  test("offers contextual account management without creating from Finance", async ({ page }) => {
    await resetTestData("accounts");
    await page.goto("/cards");
    await page.getByText("Minh", { exact: true }).click();
    await expect(page.getByRole("button", { name: "Sửa thông tin" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Thêm khoản nợ/ })).toHaveCount(0);
  });
});
