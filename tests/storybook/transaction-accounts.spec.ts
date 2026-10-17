import { expect, test } from "@playwright/test";

// Contract: docs/product/behavior/transactions.md, Debt And Savings Movements.
for (const scenario of [
  { kind: "savings_deposit", category: "Gửi tiết kiệm", direction: "expense", accountType: "savings", debtDirection: null },
  { kind: "lend", category: "Cho vay", direction: "expense", accountType: "debt", debtDirection: "lend" },
  { kind: "borrow", category: "Đi vay", direction: "income", accountType: "debt", debtDirection: "borrow" },
]) {
  test(`Inline ${scenario.kind} account creation updates the open transaction form`, async ({ page }) => {
    const existingAccount = { balance: 0, transactions: [], id: "existing", name: "Tài khoản hiện có", type: scenario.accountType, debt_direction: scenario.debtDirection };
    const accounts = [existingAccount];
    let accountReads = 0;
    await page.route("**/api/categories", (route) => route.fulfill({ json: {
      categories: [{ id: 1, name: scenario.category, type: scenario.direction, level: 1, parent_id: null, system_kind: scenario.kind, budget_behavior: "non_budget", children: [] }],
      usage_counts: {},
    } }));
    await page.route("**/api/custom-budgets?*", (route) => route.fulfill({ json: { custom_budgets: [] } }));
    await page.route("**/api/credit-card-groups", (route) => route.fulfill({ json: { groups: [] } }));
    await page.route("**/api/finance-accounts", async (route) => {
      if (route.request().method() === "POST") {
        const body = route.request().postDataJSON();
        expect(body).toMatchObject({ type: scenario.accountType, name: "Tài khoản mới" });
        if (scenario.debtDirection) expect(body.debt_direction).toBe(scenario.debtDirection);
        const account = { ...existingAccount, id: "created", name: body.name };
        accounts.push(account);
        await route.fulfill({ status: 201, json: { account } });
      } else {
        accountReads += 1;
        await route.fulfill({ json: { accounts } });
      }
    });

    await page.goto("/iframe.html?id=organisms-transactionform--create-mode&viewMode=story");
    if (scenario.direction === "income") await page.getByRole("button", { name: "Thu nhập", exact: true }).click();
    await page.getByRole("button", { name: scenario.category, exact: true }).click();
    const selector = page.locator("#finance-account");
    await expect(selector.locator("option")).toHaveCount(2);
    await selector.selectOption("existing");
    await page.getByLabel("Số tiền", { exact: true }).fill("100000");
    await page.getByLabel("Tên tài khoản mới").fill("Tài khoản mới");
    await page.getByRole("button", { name: "Tạo", exact: true }).click();

    await expect(selector).toHaveValue("created");
    await expect(selector.locator("option:checked")).toHaveText("Tài khoản mới");
    await expect(selector.locator("option")).toHaveCount(3);
    await expect(page.getByLabel("Tên tài khoản mới")).toHaveValue("");
    await expect(page.getByLabel("Số tiền", { exact: true })).toHaveValue("100.000");
    expect(accountReads).toBeGreaterThanOrEqual(2);

    const saved = page.waitForRequest((request) => request.url().endsWith("/api/transactions") && request.method() === "POST");
    await page.route("**/api/transactions", (route) => route.fulfill({ status: 201, json: { transaction: { id: 1 } } }));
    await page.getByRole("button", { name: "Lưu", exact: true }).click();
    expect((await saved).postDataJSON()).toMatchObject({ amount: 100000, category_id: 1, finance_account_id: "created", type: scenario.direction });
  });
}

test("Account families stay separate when changing categories and direction", async ({ page }) => {
  await page.goto("/iframe.html?id=organisms-transactionform--account-families&viewMode=story");
  const selector = page.locator("#finance-account");
  for (const scenario of [
    { category: "Cho vay", label: "Tài khoản cho vay", account: "lend", direction: "Chi tiêu" },
    { category: "Trả nợ", label: "Tài khoản đi vay", account: "borrow", direction: "Chi tiêu" },
    { category: "Gửi tiền", label: "Tài khoản tiền gửi", account: "savings", direction: "Chi tiêu" },
    { category: "Đi vay", label: "Tài khoản đi vay", account: "borrow", direction: "Thu nhập" },
    { category: "Nhận tiền trả nợ", label: "Tài khoản cho vay", account: "lend", direction: "Thu nhập" },
    { category: "Rút tiền", label: "Tài khoản tiền gửi", account: "savings", direction: "Thu nhập" },
  ]) {
    await page.getByRole("button", { name: scenario.direction, exact: true }).click();
    await page.getByRole("button", { name: scenario.category, exact: true }).click();
    await expect(page.getByLabel(scenario.label, { exact: true })).toBeVisible();
    await expect(selector.locator("option")).toHaveCount(2);
    await expect(selector).toHaveValue("");
    await expect(selector.locator("option").last()).toHaveAttribute("value", scenario.account);
    await selector.selectOption(scenario.account);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
