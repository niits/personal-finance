/**
 * E2E tests for Epic 4 — Debt Tracking
 *
 * Coverage:
 *   - API auth guards (unauthenticated)
 *   - API CRUD (authenticated via browser session cookie)
 *   - UI: overview, navigation, create, repayment, settle flows
 */

import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { resetTestData } from "../helpers";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:8787";

// ─── Auth cookie helper ───────────────────────────────────────────────────────

async function authHeaders(page: Page): Promise<Record<string, string>> {
  await page.goto("/");
  const cookies = await page.context().cookies();
  const session = cookies.find((c) => c.name.startsWith("better-auth"));
  return session ? { Cookie: `${session.name}=${session.value}` } : {};
}

/**
 * Open a debt's detail page from the overview and wait until it has finished
 * loading (the detail page shows "Đang tải..." until its async fetch resolves).
 * Centralising the wait removes the timing flakiness that affected the detail,
 * repayment, and settle flows.
 */
async function openDebt(page: Page, party: string) {
  await page.goto("/debts");
  await expect(page.getByText(party).first()).toBeVisible();
  await page.getByText(party).first().click();
  await expect(page).toHaveURL(/\/debts\/.+/);
  await expect(page.getByText("Lịch sử")).toBeVisible();
}

async function createDebt(
  request: APIRequestContext,
  headers: Record<string, string>,
  data: { type: "lend" | "borrow"; party: string; amount: number; note?: string; due_date?: string; date?: string },
) {
  const res = await request.post("/api/debts", {
    headers,
    data: {
      type: data.type,
      party: data.party,
      amount: data.amount,
      note: data.note ?? null,
      due_date: data.due_date ?? null,
      date: data.date ?? new Date().toISOString().slice(0, 10),
    },
  });
  expect(res.status()).toBe(201);
  return (await res.json() as { debt: { id: string; opening_amount: number; remaining: number; status: string; transactions: { id: number; is_opening: boolean }[] } }).debt;
}

// ─── Auth guards (native fetch — no cookies) ──────────────────────────────────

