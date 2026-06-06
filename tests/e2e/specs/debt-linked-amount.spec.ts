/**
 * E2E tests for the partial linked_amount debt feature.
 *
 * A transaction can cover only a portion of a debt: the user enters the
 * full transaction amount in the main field and an optional "Số tiền nợ"
 * field for the debt obligation. When set, debt calculations use it instead
 * of the full amount.
 *
 * Coverage:
 *   - API: POST /api/debts, POST /api/transactions, PATCH transaction,
 *          PATCH link — all with linked_amount
 *   - UI: TransactionForm shows and wires up the partial-amount input
 *   - UI: Debt detail page renders linked_amount correctly
 */
import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { resetTestData } from "../helpers";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:8787";

async function authHeaders(page: Page): Promise<Record<string, string>> {
  await page.goto("/");
  const cookies = await page.context().cookies();
  const session = cookies.find((c) => c.name.startsWith("better-auth"));
  return session ? { Cookie: `${session.name}=${session.value}` } : {};
}

async function createDebt(
  request: APIRequestContext,
  headers: Record<string, string>,
  data: { type: "lend" | "borrow"; party: string; amount: number; linked_amount?: number; date?: string },
) {
  const res = await request.post("/api/debts", {
    headers,
    data: { date: new Date().toISOString().slice(0, 10), ...data },
  });
  expect(res.status()).toBe(201);
  return (await res.json() as {
    debt: {
      id: string;
      opening_amount: number;
      total_repaid: number;
      remaining: number;
      transactions: { id: number; amount: number; linked_amount: number | null; is_opening: boolean }[];
    };
  }).debt;
}

async function openDebt(page: Page, party: string) {
  await page.goto("/debts");
  await expect(page.getByText(party).first()).toBeVisible();
  await page.getByText(party).first().click();
  await expect(page).toHaveURL(/\/debts\/.+/);
  await expect(page.getByText("Lịch sử")).toBeVisible();
}

// ─── API: POST /api/debts with linked_amount ──────────────────────────────────

test.describe("linked_amount API — POST /api/debts", () => {
  test.beforeAll(async () => { await resetTestData("minimal"); });

  test("E2E-LA-API-1: linked_amount < amount → opening_amount uses linked_amount", async ({ page, request }) => {
    const headers = await authHeaders(page);
    // Full dinner bill 900k; only 300k is the loan
    const debt = await createDebt(request, headers, { type: "lend", party: "Tùng", amount: 900_000, linked_amount: 300_000 });

    expect(debt.opening_amount).toBe(300_000);
    expect(debt.remaining).toBe(300_000);

    const openingTx = debt.transactions.find((t) => t.is_opening)!;
    expect(openingTx.amount).toBe(900_000);
    expect(openingTx.linked_amount).toBe(300_000);
  });

  test("E2E-LA-API-2: omitting linked_amount → opening_amount = full transaction amount", async ({ page, request }) => {
    const headers = await authHeaders(page);
    const debt = await createDebt(request, headers, { type: "lend", party: "Full", amount: 500_000 });

    expect(debt.opening_amount).toBe(500_000);
    expect(debt.remaining).toBe(500_000);
    expect(debt.transactions[0].linked_amount).toBeNull();
  });

  test("E2E-LA-API-3: linked_amount on borrow debt", async ({ page, request }) => {
    const headers = await authHeaders(page);
    // Received 1M, but only borrowed 600k
    const debt = await createDebt(request, headers, { type: "borrow", party: "Chị Mai", amount: 1_000_000, linked_amount: 600_000 });

    expect(debt.opening_amount).toBe(600_000);
    expect(debt.remaining).toBe(600_000);
  });
});

// ─── API: POST /api/transactions repayment with linked_amount ─────────────────

