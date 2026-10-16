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
  test("blocks edits and reassignment that leave related withdrawals without funds", async ({ page }) => {
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
    const rejectedEdit = await page.request.patch(`/api/transactions/${deposit.id}`, { data: { amount: 300000 } });
    expect(rejectedEdit.status()).toBe(422);
    expect(await rejectedEdit.json()).toMatchObject({ code: "FINANCE_BALANCE_EXCEEDED" });
    const rejectedDelete = await page.request.delete(`/api/transactions/${deposit.id}`);
    expect(rejectedDelete.status()).toBe(422);
    const edited = await page.request.patch(`/api/transactions/${deposit.id}`, { data: {
      amount: 700000, category_id: depositCategory.id,
    } });
    expect(edited.status()).toBe(200);
    const afterEdit = await (await page.request.get("/api/finance-accounts")).json() as { accounts: typeof accounts };
    const originalAfterEdit = afterEdit.accounts.find((account) => account.id === savings.id)!;
    expect(originalAfterEdit.balance).toBe(-200000);
    const relatedBeforeMove = originalAfterEdit.transactions.find((transaction) => transaction.id === withdrawal.id);
    expect(relatedBeforeMove).toMatchObject({ amount: 500000, type: "income" });
    const rejectedMove = await page.request.patch(`/api/transactions/${deposit.id}`, { data: { finance_account_id: destination.id } });
    expect(rejectedMove.status()).toBe(422);
    const funding = await page.request.post("/api/transactions", { data: {
      amount: 500000, type: "expense", category_id: depositCategory.id,
      finance_account_id: savings.id, date: deposit.date,
    } });
    expect(funding.status()).toBe(201);
    const moved = await page.request.patch(`/api/transactions/${deposit.id}`, { data: { finance_account_id: destination.id } });
    expect(moved.status()).toBe(200);
    const afterMove = await (await page.request.get("/api/finance-accounts")).json() as { accounts: typeof accounts };
    const originalAfterMove = afterMove.accounts.find((account) => account.id === savings.id)!;
    expect(originalAfterMove.balance).toBe(0);
    expect(originalAfterMove.transactions).toHaveLength(2);
    expect(originalAfterMove.transactions.find((transaction) => transaction.id === withdrawal.id)).toEqual(relatedBeforeMove);
    expect(afterMove.accounts.find((account) => account.id === destination.id)).toMatchObject({
      balance: -700000, transactions: [{ id: deposit.id, amount: 700000 }],
    });
  });

  test("blocks excessive amounts before submission in the Finance form", async ({ page }) => {
    await resetTestData("accounts");
    await page.goto("/cards");
    await page.getByText("Minh", { exact: true }).click();
    await page.getByRole("button", { name: "Nhận tiền trả nợ", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Nhận tiền trả nợ" });
    const input = dialog.getByRole("textbox", { name: "Số tiền", exact: true });
    await input.fill("1500001");
    await expect(dialog.getByRole("alert")).toContainText("1.500.000₫");
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(dialog.getByRole("button", { name: "Lưu", exact: true })).toBeDisabled();
    await input.fill("1500000");
    await expect(dialog.getByRole("alert")).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "Lưu", exact: true })).toBeEnabled();
  });

  test("enforces separate ceilings and concurrent reductions for savings and both debt directions", async ({ page }) => {
    await resetTestData("accounts");
    expect((await page.request.post("/api/categories/seed")).ok()).toBeTruthy();
    type Category = { id: number; system_kind: string | null; children: Category[] };
    const { categories } = await (await page.request.get("/api/categories")).json() as { categories: Category[] };
    const flatten = (entries: Category[]): Category[] => entries.flatMap((category) => [category, ...flatten(category.children)]);
    const all = flatten(categories);
    const today = new Date().toISOString().slice(0, 10);
    for (const scenario of [
      { type: "savings", opening: "savings_deposit", reduction: "savings_withdrawal", direction: "expense", opposite: "income", debt_direction: null },
      { type: "debt", opening: "lend", reduction: "debt_collection", direction: "expense", opposite: "income", debt_direction: "lend" },
      { type: "debt", opening: "borrow", reduction: "debt_repayment", direction: "income", opposite: "expense", debt_direction: "borrow" },
    ]) {
      const created = await page.request.post("/api/finance-accounts", { data: { type: scenario.type, debt_direction: scenario.debt_direction, name: `Kiểm tra giới hạn ${scenario.opening}` } });
      expect(created.status()).toBe(201);
      const { account } = await created.json() as { account: { id: string } };
      const openingCategory = all.find((category) => category.system_kind === scenario.opening)!;
      const reductionCategory = all.find((category) => category.system_kind === scenario.reduction)!;
      const openingIds: number[] = [];
      for (const amount of [500000, 700000]) {
        const response = await page.request.post("/api/transactions", { data: {
          amount, type: scenario.direction, category_id: openingCategory.id, finance_account_id: account.id, date: today,
        } });
        expect(response.status()).toBe(201);
        openingIds.push((await response.json() as { transaction: { id: number } }).transaction.id);
      }
      const reduce = (amount: number) => page.request.post("/api/transactions", { data: {
        amount, type: scenario.opposite, category_id: reductionCategory.id, finance_account_id: account.id, date: today,
      } });
      expect((await reduce(200000)).status()).toBe(201);
      const excessive = await reduce(1000001);
      expect(excessive.status()).toBe(422);
      expect(await excessive.json()).toMatchObject({ code: "FINANCE_BALANCE_EXCEEDED" });
      const concurrent = await Promise.all([reduce(600000), reduce(600000)]);
      expect(concurrent.map((response) => response.status()).sort()).toEqual([201, 422]);
      const accepted = concurrent.find((response) => response.status() === 201)!;
      const { transaction: reduction } = await accepted.json() as { transaction: { id: number } };
      const excessiveEdit = await page.request.patch(`/api/transactions/${reduction.id}`, { data: { amount: 1000001 } });
      expect(excessiveEdit.status()).toBe(422);
      expect((await page.request.patch(`/api/transactions/${reduction.id}`, { data: { amount: 1000000 } })).status()).toBe(200);
      expect((await reduce(1)).status()).toBe(422);
      expect((await page.request.delete(`/api/transactions/${openingIds[0]}`)).status()).toBe(422);
    }
  });

  test("offers contextual account management without creating from Finance", async ({ page }) => {
    await resetTestData("accounts");
    await page.goto("/cards");
    await page.getByText("Minh", { exact: true }).click();
    await expect(page.getByRole("button", { name: "Sửa thông tin" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Thêm khoản nợ/ })).toHaveCount(0);
  });
});