test.describe("Debts API — auth guards", () => {
  test("GET /api/debts returns 401", async () => {
    expect((await fetch(`${BASE_URL}/api/debts`)).status).toBe(401);
  });

  test("POST /api/debts returns 401", async () => {
    expect((await fetch(`${BASE_URL}/api/debts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "lend", party: "X", amount: 100000, date: "2026-05-01" }),
    })).status).toBe(401);
  });

  test("GET /api/debts/:id returns 401", async () => {
    expect((await fetch(`${BASE_URL}/api/debts/any-id`)).status).toBe(401);
  });

  test("PATCH /api/debts/:id returns 401", async () => {
    expect((await fetch(`${BASE_URL}/api/debts/any-id`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ party: "Y" }),
    })).status).toBe(401);
  });

  test("DELETE /api/debts/:id returns 401", async () => {
    expect((await fetch(`${BASE_URL}/api/debts/any-id`, { method: "DELETE" })).status).toBe(401);
  });

  test("PATCH /api/transactions/:id/link returns 401", async () => {
    expect((await fetch(`${BASE_URL}/api/transactions/1/link`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ debt_id: "x" }),
    })).status).toBe(401);
  });

  test("DELETE /api/transactions/:id/link returns 401", async () => {
    expect((await fetch(`${BASE_URL}/api/transactions/1/link`, { method: "DELETE" })).status).toBe(401);
  });
});

// ─── API: debt lifecycle ───────────────────────────────────────────────────────

test.describe("Debts API — lifecycle", () => {
  test.beforeAll(async () => { await resetTestData("minimal"); });

  test("POST /api/debts creates debt + opening transaction atomically", async ({ page, request }) => {
    const headers = await authHeaders(page);
    const debt = await createDebt(request, headers, { type: "lend", party: "Minh", amount: 1500000 });

    expect(debt.opening_amount).toBe(1500000);
    expect(debt.remaining).toBe(1500000);
    expect(debt.status).toBe("open");
    // opening_transaction_id must be set — verified via transactions list
    expect(debt.transactions).toHaveLength(1);
    expect(debt.transactions[0].is_opening).toBe(true);
  });

  test("GET /api/debts groups into lending / borrowing / settled", async ({ page, request }) => {
    const headers = await authHeaders(page);
    await createDebt(request, headers, { type: "borrow", party: "Bà Ngoại", amount: 500000 });

    const res = await request.get("/api/debts", { headers });
    const body = await res.json() as { lending: { party: string }[]; borrowing: { party: string }[]; settled: unknown[] };

    expect(body.lending.some((d) => d.party === "Minh")).toBe(true);
    expect(body.borrowing.some((d) => d.party === "Bà Ngoại")).toBe(true);
    expect(Array.isArray(body.settled)).toBe(true);
  });

  test("GET /api/debts/:id returns debt with transactions array", async ({ page, request }) => {
    const headers = await authHeaders(page);
    const list = await request.get("/api/debts", { headers });
    const { lending } = await list.json() as { lending: { id: string }[] };
    const debtId = lending[0].id;

    const res = await request.get(`/api/debts/${debtId}`, { headers });
    expect(res.status()).toBe(200);
    const body = await res.json() as {
      debt: { id: string; opening_amount: number; total_repaid: number; remaining: number; transactions: unknown[] }
    };
    expect(body.debt.id).toBe(debtId);
    expect(body.debt.opening_amount).toBeGreaterThan(0);
    expect(typeof body.debt.total_repaid).toBe("number");
    expect(Array.isArray(body.debt.transactions)).toBe(true);
  });

  test("PATCH /api/debts/:id updates party, note, due_date", async ({ page, request }) => {
    const headers = await authHeaders(page);
    const list = await request.get("/api/debts", { headers });
    const { lending } = await list.json() as { lending: { id: string }[] };
    const debtId = lending[0].id;

    const res = await request.patch(`/api/debts/${debtId}`, {
      headers,
      data: { party: "Minh Đức", note: "Sửa ghi chú", due_date: "2026-12-31" },
    });
    expect(res.status()).toBe(200);
    const body = await res.json() as { debt: { party: string; note: string; due_date: string } };
    expect(body.debt.party).toBe("Minh Đức");
    expect(body.debt.note).toBe("Sửa ghi chú");
    expect(body.debt.due_date).toBe("2026-12-31");
  });

  test("PATCH /api/debts/:id can settle a debt manually", async ({ page, request }) => {
    const headers = await authHeaders(page);
    const debt = await createDebt(request, headers, { type: "lend", party: "Tmp", amount: 100000 });

    const res = await request.patch(`/api/debts/${debt.id}`, {
      headers,
      data: { status: "settled" },
    });
    expect(res.status()).toBe(200);
    const body = await res.json() as { debt: { status: string } };
    expect(body.debt.status).toBe("settled");
  });

  test("DELETE /api/debts/:id removes debt and clears transaction debt_id", async ({ page, request }) => {
    const headers = await authHeaders(page);
    // Use a borrow debt (income opening): SET NULL keeps the transaction
    // CHECK-valid. Deleting a lend debt is a known schema defect — see
    // debt.test.ts INT-SCHEMA-6b. Fixed date keeps the tx inside the queried period.
    const debt = await createDebt(request, headers, { type: "borrow", party: "ToDelete", amount: 50000, date: "2026-05-10" });
    const openingTxId = debt.transactions[0].id;

    const del = await request.delete(`/api/debts/${debt.id}`, { headers });
    expect(del.status()).toBe(204);

    // Debt should be gone
    const get = await request.get(`/api/debts/${debt.id}`, { headers });
    expect(get.status()).toBe(404);

    // Opening transaction still exists but debt_id cleared
    const txRes = await request.get(`/api/transactions?month=2026-05`, { headers });
    const txBody = await txRes.json() as { transactions: { id: number; debt_id: string | null }[] };
    const openingTx = txBody.transactions.find((t) => t.id === openingTxId);
    expect(openingTx).toBeDefined();
    expect(openingTx?.debt_id).toBeNull();
  });
});

// ─── API: repayment via POST /api/transactions ────────────────────────────────

test.describe("Debts API — repayment via transactions", () => {
  test.beforeAll(async () => { await resetTestData("minimal"); });

  test("POST /api/transactions with debt_id creates a repayment", async ({ page, request }) => {
    const headers = await authHeaders(page);
    const debt = await createDebt(request, headers, { type: "lend", party: "Lan", amount: 2000000 });

    const res = await request.post("/api/transactions", {
      headers,
      data: {
        amount: 800000,
        type: "income",
        date: new Date().toISOString().slice(0, 10),
        debt_id: debt.id,
        note: "Trả lần 1",
      },
    });
    expect(res.status()).toBe(201);

    // Verify remaining updated
    const get = await request.get(`/api/debts/${debt.id}`, { headers });
    const body = await get.json() as { debt: { total_repaid: number; remaining: number; transactions: unknown[] } };
    expect(body.debt.total_repaid).toBe(800000);
    expect(body.debt.remaining).toBe(1200000);
    expect(body.debt.transactions).toHaveLength(2);
  });

  test("repayment on settled debt returns 400", async ({ page, request }) => {
    const headers = await authHeaders(page);
    const debt = await createDebt(request, headers, { type: "lend", party: "Settled", amount: 100000 });
    // Settle it
    await request.patch(`/api/debts/${debt.id}`, { headers, data: { status: "settled" } });

    const res = await request.post("/api/transactions", {
      headers,
      data: { amount: 50000, type: "income", date: "2026-05-01", debt_id: debt.id },
    });
    expect(res.status()).toBe(400);
  });
});

// ─── API: link / unlink ───────────────────────────────────────────────────────

test.describe("Debts API — link / unlink", () => {
  test.beforeAll(async () => { await resetTestData("budget"); });

  test("PATCH link attaches an existing transaction to a debt", async ({ page, request }) => {
    const headers = await authHeaders(page);

    // Create a standalone income transaction (no debt)
    const txRes = await request.post("/api/transactions", {
      headers,
      data: {
        amount: 200000, type: "income",
        category_id: await getIncomeCategoryId(request, headers),
        date: new Date().toISOString().slice(0, 10),
      },
    });
    const txBody = await txRes.json() as { transaction: { id: number } };
    const txId = txBody.transaction.id;

    // Create a lend debt
    const debt = await createDebt(request, headers, { type: "lend", party: "LinkTest", amount: 500000 });

    // Link the income tx as repayment
    const link = await request.patch(`/api/transactions/${txId}/link`, {
      headers,
      data: { debt_id: debt.id },
    });
    expect(link.status()).toBe(200);

    // Verify it shows in debt transactions
    const get = await request.get(`/api/debts/${debt.id}`, { headers });
    const body = await get.json() as { debt: { transactions: { id: number }[] } };
    expect(body.debt.transactions.some((t) => t.id === txId)).toBe(true);
  });

  test("PATCH link rejects wrong transaction type", async ({ page, request }) => {
    const headers = await authHeaders(page);

    // expense tx — cannot be linked as repayment to a lend debt (repayment must be income)
    const txRes = await request.post("/api/transactions", {
      headers,
      data: {
        amount: 100000, type: "expense",
        category_id: await getExpenseCategoryId(request, headers),
        date: new Date().toISOString().slice(0, 10),
      },
    });
    const txBody = await txRes.json() as { transaction: { id: number } };
    const txId = txBody.transaction.id;

    const debt = await createDebt(request, headers, { type: "lend", party: "WrongType", amount: 500000 });

    const link = await request.patch(`/api/transactions/${txId}/link`, {
      headers,
      data: { debt_id: debt.id },
    });
    expect(link.status()).toBe(409);
    const body = await link.json() as { reason: string };
    expect(body.reason).toBe("wrong_type");
  });

  test("PATCH link rejects already-linked transaction", async ({ page, request }) => {
    const headers = await authHeaders(page);
    const debt1 = await createDebt(request, headers, { type: "lend", party: "D1", amount: 300000 });
    const debt2 = await createDebt(request, headers, { type: "lend", party: "D2", amount: 300000 });

    // Try to link opening tx of debt1 to debt2 — it's already linked
    const openingTxId = debt1.transactions[0].id;
    const link = await request.patch(`/api/transactions/${openingTxId}/link`, {
      headers,
      data: { debt_id: debt2.id },
    });
    expect(link.status()).toBe(409);
    const body = await link.json() as { reason: string };
    expect(body.reason).toBe("already_linked");
  });

  test("DELETE link unlinks a repayment successfully", async ({ page, request }) => {
    const headers = await authHeaders(page);
    const debt = await createDebt(request, headers, { type: "lend", party: "UnlinkTest", amount: 1000000 });

    // Create repayment
    const repRes = await request.post("/api/transactions", {
      headers,
      data: { amount: 300000, type: "income", date: "2026-05-01", debt_id: debt.id },
    });
    const repBody = await repRes.json() as { transaction: { id: number } };
    const repId = repBody.transaction.id;

    const unlink = await request.delete(`/api/transactions/${repId}/link`, { headers });
    expect(unlink.status()).toBe(200);

    // Remaining should be back to full
    const get = await request.get(`/api/debts/${debt.id}`, { headers });
    const body = await get.json() as { debt: { remaining: number } };
    expect(body.debt.remaining).toBe(1000000);
  });

  test("DELETE link blocks unlinking opening tx when repayments exist", async ({ page, request }) => {
    const headers = await authHeaders(page);
    const debt = await createDebt(request, headers, { type: "lend", party: "GuardTest", amount: 500000 });

    // Add a repayment
    await request.post("/api/transactions", {
      headers,
      data: { amount: 100000, type: "income", date: "2026-05-01", debt_id: debt.id },
    });

    const openingTxId = debt.transactions[0].id;
    const unlink = await request.delete(`/api/transactions/${openingTxId}/link`, { headers });
    expect(unlink.status()).toBe(409);
    const body = await unlink.json() as { reason: string };
    expect(body.reason).toBe("opening_has_repayments");
  });
});

// ─── UI: Nợ tab overview ──────────────────────────────────────────────────────

test.describe("Debts UI — overview", () => {
  test.beforeAll(async () => { await resetTestData("minimal"); });

  test("shows Nợ heading and empty state", async ({ page }) => {
    await page.goto("/debts");
    await expect(page.getByRole("heading", { name: "Nợ" }).or(page.getByText("Nợ").first())).toBeVisible();
    await expect(page.getByText("Chưa có khoản nợ nào")).toBeVisible();
  });
});

test.describe("Debts UI — seeded overview", () => {
  test.beforeAll(async () => { await resetTestData("debts"); });

  test("shows Cho vay section with Minh card", async ({ page }) => {
    await page.goto("/debts");
    await expect(page.getByText("Cho vay", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("Minh").first()).toBeVisible();
  });

  test("shows Đi vay section with Chị Lan card", async ({ page }) => {
    await page.goto("/debts");
    await expect(page.getByText("Đi vay", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("Chị Lan").first()).toBeVisible();
  });

  test("shows summary tiles with totals", async ({ page }) => {
    await page.goto("/debts");
    // 2,000,000 − 500,000 = 1,500,000 remaining for Minh
    await expect(page.getByText(/1[.,]500[.,]000/).first()).toBeVisible();
  });

  test("shows settled section collapsed by default", async ({ page }) => {
    await page.goto("/debts");
    await expect(page.getByText(/Đã tất toán/)).toBeVisible();
    // Anh Tuấn hidden inside collapsed section
    await expect(page.getByText("Anh Tuấn")).not.toBeVisible();
  });

  test("expanding settled section reveals Anh Tuấn", async ({ page }) => {
    await page.goto("/debts");
    await page.getByText(/Đã tất toán/).click();
    await expect(page.getByText("Anh Tuấn")).toBeVisible();
  });

  test("tapping a debt card navigates to /debts/:id", async ({ page }) => {
    await page.goto("/debts");
    await page.getByText("Minh").first().click();
    await expect(page).toHaveURL(/\/debts\/.+/);
  });
});

// ─── UI: Debt detail page ─────────────────────────────────────────────────────

test.describe("Debts UI — detail page", () => {
  test.beforeAll(async () => { await resetTestData("debts"); });

  test("E2E-DETAIL-HERO: shows party, opening amount, and remaining balance", async ({ page }) => {
    await openDebt(page, "Minh");
    await expect(page.getByText("Minh")).toBeVisible();
    // Opening amount: 2,000,000
    await expect(page.getByText(/2[.,]000[.,]000/).first()).toBeVisible();
    // Remaining: 1,500,000
    await expect(page.getByText(/1[.,]500[.,]000/).first()).toBeVisible();
  });

  test("E2E-DETAIL-HIST: lists opening (Gốc) and repayment (Trả một phần) rows", async ({ page }) => {
    await openDebt(page, "Minh");
    // Opening tx + 1 repayment = 2 rows
    await expect(page.getByText("Gốc")).toBeVisible();
    await expect(page.getByText("Trả một phần")).toBeVisible();
  });

  test("E2E-DETAIL-ACTIONS: shows Ghi nhận thanh toán and Tất toán ngay buttons", async ({ page }) => {
    await openDebt(page, "Minh");
    await expect(page.getByRole("button", { name: /Ghi nhận thanh toán/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Tất toán/i })).toBeVisible();
  });

  test("E2E-DETAIL-BACK: back button returns to /debts", async ({ page }) => {
    await openDebt(page, "Minh");
    await page.getByRole("button", { name: "←" }).click();
    await expect(page).toHaveURL("/debts");
  });
});

// ─── UI: link existing transaction (GAP-1, not yet implemented) ───────────────
// Disabled until Task C builds LinkTransactionSheet (docs/specs/debt-tracking-fix-plan.md).
// The "debts" seed includes a standalone income "Lương tháng 5" (debt_id null),
// which is eligible to link as a repayment to the lend debt "Minh".

test.describe("Debts UI — link existing transaction (GAP-1)", () => {
  test.beforeAll(async () => { await resetTestData("debts"); });

  test.fixme("GAP-1: linking an existing transaction adds it to the debt history", async ({ page }) => {
    await openDebt(page, "Minh");

    // Opens the picker sheet (currently a no-op TODO in the detail page).
    await page.getByText("Liên kết giao dịch có sẵn").click();

    // Picker lists eligible (debt_id null, income) transactions; choose the salary.
    await page.getByText("Lương tháng 5").click();

    // The linked transaction now appears in "Lịch sử" and the balance updates.
    await expect(page.getByText("Lương tháng 5")).toBeVisible({ timeout: 5000 });
  });
});

// ─── UI: create debt via TransactionForm ──────────────────────────────────────

test.describe("Debts UI — create flow", () => {
  test.beforeAll(async () => { await resetTestData("minimal"); });

  test("FAB opens TransactionForm", async ({ page }) => {
    await page.goto("/debts");
    // FAB is the + button (fixed, positioned above bottom nav)
    await page.locator("button").filter({ hasText: "+" }).last().click();
    await expect(page.getByText("Giao dịch mới")).toBeVisible();
  });

  test("expanding Liên kết nợ section reveals Cho vay mới option", async ({ page }) => {
    await page.goto("/debts");
    await page.locator("button").filter({ hasText: "+" }).last().click();
    await expect(page.getByText("Giao dịch mới")).toBeVisible();

    // Tap the "Liên kết nợ" row to expand
    await page.getByText(/Liên kết nợ/).click();
    await expect(page.getByText("Cho vay mới")).toBeVisible();
  });

  test("creates a lend debt and shows it in overview", async ({ page }) => {
    await page.goto("/debts");
    await page.locator("button").filter({ hasText: "+" }).last().click();

    // Fill amount
    await page.locator('input[inputmode="numeric"]').fill("300000");

    // Select Chi tiêu (expense) — default — then expand debt section
    await page.getByText(/Liên kết nợ/).click();
    await page.getByText("Cho vay mới").click();

    // Fill party name
    await page.getByPlaceholder(/Cho vay ai|Tên người/).fill("Test Party");

    // Save
    await page.getByRole("button", { name: "Lưu" }).click();

    // New debt card appears
    await expect(page.getByText("Test Party")).toBeVisible({ timeout: 5000 });
  });
});

// ─── UI: repayment flow ───────────────────────────────────────────────────────

test.describe("Debts UI — repayment flow", () => {
  test.beforeAll(async () => { await resetTestData("debts"); });

  test("E2E-REPAY-1: Ghi nhận thanh toán opens TransactionForm in repayment mode", async ({ page }) => {
    await openDebt(page, "Minh");
    await page.getByRole("button", { name: /Ghi nhận thanh toán/i }).click();

    // Repayment form: shows title and debt context chip
    await expect(page.getByText("Ghi nhận thanh toán")).toBeVisible();
    await expect(page.getByText(/Minh/).first()).toBeVisible();
    // Amount pre-filled with remaining (1,500,000)
    await expect(page.locator('input[inputmode="numeric"]')).toHaveValue(/1[.,]?500[.,]?000|1500000/);
  });

  test("E2E-REPAY-2: submitting repayment updates remaining balance", async ({ page }) => {
    await openDebt(page, "Chị Lan");

    // Note current remaining (should be 1,000,000)
    await expect(page.getByText(/1[.,]000[.,]000/).first()).toBeVisible();

    // Record partial repayment
    await page.getByRole("button", { name: /Ghi nhận thanh toán/i }).click();
    const amountInput = page.locator('input[inputmode="numeric"]');
    await amountInput.fill("400000");
    await page.getByRole("button", { name: "Lưu" }).click();

    // Remaining should now be 600,000
    await expect(page.getByText(/600[.,]000/).first()).toBeVisible({ timeout: 5000 });
  });
});

// ─── UI: settle flow ──────────────────────────────────────────────────────────

test.describe("Debts UI — settle flow", () => {
  test.beforeAll(async () => { await resetTestData("debts"); });

  test("E2E-SETTLE-1: Tất toán ngay shows confirm dialog", async ({ page }) => {
    await openDebt(page, "Minh");
    await page.getByRole("button", { name: /Tất toán/i }).click();
    await expect(page.getByText(/Tất toán khoản nợ/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Xác nhận" })).toBeVisible();
  });

  test("E2E-SETTLE-2: confirming Tất toán settles the debt", async ({ page }) => {
    await openDebt(page, "Chị Lan");
    await page.getByRole("button", { name: /Tất toán/i }).click();
    await page.getByRole("button", { name: "Xác nhận" }).click();

    // The detail page reloads in place into its settled state: the settled
    // marker appears and the action buttons disappear (it does not navigate away).
    await expect(page.getByText(/Tất toán ✓/)).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: /Tất toán ngay/i })).toHaveCount(0);

    // And the debt now lives in the collapsed "Đã tất toán" section on the overview.
    await page.goto("/debts");
    await page.getByText(/Đã tất toán/).click();
    await expect(page.getByText("Chị Lan")).toBeVisible({ timeout: 5000 });
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getExpenseCategoryId(request: APIRequestContext, headers: Record<string, string>): Promise<number> {
  const res = await request.get("/api/categories", { headers });
  const body = await res.json() as { categories: { id: number; type: string; children: { id: number; children: { id: number }[] }[] }[] };
  const expenseCat = body.categories.find((c) => c.type === "expense");
  // Return deepest leaf
  const child = expenseCat?.children?.[0];
  const leaf = child?.children?.[0] ?? child;
  return leaf?.id ?? expenseCat?.id ?? 1;
}

async function getIncomeCategoryId(request: APIRequestContext, headers: Record<string, string>): Promise<number> {
  const res = await request.get("/api/categories", { headers });
  const body = await res.json() as { categories: { id: number; type: string; children: { id: number; children: { id: number }[] }[] }[] };
  const incomeCat = body.categories.find((c) => c.type === "income");
  const child = incomeCat?.children?.[0];
  const leaf = child?.children?.[0] ?? child;
  return leaf?.id ?? incomeCat?.id ?? 1;
}