test.describe("linked_amount API — repayment transactions", () => {
  test.beforeAll(async () => { await resetTestData("minimal"); });

  test("E2E-LA-REP-1: partial repayment reduces remaining by linked_amount", async ({ page, request }) => {
    const headers = await authHeaders(page);
    const debt = await createDebt(request, headers, { type: "lend", party: "RepTest", amount: 1_000_000 });

    // Received 500k total, only 200k is for this debt
    const repRes = await request.post("/api/transactions", {
      headers,
      data: { amount: 500_000, type: "income", date: new Date().toISOString().slice(0, 10), debt_id: debt.id, linked_amount: 200_000 },
    });
    expect(repRes.status()).toBe(201);
    const repBody = await repRes.json() as { transaction: { linked_amount: number | null } };
    expect(repBody.transaction.linked_amount).toBe(200_000);

    const getRes = await request.get(`/api/debts/${debt.id}`, { headers });
    const body = await getRes.json() as { debt: { total_repaid: number; remaining: number } };
    expect(body.debt.total_repaid).toBe(200_000);
    expect(body.debt.remaining).toBe(800_000);
  });

  test("E2E-LA-REP-2: linked_amount on opening + on repayment both respected", async ({ page, request }) => {
    const headers = await authHeaders(page);
    const debt = await createDebt(request, headers, { type: "lend", party: "BothPartial", amount: 800_000, linked_amount: 400_000 });

    await request.post("/api/transactions", {
      headers,
      data: { amount: 300_000, type: "income", date: new Date().toISOString().slice(0, 10), debt_id: debt.id, linked_amount: 250_000 },
    });

    const getRes = await request.get(`/api/debts/${debt.id}`, { headers });
    const body = await getRes.json() as { debt: { opening_amount: number; total_repaid: number; remaining: number } };
    expect(body.debt.opening_amount).toBe(400_000);
    expect(body.debt.total_repaid).toBe(250_000);
    expect(body.debt.remaining).toBe(150_000);
  });
});

// ─── API: PATCH /api/transactions/[id] update linked_amount ──────────────────

test.describe("linked_amount API — PATCH transaction", () => {
  test.beforeAll(async () => { await resetTestData("minimal"); });

  test("E2E-LA-PATCH-1: set linked_amount on opening tx updates opening_amount", async ({ page, request }) => {
    const headers = await authHeaders(page);
    const debt = await createDebt(request, headers, { type: "lend", party: "PatchOpen", amount: 600_000 });
    const openingTxId = debt.transactions[0].id;

    const res = await request.patch(`/api/transactions/${openingTxId}`, {
      headers,
      data: { linked_amount: 250_000 },
    });
    expect(res.status()).toBe(200);

    const getRes = await request.get(`/api/debts/${debt.id}`, { headers });
    const body = await getRes.json() as { debt: { opening_amount: number; remaining: number } };
    expect(body.debt.opening_amount).toBe(250_000);
    expect(body.debt.remaining).toBe(250_000);
  });

  test("E2E-LA-PATCH-2: clearing linked_amount (null) reverts to full transaction amount", async ({ page, request }) => {
    const headers = await authHeaders(page);
    const debt = await createDebt(request, headers, { type: "lend", party: "PatchClear", amount: 700_000, linked_amount: 300_000 });
    const openingTxId = debt.transactions[0].id;

    const res = await request.patch(`/api/transactions/${openingTxId}`, {
      headers,
      data: { linked_amount: null },
    });
    expect(res.status()).toBe(200);

    const getRes = await request.get(`/api/debts/${debt.id}`, { headers });
    const body = await getRes.json() as { debt: { opening_amount: number } };
    expect(body.debt.opening_amount).toBe(700_000);
  });
});

// ─── API: PATCH /api/transactions/[id]/link with linked_amount ───────────────

