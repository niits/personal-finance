import { beforeAll, describe, expect, it } from "vitest";
import { env, SELF } from "cloudflare:test";
import {
  applyMigrations,
  authHeaders,
  createTestSession,
  seedCategory,
  seedMonthlyBudget,
  seedUser,
} from "./helpers";

const init = {
  ledgerStartDate: "2026-08-01",
  openingCash: 1_000,
  minimumCashReserve: 100,
  budget: {
    label: "August",
    startDate: "2026-08-01",
    endDate: "2026-08-31",
    plannedIncome: 2_000,
    savingsTarget: 500,
    spendingLimit: 1_500,
  },
  positions: [
    { name: "Visa", kind: "credit_card", balance: -200 },
    { name: "Deposit", kind: "term_deposit", balance: 300 },
  ],
};

let emptyCookie: string;
let legacyCookie: string;
let ledgerCookie: string;
let expenseCategoryId: number;
let incomeCategoryId: number;

async function request(path: string, cookie: string, options: RequestInit = {}) {
  return SELF.fetch(`http://localhost${path}`, {
    ...options,
    headers: { ...authHeaders(cookie), ...options.headers },
  });
}

async function initializeLedger(key: string) {
  const response = await request("/api/ledger/initialize", ledgerCookie, {
    method: "POST",
    headers: { "Idempotency-Key": key },
    body: JSON.stringify(init),
  });
  expect(response.status).toBe(201);
  return response.json<{
    budgetPeriod: { id: number };
    positions: Array<{ id: string; kind: string }>;
  }>();
}

beforeAll(async () => {
  await applyMigrations();
  for (const [id, email] of [
    ["boundary-empty", "boundary-empty@example.com"],
    ["boundary-legacy", "boundary-legacy@example.com"],
    ["boundary-ledger", "boundary-ledger@example.com"],
  ] as const) await seedUser({ id, email });
  emptyCookie = await createTestSession("boundary-empty");
  legacyCookie = await createTestSession("boundary-legacy");
  ledgerCookie = await createTestSession("boundary-ledger");
  await seedMonthlyBudget("boundary-legacy", "2026-08", 1_000);
  expenseCategoryId = await seedCategory("boundary-ledger", "Living", null, 1);
  incomeCategoryId = await seedCategory("boundary-ledger", "Salary", null, 1);
  await env.DB.prepare("UPDATE category SET type='income' WHERE id=?")
    .bind(incomeCategoryId)
    .run();
});

describe("ledger profile and safe fresh-start boundary", () => {
  it("distinguishes legacy-empty and legacy-data using financial tables only", async () => {
    await env.DB.prepare(
      "INSERT INTO category (user_id,name,level,sort_order,type) VALUES ('boundary-empty','Only config',1,0,'expense')",
    ).run();
    await env.DB.prepare(
      "INSERT INTO budget_config (user_id,default_monthly_amount,updated_at) VALUES ('boundary-empty',1000,unixepoch())",
    ).run();

    const empty = await request("/api/ledger/profile", emptyCookie);
    const legacy = await request("/api/ledger/profile", legacyCookie);

    expect(await empty.json()).toEqual({
      mode: "legacy-empty",
      legacyFinancialData: { hasData: false, transactionCount: 0, monthlyBudgetCount: 0, customBudgetCount: 0, debtCount: 0 },
      consentRequired: false,
      profile: null,
    });
    expect(await legacy.json()).toEqual({
      mode: "legacy-data",
      legacyFinancialData: { hasData: true, transactionCount: 0, monthlyBudgetCount: 1, customBudgetCount: 0, debtCount: 0 },
      consentRequired: true,
      profile: null,
    });
  });

  it("requires explicit legacy-data consent and persists archive consent without deleting legacy rows", async () => {
    const denied = await request("/api/ledger/initialize", legacyCookie, {
      method: "POST",
      headers: { "Idempotency-Key": "legacy-init-denied" },
      body: JSON.stringify(init),
    });
    expect(denied.status).toBe(409);
    expect(await denied.json()).toMatchObject({ code: "LEGACY_DATA_CONSENT_REQUIRED" });

    const accepted = await request("/api/ledger/initialize", legacyCookie, {
      method: "POST",
      headers: { "Idempotency-Key": "legacy-init-accepted" },
      body: JSON.stringify({ ...init, acceptLegacyDataFreshStart: true }),
    });
    expect(accepted.status).toBe(201);
    expect(await accepted.json()).toMatchObject({
      profile: {
        ledgerStartDate: "2026-08-01",
        minimumCashReserve: 100,
        legacyDataArchiveState: "preserved",
        legacyDataConsentAt: expect.any(Number),
      },
      budgetPeriod: { label: "August", startDate: "2026-08-01", effectiveSpendingLimit: 1_500 },
      positions: [
        expect.objectContaining({ inputIndex: 0, name: "Visa", kind: "credit_card", openingBalance: -200 }),
        expect.objectContaining({ inputIndex: 1, name: "Deposit", kind: "term_deposit", openingBalance: 300 }),
      ],
    });
    expect(await env.DB.prepare("SELECT COUNT(*) count FROM monthly_budget WHERE user_id='boundary-legacy'").first()).toEqual({ count: 1 });
  });

  it("does not require consent for a fresh user and rejects opposite-sign opening balances", async () => {
    const invalid = await request("/api/ledger/initialize", emptyCookie, {
      method: "POST",
      headers: { "Idempotency-Key": "bad-sign" },
      body: JSON.stringify({ ...init, positions: [{ name: "Bad card", kind: "credit_card", balance: 1 }] }),
    });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({ code: "VALIDATION_ERROR" });

    const accepted = await request("/api/ledger/initialize", emptyCookie, {
      method: "POST",
      headers: { "Idempotency-Key": "fresh-init" },
      body: JSON.stringify({ ...init, positions: [] }),
    });
    expect(accepted.status).toBe(201);
    expect(await accepted.json()).toMatchObject({
      profile: { legacyDataArchiveState: "not_applicable", legacyDataConsentAt: null },
      positions: [],
    });
  });
});

