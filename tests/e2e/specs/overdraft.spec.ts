import { test, expect, type APIRequestContext } from "@playwright/test";
import { resetTestData } from "../helpers";
import { getUserId, seedRepaymentCategory } from "../db-reset";
import { TEST_EMAIL } from "../global-setup";

// Contract: docs/product/behavior/overdraft.md
type CategoryNode = { id: number; name: string; type: string; budget_behavior: string; system_kind: string | null; children: CategoryNode[] };

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });

function flatten(nodes: CategoryNode[]): CategoryNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}

async function categoryIds(request: APIRequestContext) {
  const { categories } = await (await request.get("/api/categories")).json() as { categories: CategoryNode[] };
  const all = flatten(categories);
  const consumption = all.find((c) => c.children.length === 0 && c.type === "expense" && c.budget_behavior === "consumption" && !c.system_kind);
  const repayment = all.find((c) => c.system_kind === "debt_repayment");
  expect(consumption && repayment).toBeTruthy();
  return { consumptionId: consumption!.id, repaymentId: repayment!.id };
}

async function createOverdraftAccount(request: APIRequestContext, name: string) {
  const res = await request.post("/api/finance-accounts", { data: { is_overdraft: true, name } });
  expect(res.status()).toBe(201);
  const { account } = await res.json();
  expect(account).toMatchObject({ type: "debt", debt_direction: "borrow", is_overdraft: true });
  return account.id as string;
}

async function owedOn(request: APIRequestContext, accountId: string) {
  const { accounts } = await (await request.get("/api/finance-accounts")).json() as { accounts: { id: string; balance: number }[] };
  return accounts.find((a) => a.id === accountId)!.balance;
}

test.describe("Overdraft accounts", () => {
  test.beforeEach(async () => {
    await resetTestData("full");
    seedRepaymentCategory(getUserId(TEST_EMAIL));
  });

  test("purchases increase the amount owed, repayments reduce it, and neither can go negative", async ({ page }) => {
    const { request } = page;
    const { consumptionId, repaymentId } = await categoryIds(request);
    const accountId = await createOverdraftAccount(request, "Thấu chi E2E");

    const purchase = await request.post("/api/transactions", {
      data: { type: "expense", amount: 500_000, date: today(), category_id: consumptionId, note: "Mua bằng thấu chi", overdraft_account_id: accountId },
    });
    expect(purchase.status()).toBe(201);
    const purchaseTxn = (await purchase.json()).transaction;
    expect(purchaseTxn.overdraft_account).toEqual({ id: accountId, name: "Thấu chi E2E" });
    expect(await owedOn(request, accountId)).toBe(500_000);

    const tooMuch = await request.post("/api/transactions", {
      data: { type: "expense", amount: 600_000, date: today(), category_id: repaymentId, finance_account_id: accountId },
    });
    expect(tooMuch.status()).toBe(422);
    expect((await tooMuch.json()).code).toBe("FINANCE_BALANCE_EXCEEDED");

    const repay = await request.post("/api/transactions", {
      data: { type: "expense", amount: 200_000, date: today(), category_id: repaymentId, finance_account_id: accountId, note: "Trả thấu chi" },
    });
    expect(repay.status()).toBe(201);
    expect(await owedOn(request, accountId)).toBe(300_000);
    expect((await (await request.get("/api/dashboard")).json()).overdraft_owed).toBe(300_000);

    // Deleting the purchase would leave the 200.000 repayment without debt.
    const deletePurchase = await request.delete(`/api/transactions/${purchaseTxn.id}`);
    expect(deletePurchase.status()).toBe(422);
    expect(await owedOn(request, accountId)).toBe(300_000);

    // The account cannot be deleted while it has purchases or repayments.
    expect((await request.delete(`/api/finance-accounts/${accountId}`)).ok()).toBe(false);
  });

  test("only consumption expenses can be paid by overdraft, and not together with a card", async ({ page }) => {
    const { request } = page;
    const { consumptionId } = await categoryIds(request);
    const accountId = await createOverdraftAccount(request, "Thấu chi E2E");
    const groupRes = await request.post("/api/credit-card-groups", { data: { name: "Thẻ E2E", statement_close_day: 15 } });
    const groupId = (await groupRes.json()).group.id;

    const both = await request.post("/api/transactions", {
      data: { type: "expense", amount: 1_000, date: today(), category_id: consumptionId, overdraft_account_id: accountId, credit_card_group_id: groupId },
    });
    expect(both.status()).toBe(400);
    expect((await both.json()).error).toContain("Chỉ chọn một hình thức thanh toán");

    const debtAccount = await request.post("/api/finance-accounts", { data: { type: "debt", debt_direction: "borrow", name: "Vay thường" } });
    const notOverdraft = await request.post("/api/transactions", {
      data: { type: "expense", amount: 1_000, date: today(), category_id: consumptionId, overdraft_account_id: (await debtAccount.json()).account.id },
    });
    expect(notOverdraft.status()).toBe(404);
  });

  test("highlights what is owed to the bank on the dashboard and on the transaction row", async ({ page }) => {
    const { consumptionId } = await categoryIds(page.request);
    const accountId = await createOverdraftAccount(page.request, "Thấu chi VCB");
    await page.request.post("/api/transactions", {
      data: { type: "expense", amount: 750_000, date: today(), category_id: consumptionId, note: "Sửa xe thấu chi", overdraft_account_id: accountId },
    });

    await page.goto("/");

    await expect(page.getByText("Nợ thấu chi ngân hàng")).toBeVisible();
    await expect(page.getByText("Nợ thấu chi ngân hàng").locator("span")).toHaveText("750.000₫");
    const row = page.getByRole("button", { name: /Sửa xe thấu chi, chi 750\.000₫, trả bằng thấu chi Thấu chi VCB/ });
    await expect(row).toBeVisible();
    await expect(row.getByText("Thấu chi · Thấu chi VCB")).toBeVisible();

    await page.goto("/cards");
    await expect(page.getByText("Thấu chi VCB", { exact: true })).toBeVisible();
    await expect(page.getByText("Đang nợ ngân hàng", { exact: true })).toBeVisible();
    // The Finance debt total includes what is owed on overdraft accounts.
    await expect(page.getByText("Còn phải trả", { exact: true }).locator("xpath=following-sibling::p[1]")).toHaveText("750.000₫");
  });

  test("creates an overdraft account from the payment selector and pays with it", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Ghi giao dịch" }).click();
    await page.locator("input[inputmode='numeric']").fill("90000");
    const category = page.getByRole("button", { name: "Ăn uống" }).last();
    await category.scrollIntoViewIfNeeded();
    await category.click();

    await page.getByLabel("Thanh toán").selectOption("new-overdraft");
    await page.getByRole("textbox", { name: "Tên tài khoản thấu chi" }).fill("Thấu chi TCB");
    await page.getByRole("button", { name: "Tạo", exact: true }).click();
    await expect(page.getByLabel("Thanh toán").locator("option:checked")).toHaveText("Thấu chi TCB");
    await expect(page.getByRole("note")).toContainText("nợ thấu chi với ngân hàng");

    await page.getByRole("textbox", { name: "Ghi chú" }).fill("Ăn trưa thấu chi");
    await page.getByRole("button", { name: "Lưu", exact: true }).click();

    await expect(page.getByRole("button", { name: /Ăn trưa thấu chi, chi 90\.000₫, trả bằng thấu chi Thấu chi TCB/ })).toBeVisible();
    await expect(page.getByText("Nợ thấu chi ngân hàng").locator("span")).toHaveText("90.000₫");
  });
});