test.describe("linked_amount API — link endpoint", () => {
  test.beforeAll(async () => { await resetTestData("budget"); });

  test("E2E-LA-LINK-1: link with linked_amount → repayment uses linked_amount not full tx", async ({ page, request }) => {
    const headers = await authHeaders(page);

    const debt = await createDebt(request, headers, { type: "lend", party: "LinkPartial", amount: 1_000_000 });

    // Standalone income tx: 600k total, but only 250k toward the debt
    const catRes = await request.get("/api/categories", { headers });
    const catBody = await catRes.json() as { categories: { id: number; type: string }[] };
    const incomeCatId = catBody.categories.find((c) => c.type === "income")!.id;

    const txRes = await request.post("/api/transactions", {
      headers,
      data: { amount: 600_000, type: "income", category_id: incomeCatId, date: new Date().toISOString().slice(0, 10) },
    });
    const { transaction } = await txRes.json() as { transaction: { id: number } };

    const linkRes = await request.patch(`/api/transactions/${transaction.id}/link`, {
      headers,
      data: { debt_id: debt.id, linked_amount: 250_000 },
    });
    expect(linkRes.status()).toBe(200);

    const getRes = await request.get(`/api/debts/${debt.id}`, { headers });
    const body = await getRes.json() as { debt: { total_repaid: number; remaining: number } };
    expect(body.debt.total_repaid).toBe(250_000);
    expect(body.debt.remaining).toBe(750_000);
  });
});

// ─── UI: TransactionForm — "Cho vay mới" shows partial amount input ───────────

test.describe("linked_amount UI — TransactionForm new debt", () => {
  test.beforeAll(async () => { await resetTestData("budget"); });

  test("E2E-LA-UI-1: expanding Cho vay mới reveals partial amount input", async ({ page }) => {
    await page.goto("/debts");
    await page.locator("button").filter({ hasText: "+" }).last().click();
    await expect(page.getByText("Giao dịch mới")).toBeVisible();

    await page.getByText(/Liên kết nợ/).click();
    await page.getByText("Cho vay mới").click();

    // Partial amount placeholder visible
    await expect(page.getByPlaceholder(/Số tiền nợ/)).toBeVisible();
    // Hạn trả date picker visible
    await expect(page.getByText(/Hạn trả/)).toBeVisible();
    // Due date shows "Chưa chọn" when not set
    await expect(page.getByText("Chưa chọn")).toBeVisible();
  });

  test("E2E-LA-UI-2: creating debt with partial amount → opening_amount reflects linked_amount", async ({ page, request }) => {
    const headers = await authHeaders(page);

    await page.goto("/debts");
    await page.locator("button").filter({ hasText: "+" }).last().click();
    await expect(page.getByText("Giao dịch mới")).toBeVisible();

    // Enter full transaction amount: 500k
    await page.locator('input[aria-label="Số tiền"]').fill("500000");

    // Open debt section, select Cho vay mới
    await page.getByText(/Liên kết nợ/).click();
    await page.getByText("Cho vay mới").click();

    // Fill party name
    await page.getByPlaceholder(/Cho vay ai/).fill("Bạn Partial");

    // Fill partial debt amount: 200k (only 200k is the loan)
    await page.getByPlaceholder(/Số tiền nợ/).fill("200000");

    // Save
    await page.getByRole("button", { name: "Lưu" }).click();
    await expect(page.getByText("Bạn Partial")).toBeVisible({ timeout: 5000 });

    // Verify via API that opening_amount is 200k, not 500k
    const listRes = await request.get("/api/debts", { headers });
    const listBody = await listRes.json() as { lending: { party: string; opening_amount: number }[] };
    const debt = listBody.lending.find((d) => d.party === "Bạn Partial");
    expect(debt).toBeDefined();
    expect(debt!.opening_amount).toBe(200_000);
  });
});

// ─── UI: TransactionForm — selecting existing debt shows partial amount input ─