describe("normalized ledger read models", () => {
  it("returns summary with typed periodId, positive reserved card debt, and no storage fields", async () => {
    const initialization = await initializeLedger("read-init");
    const response = await request(
      `/api/ledger/summary?asOf=2026-08-17&periodId=${initialization.budgetPeriod.id}`,
      ledgerCookie,
    );
    const body = await response.json<Record<string, unknown>>();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      asOf: "2026-08-17",
      balances: {
        cash: 1_000,
        positions: 100,
        netWorth: 1_100,
        reservedCardDebt: 200,
        reservedPayables: -200,
        minimumCashReserve: 100,
        cashAfterCommitments: 700,
      },
      activePeriod: {
        id: initialization.budgetPeriod.id,
        plan: { plannedIncome: 2_000, savingsTarget: 500, spendingLimit: 1_500 },
        actual: { income: 0, expense: 0, savings: 0, remaining: 1_500 },
        allocationBreakdown: { customCapacity: 0, customSpent: 0, unallocatedExpense: 0, unassignedRemaining: 1_500, reconciledRemaining: 1_500 },
        customEnvelopes: [],
      },
      safeToSpend: 700,
    });
    expect(JSON.stringify(body)).not.toMatch(/user_id|write_key|created_at|effective_income|cashBalance|reservedPayables":200/);
  });

  it("joins and paginates the event feed while labeling principal movements as transfers", async () => {
    const initialization = await initializeLedger("feed-init");
    const card = initialization.positions.find((position) => position.kind === "credit_card")!;
    const period = initialization.budgetPeriod;
    const envelopeResponse = await request(`/api/budget-periods/${period.id}/custom-budgets`, ledgerCookie, {
      method: "POST", headers: { "Idempotency-Key": "feed-envelope" }, body: JSON.stringify({ name: "Food", amount: 100 }),
    });
    const envelope = await envelopeResponse.json<{ customBudget: { id: string } }>();
    const expenseResponse = await request("/api/financial-events/expense", ledgerCookie, {
      method: "POST", headers: { "Idempotency-Key": "feed-expense" },
      body: JSON.stringify({ amount: 50, categoryId: expenseCategoryId, positionId: card.id, date: "2026-08-10", allocations: [{ customBudgetId: envelope.customBudget.id, amount: 30 }] }),
    });
    const expense = await expenseResponse.json<{ event: { id: string } }>();
    await request(`/api/positions/${card.id}/pay`, ledgerCookie, {
      method: "POST", headers: { "Idempotency-Key": "feed-payment" }, body: JSON.stringify({ amount: 25, date: "2026-08-11" }),
    });

    const first = await request("/api/financial-events?from=2026-08-10&to=2026-08-11&limit=1", ledgerCookie);
    const firstBody = await first.json<{ events: Array<Record<string, unknown>>; pagination: { nextCursor: string | null } }>();
    expect(firstBody.events).toHaveLength(1);
    expect(firstBody.pagination.nextCursor).toEqual(expect.any(String));
    const second = await request(`/api/financial-events?from=2026-08-10&to=2026-08-11&limit=10&cursor=${firstBody.pagination.nextCursor}`, ledgerCookie);
    const events = [
      ...firstBody.events,
      ...(await second.json<{ events: Array<Record<string, unknown>> }>()).events,
    ];
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: expense.event.id,
        category: { id: expenseCategoryId, name: "Living", emoji: null, path: "Living" },
        position: { id: card.id, name: "Visa", kind: "credit_card" },
        allocations: [{ customBudgetId: envelope.customBudget.id, name: "Food", amount: 30 }],
        activity: { type: "expense", label: "Expense", actions: { canRefund: true, canReverse: true } },
      }),
      expect.objectContaining({
        position: { id: card.id, name: "Visa", kind: "credit_card" },
        activity: { type: "transfer", label: "Transfer", actions: { canRefund: false, canReverse: true } },
        effects: expect.objectContaining({ income: 0, expense: 0 }),
      }),
    ]));
    expect(JSON.stringify(events)).not.toMatch(/user_id|write_key|cash_delta|created_at/);
  });

  it("returns normalized period and envelope reconciliation and requires a profile", async () => {
    await initializeLedger("budget-read-init");
    const periods = await request("/api/budget-periods", ledgerCookie);
    const body = await periods.json<{ budgetPeriods: Array<Record<string, unknown>> }>();
    expect(body.budgetPeriods[0]).toMatchObject({
      label: "August",
      initial: { plannedIncome: 2_000, savingsTarget: 500, spendingLimit: 1_500 },
      effective: { plannedIncome: 2_000, savingsTarget: 500, spendingLimit: 1_500 },
      isLocked: false,
      capacity: expect.objectContaining({ reconciles: true }),
    });
    expect(JSON.stringify(body)).not.toMatch(/user_id|start_date|effectivePlannedIncome/);

    await seedUser({ id: "boundary-uninitialized", email: "boundary-uninitialized@example.com" });
    const cookie = await createTestSession("boundary-uninitialized");
    const missing = await request("/api/budget-periods", cookie);
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({ code: "LEDGER_NOT_INITIALIZED" });
  });

  it("reports remaining refundable expense and hides actions blocked by a closed position", async () => {
    const initialization = await initializeLedger("closed-feed-init");
    const card = initialization.positions.find((position) => position.kind === "credit_card")!;
    const expenseResponse = await request("/api/financial-events/expense", ledgerCookie, {
      method: "POST", headers: { "Idempotency-Key": "closed-feed-expense" },
      body: JSON.stringify({ amount: 50, categoryId: expenseCategoryId, positionId: card.id, date: "2026-08-10" }),
    });
    const expense = await expenseResponse.json<{ event: { id: string } }>();
    await request(`/api/financial-events/${expense.event.id}/refunds`, ledgerCookie, {
      method: "POST", headers: { "Idempotency-Key": "closed-feed-refund" },
      body: JSON.stringify({ amount: 10, date: "2026-08-11" }),
    });
    await request(`/api/positions/${card.id}/close`, ledgerCookie, {
      method: "POST", headers: { "Idempotency-Key": "closed-feed-close" },
      body: JSON.stringify({ date: "2026-08-12" }),
    });

    const feed = await request("/api/financial-events?from=2026-08-10&to=2026-08-12", ledgerCookie);
    const event = (await feed.json<{ events: Array<{ id: string; remainingRefundableAmount: number | null; activity: { actions: unknown } }> }>())
      .events.find((item) => item.id === expense.event.id);
    expect(event).toMatchObject({
      remainingRefundableAmount: 40,
      activity: { actions: { canRefund: false, canReverse: false } },
    });
  });
});

