import { beforeAll, describe, expect, it } from "vitest";
import { env, SELF } from "cloudflare:test";
import { applyMigrations, authHeaders, createTestSession, seedCategory, seedUser } from "./helpers";

let cookie1: string;
let cookie2: string;
let expenseCategoryId: number;
let incomeCategoryId: number;

const initialization = {
  ledgerStartDate: "2026-08-01",
  openingCash: 100,
  minimumCashReserve: 10,
  budget: {
    label: "Aug",
    startDate: "2026-08-01",
    endDate: "2026-08-31",
    plannedIncome: 1_000,
    savingsTarget: 200,
    spendingLimit: 800,
  },
};

beforeAll(async () => {
  await applyMigrations();
  await seedUser({ id: "http-u1", email: "http-u1@example.com" });
  await seedUser({ id: "http-u2", email: "http-u2@example.com" });
  cookie1 = await createTestSession("http-u1");
  cookie2 = await createTestSession("http-u2");
  expenseCategoryId = await seedCategory("http-u1", "Expense", null, 1);
  incomeCategoryId = await seedCategory("http-u1", "Income", null, 1);
  await env.DB.prepare("UPDATE category SET type='income' WHERE id=?")
    .bind(incomeCategoryId)
    .run();
});

describe("ledger Worker HTTP boundary", () => {
  it("rejects position creation before ledger initialization", async () => {
    const response = await SELF.fetch("http://localhost/api/positions", {
      method: "POST",
      headers: { ...authHeaders(cookie2), "Idempotency-Key": "position-before-profile" },
      body: JSON.stringify({ name: "Not initialized", kind: "term_deposit" }),
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "LEDGER_NOT_INITIALIZED" });
    const stored = await env.DB.prepare(
      "SELECT COUNT(*) count FROM financial_position WHERE user_id=?",
    ).bind("http-u2").first<{ count: number }>();
    expect(stored?.count).toBe(0);
  });

  it("requires authentication", async () => {
    const response = await SELF.fetch("http://localhost/api/ledger/summary?asOf=2026-08-17");
    expect(response.status).toBe(401);
  });

  it("requires an idempotency key", async () => {
    const response = await SELF.fetch("http://localhost/api/ledger/initialize", {
      method: "POST",
      headers: authHeaders(cookie1),
      body: JSON.stringify(initialization),
    });
    expect(response.status).toBe(400);
    expect(await response.json<{ code: string }>()).toMatchObject({ code: "IDEMPOTENCY_KEY_REQUIRED" });
  });

  it("rejects unknown fields and client-provided deltas", async () => {
    const response = await SELF.fetch("http://localhost/api/ledger/initialize", {
      method: "POST",
      headers: { ...authHeaders(cookie1), "Idempotency-Key": "strict" },
      body: JSON.stringify({ ...initialization, cash_delta: 100 }),
    });
    expect(response.status).toBe(400);
    expect(await response.json<{ code: string }>()).toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("replays the same key and conflicts on a changed payload", async () => {
    const request = (body: unknown) =>
      SELF.fetch("http://localhost/api/ledger/initialize", {
        method: "POST",
        headers: { ...authHeaders(cookie1), "Idempotency-Key": "retry" },
        body: JSON.stringify(body),
      });
    const first = await request(initialization);
    const replay = await request(initialization);
    const conflict = await request({ ...initialization, openingCash: 101 });

    expect(first.status).toBe(201);
    expect(await replay.json()).toEqual(await first.json());
    expect(conflict.status).toBe(409);
    expect(await conflict.json<{ code: string }>()).toMatchObject({ code: "IDEMPOTENCY_KEY_REUSED" });
  });

  it("returns not found for another user's position ID", async () => {
    await SELF.fetch("http://localhost/api/ledger/initialize", {
      method: "POST",
      headers: { ...authHeaders(cookie1), "Idempotency-Key": "isolation-init" },
      body: JSON.stringify(initialization),
    });
    const created = await SELF.fetch("http://localhost/api/positions", {
      method: "POST",
      headers: { ...authHeaders(cookie1), "Idempotency-Key": "isolation-position" },
      body: JSON.stringify({ name: "Private", kind: "term_deposit" }),
    });
    const body = await created.json<{ position: { id: string } }>();
    const response = await SELF.fetch(`http://localhost/api/positions/${body.position.id}`, {
      headers: authHeaders(cookie2),
    });
    expect(response.status).toBe(404);
    const patch = await SELF.fetch(`http://localhost/api/positions/${body.position.id}`, {
      method: "PATCH",
      headers: { ...authHeaders(cookie2), "Idempotency-Key": "cross-patch" },
      body: JSON.stringify({ name: "Stolen" }),
    });
    expect(patch.status).toBe(404);
    const movement = await SELF.fetch(`http://localhost/api/positions/${body.position.id}/fund`, {
      method: "POST",
      headers: { ...authHeaders(cookie2), "Idempotency-Key": "cross-fund" },
      body: JSON.stringify({ amount: 1, date: "2026-08-10" }),
    });
    expect(movement.status).toBe(404);
  });

  it("returns normalized position groups, detail actions, close settlement, and semantic aliases", async () => {
    const headers = (key: string) => ({ ...authHeaders(cookie1), "Idempotency-Key": key });
    await SELF.fetch("http://localhost/api/ledger/initialize", {
      method: "POST",
      headers: headers("positions-contract-init"),
      body: JSON.stringify(initialization),
    });
    const created = await SELF.fetch("http://localhost/api/positions", {
      method: "POST",
      headers: headers("positions-contract-create"),
      body: JSON.stringify({ name: "Lan", kind: "personal_receivable", counterparty: "Lan" }),
    });
    const position = await created.json<{ position: { id: string } }>();
    const lendRequest = () => SELF.fetch(`http://localhost/api/positions/${position.position.id}/lend`, {
      method: "POST",
      headers: headers("positions-contract-lend"),
      body: JSON.stringify({ amount: 75, date: "2026-08-10" }),
    });
    const lent = await lendRequest();
    const replay = await lendRequest();
    expect(lent.status).toBe(201);
    expect(await replay.json()).toEqual(await lent.json());

    const list = await SELF.fetch("http://localhost/api/positions?includeClosed=true", {
      headers: authHeaders(cookie1),
    });
    const listBody = await list.json<{
      groups: Array<{ code: string; positions: Array<Record<string, unknown>> }>;
      closedHistory: Array<Record<string, unknown>>;
    }>();
    expect(listBody.groups.find((group) => group.code === "owedToMe")).toMatchObject({
      positions: [expect.objectContaining({
        id: position.position.id,
        balance: 75,
        dueDate: null,
        latestActivityDate: "2026-08-10",
      })],
    });
    expect(listBody.closedHistory).toEqual([]);
    expect(JSON.stringify(listBody)).not.toMatch(/user_id|due_date|reserve_against_cash|created_at/);

    const detailBefore = await SELF.fetch(`http://localhost/api/positions/${position.position.id}`, {
      headers: authHeaders(cookie1),
    });
    expect(await detailBefore.json()).toMatchObject({
      position: { id: position.position.id, balance: 75 },
      closure: null,
      activities: [expect.objectContaining({ code: "moneyLent", label: "Đã cho vay" })],
      actions: expect.arrayContaining([
        { code: "collect", label: "Thu hồi", cashEffect: "receive", maxAmount: 75 },
        { code: "close", label: "Tất toán", cashEffect: "receive", maxAmount: 75 },
      ]),
    });

    const collected = await SELF.fetch(`http://localhost/api/positions/${position.position.id}/collect`, {
      method: "POST",
      headers: headers("positions-contract-collect"),
      body: JSON.stringify({ amount: 25, date: "2026-08-11" }),
    });
    expect(collected.status).toBe(201);
    const closed = await SELF.fetch(`http://localhost/api/positions/${position.position.id}/close`, {
      method: "POST",
      headers: headers("positions-contract-close"),
      body: JSON.stringify({ date: "2026-08-12" }),
    });
    expect(closed.status).toBe(201);

    const detailAfter = await SELF.fetch(`http://localhost/api/positions/${position.position.id}`, {
      headers: authHeaders(cookie1),
    });
    expect(await detailAfter.json()).toMatchObject({
      position: { status: "closed", balance: 0, closedAt: "2026-08-12" },
      closure: { date: "2026-08-12" },
      activities: expect.arrayContaining([
        expect.objectContaining({ code: "closeSettlement", isCloseSettlement: true, cashChange: 50 }),
      ]),
      actions: [],
    });
    const history = await SELF.fetch("http://localhost/api/positions?includeClosed=true", {
      headers: authHeaders(cookie1),
    });
    expect(await history.json()).toMatchObject({
      closedHistory: [expect.objectContaining({ id: position.position.id, closedAt: "2026-08-12" })],
    });
  });

  it("supports repay alias without disclosing positions across owners", async () => {
    const headers = (key: string) => ({ ...authHeaders(cookie1), "Idempotency-Key": key });
    await SELF.fetch("http://localhost/api/ledger/initialize", {
      method: "POST",
      headers: headers("repay-alias-init"),
      body: JSON.stringify(initialization),
    });
    const created = await SELF.fetch("http://localhost/api/positions", {
      method: "POST",
      headers: headers("repay-alias-create"),
      body: JSON.stringify({ name: "Payable", kind: "personal_payable" }),
    });
    const position = await created.json<{ position: { id: string } }>();
    await SELF.fetch(`http://localhost/api/positions/${position.position.id}/borrow`, {
      method: "POST",
      headers: headers("repay-alias-borrow"),
      body: JSON.stringify({ amount: 20, date: "2026-08-10" }),
    });
    const repay = await SELF.fetch(`http://localhost/api/positions/${position.position.id}/repay`, {
      method: "POST",
      headers: headers("repay-alias-repay"),
      body: JSON.stringify({ amount: 5, date: "2026-08-11" }),
    });
    expect(repay.status).toBe(201);
    const foreignRepay = await SELF.fetch(`http://localhost/api/positions/${position.position.id}/repay`, {
      method: "POST",
      headers: { ...authHeaders(cookie2), "Idempotency-Key": "foreign-repay" },
      body: JSON.stringify({ amount: 5, date: "2026-08-11" }),
    });
    expect(foreignRepay.status).toBe(404);
  });

  it("keeps zero-balance close and reversal lifecycle entries in position detail", async () => {
    const headers = (key: string) => ({ ...authHeaders(cookie1), "Idempotency-Key": key });
    await SELF.fetch("http://localhost/api/ledger/initialize", {
      method: "POST",
      headers: headers("lifecycle-init"),
      body: JSON.stringify(initialization),
    });
    const createdResponse = await SELF.fetch("http://localhost/api/positions", {
      method: "POST",
      headers: headers("lifecycle-create"),
      body: JSON.stringify({ name: "Zero lifecycle", kind: "term_deposit" }),
    });
    const created = await createdResponse.json<{ position: { id: string } }>();
    await SELF.fetch(`http://localhost/api/positions/${created.position.id}/close`, {
      method: "POST",
      headers: headers("lifecycle-close"),
      body: JSON.stringify({ date: "2026-08-10" }),
    });
    await SELF.fetch(`http://localhost/api/positions/${created.position.id}/close/reverse`, {
      method: "POST",
      headers: headers("lifecycle-reverse"),
      body: "{}",
    });

    const detailResponse = await SELF.fetch(`http://localhost/api/positions/${created.position.id}`, {
      headers: authHeaders(cookie1),
    });
    expect(detailResponse.status).toBe(200);
    expect(await detailResponse.json()).toMatchObject({
      closure: null,
      activities: [
        { type: "lifecycle", code: "positionClosed", settlementActivityId: null },
        { type: "lifecycle", code: "positionCloseReversed", reversalActivityId: null },
      ],
    });
  });

  it("preserves LEDGER_NOT_INITIALIZED on service 404 responses", async () => {
    const response = await SELF.fetch("http://localhost/api/positions", {
      headers: authHeaders(cookie2),
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "LEDGER_NOT_INITIALIZED" });
  });

  it("returns a stable sanitized trigger conflict without SQL internals", async () => {
    await SELF.fetch("http://localhost/api/ledger/initialize", {
      method: "POST",
      headers: { ...authHeaders(cookie1), "Idempotency-Key": "sanitized-init" },
      body: JSON.stringify(initialization),
    });
    const response = await SELF.fetch("http://localhost/api/budget-periods", {
      method: "POST",
      headers: { ...authHeaders(cookie1), "Idempotency-Key": "sanitized-overlap" },
      body: JSON.stringify({ label: "Overlap", startDate: "2026-08-10", endDate: "2026-09-10", plannedIncome: 100, savingsTarget: 0, spendingLimit: 100 }),
    });
    const body = await response.json<{ code: string; error: string }>();
    expect(response.status).toBe(409);
    expect(body).toEqual({ code: "LEDGER_PERIOD_OVERLAP", error: "Ledger write conflicted" });
    expect(JSON.stringify(body)).not.toMatch(/D1|SQL|INSERT|budget_period|binding|constraint/i);
  });

  it("rejects an HTTP refund before its expense date", async () => {
    await SELF.fetch("http://localhost/api/ledger/initialize", {
      method: "POST",
      headers: { ...authHeaders(cookie1), "Idempotency-Key": "http-refund-date-init" },
      body: JSON.stringify(initialization),
    });
    const expenseResponse = await SELF.fetch("http://localhost/api/financial-events/expense", {
      method: "POST",
      headers: { ...authHeaders(cookie1), "Idempotency-Key": "http-refund-date-expense" },
      body: JSON.stringify({ amount: 10, categoryId: expenseCategoryId, date: "2026-08-10" }),
    });
    const expense = await expenseResponse.json<{ event: { id: string } }>();
    const response = await SELF.fetch(`http://localhost/api/financial-events/${expense.event.id}/refunds`, {
      method: "POST",
      headers: { ...authHeaders(cookie1), "Idempotency-Key": "http-refund-date-early" },
      body: JSON.stringify({ amount: 1, date: "2026-08-09" }),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "REFUND_BEFORE_EXPENSE" });
  });

  it("round-trips budget, custom, refund, adjustment and close-reversal mutations", async () => {
    const headers = (key: string) => ({ ...authHeaders(cookie1), "Idempotency-Key": key });
    const initialized = await SELF.fetch("http://localhost/api/ledger/initialize", {
      method: "POST", headers: headers("flow-init"), body: JSON.stringify(initialization),
    });
    expect(initialized.status).toBe(201);
    const periods = await SELF.fetch("http://localhost/api/budget-periods", { headers: authHeaders(cookie1) });
    expect(periods.status).toBe(200);
    const period = (await periods.json<{ budgetPeriods: Array<{ id: number }> }>()).budgetPeriods[0];
    const newPeriod = await SELF.fetch("http://localhost/api/budget-periods", {
      method: "POST", headers: headers("flow-period-create"), body: JSON.stringify({ label: "Sep", startDate: "2026-09-01", endDate: "2026-09-30", plannedIncome: 100, savingsTarget: 0, spendingLimit: 100 }),
    });
    expect(newPeriod.status).toBe(201);
    const newPeriodBody = await newPeriod.json<{ budgetPeriod: { id: number } }>();
    const periodPatch = await SELF.fetch(`http://localhost/api/budget-periods/${newPeriodBody.budgetPeriod.id}`, {
      method: "PATCH", headers: headers("flow-period-patch"), body: JSON.stringify({ objective: "September" }),
    });
    expect(periodPatch.status).toBe(200);
    const periodAdjustment = await SELF.fetch(`http://localhost/api/budget-periods/${newPeriodBody.budgetPeriod.id}/adjustments`, {
      method: "POST", headers: headers("flow-period-adjust"), body: JSON.stringify({ target: "planned_income", delta: 10, note: "plan" }),
    });
    expect(periodAdjustment.status).toBe(201);
    const customResponse = await SELF.fetch(`http://localhost/api/budget-periods/${period.id}/custom-budgets`, {
      method: "POST", headers: headers("flow-custom"), body: JSON.stringify({ name: "Flow", amount: 50 }),
    });
    expect(customResponse.status).toBe(201);
    const custom = await customResponse.json<{ customBudget: { id: string } }>();
    const customPatch = await SELF.fetch(`http://localhost/api/ledger/custom-budgets/${custom.customBudget.id}`, {
      method: "PATCH", headers: headers("flow-custom-patch"), body: JSON.stringify({ name: "Flow renamed" }),
    });
    expect(customPatch.status).toBe(200);
    const customAdjustment = await SELF.fetch(`http://localhost/api/ledger/custom-budgets/${custom.customBudget.id}/adjustments`, {
      method: "POST", headers: headers("flow-custom-adjust"), body: JSON.stringify({ delta: 10, note: "capacity" }),
    });
    expect(customAdjustment.status).toBe(201);
    const expenseResponse = await SELF.fetch("http://localhost/api/financial-events/expense", {
      method: "POST", headers: headers("flow-expense"), body: JSON.stringify({ amount: 60, categoryId: expenseCategoryId, date: "2026-08-10", allocations: [{ customBudgetId: custom.customBudget.id, amount: 60 }] }),
    });
    expect(expenseResponse.status).toBe(201);
    const expense = await expenseResponse.json<{ event: { id: string } }>();
    const refundResponse = await SELF.fetch(`http://localhost/api/financial-events/${expense.event.id}/refunds`, {
      method: "POST", headers: headers("flow-refund"), body: JSON.stringify({ amount: 10, date: "2026-08-11" }),
    });
    expect(refundResponse.status).toBe(201);
    const incomeResponse = await SELF.fetch("http://localhost/api/financial-events/income", {
      method: "POST", headers: headers("flow-income"), body: JSON.stringify({ amount: 20, categoryId: incomeCategoryId, date: "2026-08-11" }),
    });
    expect(incomeResponse.status).toBe(201);
    const income = await incomeResponse.json<{ event: { id: string } }>();
    const incomeReversal = await SELF.fetch(`http://localhost/api/financial-events/${income.event.id}/reverse`, {
      method: "POST", headers: headers("flow-income-reverse"), body: "{}",
    });
    expect(incomeReversal.status).toBe(201);
    const reserve = await SELF.fetch("http://localhost/api/ledger/profile/adjustments", {
      method: "POST", headers: headers("flow-reserve"), body: JSON.stringify({ delta: 5, note: "reserve" }),
    });
    expect(reserve.status).toBe(201);
    const cashAdjustment = await SELF.fetch("http://localhost/api/reconciliation/cash-adjustments", {
      method: "POST", headers: headers("flow-cash"), body: JSON.stringify({ amount: 5, direction: "increase", note: "cash", date: "2026-08-12" }),
    });
    expect(cashAdjustment.status).toBe(201);
    const closableResponse = await SELF.fetch(`http://localhost/api/budget-periods/${period.id}/custom-budgets`, {
      method: "POST", headers: headers("flow-closable-custom"), body: JSON.stringify({ name: "Closable", amount: 15 }),
    });
    const closable = await closableResponse.json<{ customBudget: { id: string } }>();
    const closableExpenseResponse = await SELF.fetch("http://localhost/api/financial-events/expense", {
      method: "POST", headers: headers("flow-closable-expense"), body: JSON.stringify({ amount: 15, categoryId: expenseCategoryId, date: "2026-08-12", allocations: [{ customBudgetId: closable.customBudget.id, amount: 15 }] }),
    });
    const closableExpense = await closableExpenseResponse.json<{ event: { id: string } }>();
    const customClose = await SELF.fetch(`http://localhost/api/ledger/custom-budgets/${closable.customBudget.id}/close`, {
      method: "POST", headers: headers("flow-custom-close"), body: "{}",
    });
    expect(customClose.status).toBe(201);
    const customCorrection = await SELF.fetch(`http://localhost/api/financial-events/${closableExpense.event.id}/reverse`, {
      method: "POST", headers: headers("flow-custom-correction"), body: "{}",
    });
    expect(customCorrection.status).toBe(201);
    const positionResponse = await SELF.fetch("http://localhost/api/positions", {
      method: "POST", headers: headers("flow-position"), body: JSON.stringify({ name: "Deposit", kind: "term_deposit" }),
    });
    expect(positionResponse.status).toBe(201);
    const position = await positionResponse.json<{ position: { id: string } }>();
    const positionPatch = await SELF.fetch(`http://localhost/api/positions/${position.position.id}`, {
      method: "PATCH", headers: headers("flow-position-patch"), body: JSON.stringify({ counterparty: "Bank" }),
    });
    expect(positionPatch.status).toBe(200);
    const funded = await SELF.fetch(`http://localhost/api/positions/${position.position.id}/fund`, {
      method: "POST", headers: headers("flow-fund"), body: JSON.stringify({ amount: 20, date: "2026-08-12" }),
    });
    expect(funded.status).toBe(201);
    const positionAdjustment = await SELF.fetch("http://localhost/api/reconciliation/position-adjustments", {
      method: "POST", headers: headers("flow-position-adjust"), body: JSON.stringify({ positionId: position.position.id, amount: 2, direction: "decrease", note: "statement", date: "2026-08-12" }),
    });
    expect(positionAdjustment.status).toBe(201);
    const positionClose = await SELF.fetch(`http://localhost/api/positions/${position.position.id}/close`, {
      method: "POST", headers: headers("flow-close"), body: JSON.stringify({ date: "2026-08-13" }),
    });
    expect(positionClose.status).toBe(201);
    const closeReverse = await SELF.fetch(`http://localhost/api/positions/${position.position.id}/close/reverse`, {
      method: "POST", headers: headers("flow-close-reverse"), body: "{}",
    });
    expect(closeReverse.status).toBe(201);
    const summary = await SELF.fetch(`http://localhost/api/ledger/summary?asOf=2026-08-17&periodId=${period.id}`, { headers: authHeaders(cookie1) });
    expect(summary.status).toBe(200);
    expect(await summary.json()).toMatchObject({
      balances: { minimumCashReserve: 15 },
      activePeriod: { actual: { expense: 50 } },
    });
  });
});