test.describe("linked_amount UI — TransactionForm existing debt", () => {
  test.beforeAll(async () => { await resetTestData("debts"); });

  test("E2E-LA-UI-3: selecting existing debt shows partial amount input", async ({ page }) => {
    await page.goto("/debts");
    await page.locator("button").filter({ hasText: "+" }).last().click();
    await expect(page.getByText("Giao dịch mới")).toBeVisible();

    // Switch to income (to see lend debts in "Nhận lại từ:" list)
    await page.getByText("Thu nhập").click();

    // Expand debt section
    await page.getByText(/Liên kết nợ/).click();

    // "Nhận lại từ:" heading and Minh row visible
    await expect(page.getByText(/Nhận lại từ/)).toBeVisible();
    await expect(page.getByText("Minh").first()).toBeVisible();

    // Select Minh
    await page.getByText("Minh").first().click();

    // Partial amount placeholder appears below the selected debt
    await expect(page.getByPlaceholder(/Số tiền trả/)).toBeVisible();
  });

  test("E2E-LA-UI-4: creating repayment with partial amount → remaining reflects linked_amount", async ({ page, request }) => {
    const headers = await authHeaders(page);

    // Get current remaining for Minh before the repayment
    const beforeRes = await request.get("/api/debts", { headers });
    const beforeBody = await beforeRes.json() as { lending: { party: string; id: string; remaining: number }[] };
    const minhBefore = beforeBody.lending.find((d) => d.party === "Minh")!;
    const remainingBefore = minhBefore.remaining;

    await page.goto("/debts");
    await page.locator("button").filter({ hasText: "+" }).last().click();
    await expect(page.getByText("Giao dịch mới")).toBeVisible();

    // Income type to receive repayment on lend
    await page.getByText("Thu nhập").click();

    // Enter full received amount: 400k
    await page.locator('input[aria-label="Số tiền"]').fill("400000");

    // Open debt section and select Minh
    await page.getByText(/Liên kết nợ/).click();
    await page.getByText("Minh").first().click();

    // Enter partial amount toward debt: 100k
    await page.getByPlaceholder(/Số tiền trả/).fill("100000");

    // Save
    await page.getByRole("button", { name: "Lưu" }).click();
    await page.waitForTimeout(500);

    // Remaining should be reduced by 100k (linked_amount), not 400k
    const afterRes = await request.get(`/api/debts/${minhBefore.id}`, { headers });
    const afterBody = await afterRes.json() as { debt: { remaining: number } };
    expect(afterBody.debt.remaining).toBe(remainingBefore - 100_000);
  });
});

// ─── UI: Debt detail page — linked_amount display ─────────────────────────────

test.describe("linked_amount UI — debt detail page", () => {
  test.beforeAll(async () => { await resetTestData("debts-partial"); });

  test("E2E-LA-DETAIL-1: hero shows remaining derived from linked_amounts", async ({ page }) => {
    // Bạn Tùng: opening_amount=300k, total_repaid=150k → remaining=150k
    await openDebt(page, "Bạn Tùng");
    await expect(page.getByText(/150[.,]000/).first()).toBeVisible();
  });

  test("E2E-LA-DETAIL-2: opening row shows linked_amount (300k) with full amount (/ 900k) as secondary", async ({ page }) => {
    await openDebt(page, "Bạn Tùng");
    // linked_amount displayed prominently
    await expect(page.getByText(/300[.,]000/).first()).toBeVisible();
    // full tx amount shown as secondary "/ 900.000₫"
    await expect(page.getByText(/\/\s*900[.,]000/).first()).toBeVisible();
  });

  test("E2E-LA-DETAIL-3: repayment row shows linked_amount (150k) with full amount (/ 200k) as secondary", async ({ page }) => {
    await openDebt(page, "Bạn Tùng");
    // Repayment linked_amount
    await expect(page.getByText(/150[.,]000/).first()).toBeVisible();
    // Repayment full amount secondary
    await expect(page.getByText(/\/\s*200[.,]000/).first()).toBeVisible();
  });

  test("E2E-LA-DETAIL-4: progress bar uses opening_amount (300k), not full tx amount", async ({ page }) => {
    await openDebt(page, "Bạn Tùng");
    // The hero "Gốc X₫" text uses opening_amount
    await expect(page.getByText(/Gốc.*300[.,]000/).first()).toBeVisible();
  });
});