describe("cutover and category history guards", () => {
  it("rejects visible legacy writes after activation while legacy reads remain available", async () => {
    const monthly = await env.DB.prepare("INSERT INTO monthly_budget (user_id,month,amount) VALUES ('boundary-ledger','2026-09',100) RETURNING id").first<{ id: number }>();
    const custom = await env.DB.prepare("INSERT INTO custom_budget (user_id,name,amount) VALUES ('boundary-ledger','Archived',100) RETURNING id").first<{ id: number }>();
    const transaction = await env.DB.prepare("INSERT INTO \"transaction\" (user_id,amount,type,category_id,date) VALUES ('boundary-ledger',1,'income',?,'2026-08-10') RETURNING id").bind(incomeCategoryId).first<{ id: number }>();
    const initialized = await request("/api/ledger/initialize", ledgerCookie, {
      method: "POST", headers: { "Idempotency-Key": "cutover-init" },
      body: JSON.stringify({ ...init, acceptLegacyDataFreshStart: true }),
    });
    expect(initialized.status).toBe(201);
    for (const [path, method, body] of [
      ["/api/transactions", "POST", { amount: 1, type: "income", date: "2026-08-10", category_id: incomeCategoryId }],
      [`/api/transactions/${transaction!.id}`, "PATCH", { note: "blocked" }],
      [`/api/transactions/${transaction!.id}`, "DELETE", undefined],
      ["/api/monthly-budgets", "POST", { month: "2026-09", amount: 100 }],
      [`/api/monthly-budgets/${monthly!.id}`, "PATCH", { objective: "blocked" }],
      ["/api/custom-budgets", "POST", { name: "Legacy", amount: 100 }],
      [`/api/custom-budgets/${custom!.id}`, "PATCH", { name: "blocked" }],
      [`/api/custom-budgets/${custom!.id}`, "DELETE", undefined],
      ["/api/debts", "POST", { type: "lend", party: "Legacy", amount: 10, date: "2026-08-10" }],
    ] as const) {
      const response = await request(path, ledgerCookie, { method, body: body === undefined ? undefined : JSON.stringify(body) });
      expect(response.status, path).toBe(409);
      expect(await response.json(), path).toMatchObject({ code: "LEDGER_CUTOVER_ACTIVE" });
    }
    expect((await request("/api/transactions?month=2026-08", ledgerCookie)).status).toBe(200);
  });

  it("guards debt detail mutations after cutover", async () => {
    await env.DB.prepare("INSERT INTO debt (id,user_id,type,party,status) VALUES ('archived-detail','boundary-ledger','lend','Archived','open')").run();
    const initialized = await request("/api/ledger/initialize", ledgerCookie, {
      method: "POST", headers: { "Idempotency-Key": "debt-detail-cutover" },
      body: JSON.stringify({ ...init, acceptLegacyDataFreshStart: true }),
    });
    expect(initialized.status).toBe(201);
    for (const method of ["PATCH", "DELETE"] as const) {
      const response = await request("/api/debts/archived-detail", ledgerCookie, {
        method,
        body: method === "PATCH" ? JSON.stringify({ party: "Blocked" }) : undefined,
      });
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: "LEDGER_CUTOVER_ACTIVE" });
    }
  });

  it("requires leaf categories and reports both legacy and ledger usage on delete", async () => {
    await initializeLedger("category-init");
    const parentId = await seedCategory("boundary-ledger", "Parent", null, 1);
    await seedCategory("boundary-ledger", "Child", parentId, 2);
    const nonLeaf = await request("/api/financial-events/expense", ledgerCookie, {
      method: "POST", headers: { "Idempotency-Key": "non-leaf" },
      body: JSON.stringify({ amount: 1, categoryId: parentId, date: "2026-08-12" }),
    });
    expect(nonLeaf.status).toBe(400);
    expect(await nonLeaf.json()).toMatchObject({ code: "CATEGORY_NOT_LEAF" });

    await request("/api/financial-events/expense", ledgerCookie, {
      method: "POST", headers: { "Idempotency-Key": "category-history" },
      body: JSON.stringify({ amount: 1, categoryId: expenseCategoryId, date: "2026-08-12" }),
    });
    const deletion = await request(`/api/categories/${expenseCategoryId}`, ledgerCookie, { method: "DELETE" });
    expect(deletion.status).toBe(409);
    expect(await deletion.json()).toMatchObject({
      code: "CATEGORY_IN_USE",
      details: { legacyTransactionCount: 0, ledgerEventCount: 1, totalUsageCount: 1 },
    });
  });
});
