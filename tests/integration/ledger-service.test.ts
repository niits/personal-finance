import { beforeAll, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { LedgerService, LedgerServiceError } from "../../src/lib/ledger/service";
import { applyMigrations, seedCategory, seedUser } from "./helpers";

let expenseCategoryId: number;
let incomeCategoryId: number;

const initialization = {
  ledgerStartDate: "2026-08-01",
  openingCash: 1_000,
  minimumCashReserve: 100,
  budget: {
    label: "Aug",
    startDate: "2026-08-01",
    endDate: "2026-08-31",
    plannedIncome: 2_000,
    savingsTarget: 500,
    spendingLimit: 1_500,
  },
};

beforeAll(async () => {
  await applyMigrations();
  await seedUser({ id: "service-u1", email: "service-u1@example.com" });
  await seedUser({ id: "service-u2", email: "service-u2@example.com" });
  expenseCategoryId = await seedCategory("service-u1", "Expense", null, 1);
  incomeCategoryId = await seedCategory("service-u1", "Income", null, 1);
  await env.DB.prepare("UPDATE category SET type='income' WHERE id=?")
    .bind(incomeCategoryId)
    .run();
});

describe("LedgerService initialization and idempotency", () => {
  it("rejects position creation before the financial profile exists", async () => {
    const service = new LedgerService(env.DB);

    await expect(service.createPosition(
      { userId: "service-u2", idempotencyKey: "position-before-profile" },
      { name: "Not initialized", kind: "term_deposit" },
    )).rejects.toMatchObject({ status: 404, code: "LEDGER_NOT_INITIALIZED" });
    const stored = await env.DB.prepare(
      "SELECT COUNT(*) count FROM financial_position WHERE user_id=?",
    ).bind("service-u2").first<{ count: number }>();
    expect(stored?.count).toBe(0);
  });

  it("rejects a missing idempotency key before state validation", async () => {
    const service = new LedgerService(env.DB);
    await expect(
      service.initialize({ userId: "service-u1", idempotencyKey: "" }, {}),
    ).rejects.toMatchObject({ status: 400, code: "IDEMPOTENCY_KEY_REQUIRED" });
  });

  it("replays an identical initialization and rejects a changed payload", async () => {
    const service = new LedgerService(env.DB);
    const context = { userId: "service-u1", idempotencyKey: "initialize" };
    const first = await service.initialize(context, initialization);
    const retry = await service.initialize(context, initialization);

    expect(retry).toEqual(first);
    await expect(
      service.initialize(context, { ...initialization, openingCash: 2_000 }),
    ).rejects.toMatchObject<Partial<LedgerServiceError>>({
      status: 409,
      code: "IDEMPOTENCY_KEY_REUSED",
    });
    const events = await service.listEvents("service-u1");
    expect(events).toHaveLength(1);
  });

  it("makes concurrent duplicate claims converge on one stored response", async () => {
    const service = new LedgerService(env.DB);
    const context = { userId: "service-u1", idempotencyKey: "parallel-init" };
    const [left, right] = await Promise.all([
      service.initialize(context, initialization),
      service.initialize(context, initialization),
    ]);

    expect(right).toEqual(left);
    const claim = await env.DB.prepare(
      "SELECT COUNT(*) count FROM financial_write_request WHERE user_id=? AND idempotency_key=?",
    )
      .bind("service-u1", "parallel-init")
      .first<{ count: number }>();
    expect(claim?.count).toBe(1);
  });
});

describe("LedgerService committed vertical slice", () => {
  it("records cash income and expense and derives summary from committed events", async () => {
    const service = new LedgerService(env.DB);
    await service.initialize(
      { userId: "service-u1", idempotencyKey: "summary-init" },
      initialization,
    );
    await service.appendIncome(
      { userId: "service-u1", idempotencyKey: "income" },
      { amount: 500, categoryId: incomeCategoryId, date: "2026-08-10" },
    );
    const period = await env.DB.prepare(
      "SELECT id FROM budget_period WHERE user_id='service-u1' AND label='Aug'",
    ).first<{ id: number }>();
    await env.DB.prepare(
      "INSERT INTO ledger_custom_budget (id,user_id,budget_period_id,name,amount) VALUES ('summary-envelope','service-u1',?,'Envelope',300)",
    )
      .bind(period!.id)
      .run();
    await service.appendExpense(
      { userId: "service-u1", idempotencyKey: "expense" },
      {
        amount: 200,
        categoryId: expenseCategoryId,
        date: "2026-08-11",
        allocations: [{ customBudgetId: "summary-envelope", amount: 100 }],
      },
    );
    await env.DB.prepare(
      "INSERT INTO financial_event (id,user_id,write_key,kind,amount,cash_delta,income_delta,category_id,date) VALUES ('uncommitted','service-u1','income','income_cash',999,999,999,?,'2026-08-12')",
    )
      .bind(incomeCategoryId)
      .run();

    const summary = await service.summary("service-u1", "2026-08-17", "Aug");
    expect(summary).toMatchObject({
      cashBalance: 1_300,
      netWorth: 1_300,
      cashAfterCommitments: 1_200,
      safeToSpend: 1_200,
      period: {
        income: 500,
        expense: 200,
        actualSavings: 300,
        budgetRemaining: 1_300,
        periodUnallocatedExpense: 100,
        periodUnassignedRemaining: 1_100,
        customEnvelopes: [{
          id: "summary-envelope",
          name: "Envelope",
          effectiveAmount: 300,
          spent: 100,
          remaining: 200,
        }],
      },
    });
    expect(await service.listEvents("service-u1")).toHaveLength(3);
  });

  it("supports card expense, payment, and full signed close", async () => {
    const service = new LedgerService(env.DB);
    const initialized = await service.initialize(
      { userId: "service-u1", idempotencyKey: "card-init" },
      {
        ...initialization,
        positions: [{ name: "Card", kind: "credit_card", balance: -200 }],
      },
    );
    const cardId = initialized.positionIds[0];
    await service.appendExpense(
      { userId: "service-u1", idempotencyKey: "card-expense" },
      { amount: 100, categoryId: expenseCategoryId, positionId: cardId, date: "2026-08-10" },
    );
    await service.movePosition(
      { userId: "service-u1", idempotencyKey: "card-payment" },
      cardId,
      "pay",
      { amount: 50, date: "2026-08-11" },
    );
    const closed = await service.closePosition(
      { userId: "service-u1", idempotencyKey: "card-close" },
      cardId,
      { date: "2026-08-12" },
    );

    expect(closed.closure.settlementEventId).toBeTruthy();
    expect((await service.positionDetail("service-u1", cardId)).position.balance).toBe(0);
  });

  it("supports term-deposit funding and Close while isolating users", async () => {
    const service = new LedgerService(env.DB);
    await service.initialize(
      { userId: "service-u1", idempotencyKey: "deposit-init" },
      initialization,
    );
    const created = await service.createPosition(
      { userId: "service-u1", idempotencyKey: "deposit-create" },
      { name: "Deposit", kind: "term_deposit" },
    );
    await service.movePosition(
      { userId: "service-u1", idempotencyKey: "deposit-fund" },
      created.position.id,
      "fund",
      { amount: 300, date: "2026-08-10" },
    );
    await service.closePosition(
      { userId: "service-u1", idempotencyKey: "deposit-close" },
      created.position.id,
      { date: "2026-08-11" },
    );

    await expect(service.listPositions("service-u2")).rejects.toMatchObject({
      status: 404,
      code: "LEDGER_NOT_INITIALIZED",
    });
    await expect(service.positionDetail("service-u2", created.position.id)).rejects.toMatchObject({
      status: 404,
    });
  });

  it("binds movement and Close idempotency to the URL position ID", async () => {
    const service = new LedgerService(env.DB);
    await service.initialize(
      { userId: "service-u1", idempotencyKey: "resource-init" },
      initialization,
    );
    const first = await service.createPosition(
      { userId: "service-u1", idempotencyKey: "resource-create-1" },
      { name: "First", kind: "term_deposit" },
    );
    const second = await service.createPosition(
      { userId: "service-u1", idempotencyKey: "resource-create-2" },
      { name: "Second", kind: "term_deposit" },
    );
    const movementContext = { userId: "service-u1", idempotencyKey: "same-movement" };
    await service.movePosition(movementContext, first.position.id, "fund", {
      amount: 10,
      date: "2026-08-10",
    });
    await expect(
      service.movePosition(movementContext, second.position.id, "fund", {
        amount: 10,
        date: "2026-08-10",
      }),
    ).rejects.toMatchObject({ status: 409, code: "IDEMPOTENCY_KEY_REUSED" });

    const closeContext = { userId: "service-u1", idempotencyKey: "same-close" };
    await service.closePosition(closeContext, first.position.id, { date: "2026-08-11" });
    await expect(
      service.closePosition(closeContext, second.position.id, { date: "2026-08-11" }),
    ).rejects.toMatchObject({ status: 409, code: "IDEMPOTENCY_KEY_REUSED" });
  });

  it("rejects opposite opening signs and prevents ordinary movements crossing zero", async () => {
    const service = new LedgerService(env.DB);
    await expect(service.initialize(
      { userId: "service-u1", idempotencyKey: "invalid-opening-sign" },
      { ...initialization, positions: [{ name: "Positive card", kind: "credit_card", balance: 10 }] },
    )).rejects.toMatchObject({ status: 400, code: "VALIDATION_ERROR" });
    const initialized = await service.initialize(
      { userId: "service-u1", idempotencyKey: "sign-init" },
      {
        ...initialization,
        positions: [
          { name: "Normal deposit", kind: "term_deposit", balance: 20 },
          { name: "Normal card", kind: "credit_card", balance: -20 },
        ],
      },
    );
    const [normalDeposit, normalCard] = initialized.positionIds;
    await expect(
      service.movePosition(
        { userId: "service-u1", idempotencyKey: "cross-deposit" },
        normalDeposit,
        "withdraw",
        { amount: 21, date: "2026-08-10" },
      ),
    ).rejects.toMatchObject({ status: 409, code: "POSITION_OVERPAYMENT" });
    await expect(
      service.movePosition(
        { userId: "service-u1", idempotencyKey: "cross-card" },
        normalCard,
        "pay",
        { amount: 21, date: "2026-08-10" },
      ),
    ).rejects.toMatchObject({ status: 409, code: "POSITION_OVERPAYMENT" });

  });

  it("rejects activity after Close", async () => {
    const service = new LedgerService(env.DB);
    await service.initialize(
      { userId: "service-u1", idempotencyKey: "closed-init" },
      initialization,
    );
    const created = await service.createPosition(
      { userId: "service-u1", idempotencyKey: "closed-create" },
      { name: "Closed", kind: "term_deposit" },
    );
    await expect(
      service.closePosition(
        { userId: "service-u1", idempotencyKey: "pre-start-close" },
        created.position.id,
        { date: "2026-07-31" },
      ),
    ).rejects.toMatchObject({ status: 400, code: "CLOSE_BEFORE_LEDGER_START" });
    await service.closePosition(
      { userId: "service-u1", idempotencyKey: "closed-close" },
      created.position.id,
      { date: "2026-08-10" },
    );
    await expect(
      service.movePosition(
        { userId: "service-u1", idempotencyKey: "closed-fund" },
        created.position.id,
        "fund",
        { amount: 1, date: "2026-08-11" },
      ),
    ).rejects.toMatchObject({ status: 409, code: "POSITION_CLOSED" });
  });

  it("returns null zero-income savings rate and the adjusted target gap", async () => {
    const service = new LedgerService(env.DB);
    await service.initialize(
      { userId: "service-u1", idempotencyKey: "savings-init" },
      { ...initialization, openingCash: 0 },
    );
    const period = await env.DB.prepare(
      "SELECT id FROM budget_period WHERE user_id='service-u1' AND label='Aug'",
    ).first<{ id: number }>();
    await env.DB.prepare(
      "INSERT INTO ledger_budget_adjustment (id,budget_period_id,user_id,target,delta,note,write_key) VALUES ('income-adjustment',?,'service-u1','planned_income',100,'raise income','savings-init')",
    )
      .bind(period!.id)
      .run();
    await env.DB.prepare(
      "INSERT INTO ledger_budget_adjustment (id,budget_period_id,user_id,target,delta,note,write_key) VALUES ('savings-adjustment',?,'service-u1','savings_target',100,'raise target','savings-init')",
    )
      .bind(period!.id)
      .run();

    const summary = await service.summary("service-u1", "2026-08-17", "Aug");
    expect(summary.period).toMatchObject({
      income: 0,
      actualSavings: 0,
      savingsRate: null,
      savingsTargetGap: 600,
    });
  });
});

describe("LedgerService omitted backend completion", () => {
  it("rejects refunds before the original expense and preserves as-of expense totals", async () => {
    const service = new LedgerService(env.DB);
    await service.initialize({ userId: "service-u1", idempotencyKey: "refund-date-init" }, initialization);
    const expense = await service.appendExpense(
      { userId: "service-u1", idempotencyKey: "refund-date-expense" },
      { amount: 100, categoryId: expenseCategoryId, date: "2026-08-10" },
    );
    await expect(service.refundEvent(
      { userId: "service-u1", idempotencyKey: "refund-date-early" },
      expense.event.id,
      { amount: 10, date: "2026-08-09" },
    )).rejects.toMatchObject({ status: 400, code: "REFUND_BEFORE_EXPENSE" });
    await service.refundEvent(
      { userId: "service-u1", idempotencyKey: "refund-date-valid" },
      expense.event.id,
      { amount: 10, date: "2026-08-11" },
    );
    expect(await service.summary("service-u1", "2026-08-10", "Aug")).toMatchObject({ period: { expense: 100 } });
    expect(await service.summary("service-u1", "2026-08-11", "Aug")).toMatchObject({ period: { expense: 90 } });
  });

  it("serializes concurrent refunds into canonical incremental allocations", async () => {
    const service = new LedgerService(env.DB);
    await service.initialize({ userId: "service-u1", idempotencyKey: "refund-race-init" }, initialization);
    const period = (await service.listBudgetPeriods("service-u1"))[0] as { id: number };
    const custom = await service.createCustomBudget(
      { userId: "service-u1", idempotencyKey: "refund-race-custom" }, period.id,
      { name: "Race", amount: 6 },
    );
    const expense = await service.appendExpense(
      { userId: "service-u1", idempotencyKey: "refund-race-expense" },
      { amount: 10, categoryId: expenseCategoryId, date: "2026-08-10", allocations: [{ customBudgetId: custom.customBudget.id, amount: 6 }] },
    );
    const [first, second] = await Promise.all([
      service.refundEvent({ userId: "service-u1", idempotencyKey: "refund-race-a" }, expense.event.id, { amount: 3, date: "2026-08-11" }),
      service.refundEvent({ userId: "service-u1", idempotencyKey: "refund-race-b" }, expense.event.id, { amount: 3, date: "2026-08-11" }),
    ]);
    const rows = await env.DB.prepare("SELECT id,refund_prior_total FROM financial_event WHERE id IN (?,?) ORDER BY refund_prior_total").bind(first.event.id, second.event.id).all<{ id: string; refund_prior_total: number }>();
    expect(rows.results.map((row) => row.refund_prior_total)).toEqual([0, 3]);
    const allocations = await env.DB.prepare("SELECT allocated_expense_delta FROM financial_event_custom_budget_allocation WHERE financial_event_id IN (?,?) ORDER BY financial_event_id").bind(first.event.id, second.event.id).all<{ allocated_expense_delta: number }>();
    expect(allocations.results.map((row) => row.allocated_expense_delta).sort()).toEqual([-2, -2]);
  });

  it("allocates sequential refunds from remaining capacity after a prior refund reversal", async () => {
    const service = new LedgerService(env.DB);
    await service.initialize(
      { userId: "service-u1", idempotencyKey: "refund-init" },
      initialization,
    );
    const period = (await service.listBudgetPeriods("service-u1"))[0] as { id: number };
    const a = await service.createCustomBudget(
      { userId: "service-u1", idempotencyKey: "refund-custom-a" },
      period.id,
      { name: "A", amount: 1 },
    );
    const b = await service.createCustomBudget(
      { userId: "service-u1", idempotencyKey: "refund-custom-b" },
      period.id,
      { name: "B", amount: 3 },
    );
    const expense = await service.appendExpense(
      { userId: "service-u1", idempotencyKey: "refund-expense" },
      {
        amount: 7,
        categoryId: expenseCategoryId,
        date: "2026-08-10",
        allocations: [
          { customBudgetId: a.customBudget.id, amount: 1 },
          { customBudgetId: b.customBudget.id, amount: 3 },
        ],
      },
    );
    const first = await service.refundEvent(
      { userId: "service-u1", idempotencyKey: "refund-first" },
      expense.event.id,
      { amount: 1, date: "2026-08-11" },
    );
    await service.reverseEvent(
      { userId: "service-u1", idempotencyKey: "refund-first-reverse" },
      first.event.id,
      {},
    );
    const second = await service.refundEvent(
      { userId: "service-u1", idempotencyKey: "refund-second" },
      expense.event.id,
      { amount: 2, date: "2026-08-12" },
    );
    await service.refundEvent(
      { userId: "service-u1", idempotencyKey: "refund-third" },
      expense.event.id,
      { amount: 1, date: "2026-08-13" },
    );

    const allocations = await env.DB.prepare(
      "SELECT allocated_expense_delta FROM financial_event_custom_budget_allocation WHERE financial_event_id=? AND custom_budget_id=?",
    )
      .bind(second.event.id, b.customBudget.id)
      .first<{ allocated_expense_delta: number }>();
    expect(allocations?.allocated_expense_delta).toBe(-1);
    const activeRefundTotal = await env.DB.prepare(`SELECT SUM(r.amount) total FROM financial_event r JOIN financial_event_commit rc ON rc.event_id=r.id WHERE r.related_event_id=? AND NOT EXISTS (SELECT 1 FROM financial_event reversal JOIN financial_event_commit reversal_commit ON reversal_commit.event_id=reversal.id WHERE reversal.reversal_of_event_id=r.id)`).bind(expense.event.id).first<{ total: number }>();
    expect(activeRefundTotal?.total).toBe(3);
  });

  it("uses effective profile, budget and custom adjustments and corrects custom closure on reversal", async () => {
    const service = new LedgerService(env.DB);
    await service.initialize(
      { userId: "service-u1", idempotencyKey: "adjust-init" },
      initialization,
    );
    const period = (await service.listBudgetPeriods("service-u1"))[0] as { id: number };
    await service.adjustReserve(
      { userId: "service-u1", idempotencyKey: "reserve-adjust" },
      { delta: 50, note: "reserve" },
    );
    await service.adjustBudgetPeriod(
      { userId: "service-u1", idempotencyKey: "income-plan-adjust" },
      period.id,
      { target: "planned_income", delta: 100, note: "income" },
    );
    await service.adjustBudgetPeriod(
      { userId: "service-u1", idempotencyKey: "savings-plan-adjust" },
      period.id,
      { target: "savings_target", delta: 50, note: "savings" },
    );
    const custom = await service.createCustomBudget(
      { userId: "service-u1", idempotencyKey: "close-custom-create" },
      period.id,
      { name: "Closable", amount: 100 },
    );
    const expense = await service.appendExpense(
      { userId: "service-u1", idempotencyKey: "close-custom-expense" },
      {
        amount: 100,
        categoryId: expenseCategoryId,
        date: "2026-08-10",
        allocations: [{ customBudgetId: custom.customBudget.id, amount: 100 }],
      },
    );
    await service.closeCustomBudget(
      { userId: "service-u1", idempotencyKey: "close-custom" },
      custom.customBudget.id,
      {},
    );
    await service.reverseEvent(
      { userId: "service-u1", idempotencyKey: "close-custom-correction" },
      expense.event.id,
      {},
    );

    const summary = await service.summary("service-u1", "2026-08-17", "Aug");
    expect(summary).toMatchObject({
      minimumCashReserve: 150,
      period: { effective_income: 2_100, effective_savings: 550, expense: 0 },
    });
    const listed = await service.listCustomBudgets("service-u1", period.id) as Array<{
      id: string; closed: number; effectiveAmount: number; spent: number;
    }>;
    expect(listed.find((item) => item.id === custom.customBudget.id)).toMatchObject({
      closed: 0,
      effectiveAmount: 100,
      spent: 0,
    });
  });

  it("reverses zero and nonzero position closes append-only", async () => {
    const service = new LedgerService(env.DB);
    await service.initialize(
      { userId: "service-u1", idempotencyKey: "close-reverse-init" },
      initialization,
    );
    const zero = await service.createPosition(
      { userId: "service-u1", idempotencyKey: "zero-position" },
      { name: "Zero", kind: "term_deposit" },
    );
    await service.closePosition(
      { userId: "service-u1", idempotencyKey: "zero-close" },
      zero.position.id,
      { date: "2026-08-10" },
    );
    const zeroReversal = await service.reversePositionClose(
      { userId: "service-u1", idempotencyKey: "zero-close-reverse" },
      zero.position.id,
      {},
    );
    expect(zeroReversal.closureReversal.reversalEventId).toBeNull();
    expect((await service.positionDetail("service-u1", zero.position.id)).activities).toEqual([
      expect.objectContaining({
        type: "lifecycle",
        code: "positionClosed",
        closureId: zeroReversal.closureReversal.closureId,
        settlementActivityId: null,
      }),
      expect.objectContaining({
        type: "lifecycle",
        code: "positionCloseReversed",
        closureId: zeroReversal.closureReversal.closureId,
        reversalActivityId: null,
      }),
    ]);

    const funded = await service.createPosition(
      { userId: "service-u1", idempotencyKey: "funded-position" },
      { name: "Funded", kind: "term_deposit" },
    );
    await service.movePosition(
      { userId: "service-u1", idempotencyKey: "funded-move" },
      funded.position.id,
      "fund",
      { amount: 20, date: "2026-08-10" },
    );
    await service.closePosition(
      { userId: "service-u1", idempotencyKey: "funded-close" },
      funded.position.id,
      { date: "2026-08-11" },
    );
    const reversal = await service.reversePositionClose(
      { userId: "service-u1", idempotencyKey: "funded-close-reverse" },
      funded.position.id,
      {},
    );
    expect(reversal.closureReversal.reversalEventId).toBeTruthy();
    const fundedDetail = await service.positionDetail("service-u1", funded.position.id);
    expect(fundedDetail.position.balance).toBe(20);
    expect(fundedDetail.activities).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "financial", code: "closeSettlement", isCloseSettlement: true }),
      expect.objectContaining({
        type: "lifecycle",
        code: "positionClosed",
        settlementActivityId: expect.any(String),
      }),
      expect.objectContaining({ type: "financial", code: "correction" }),
      expect.objectContaining({
        type: "lifecycle",
        code: "positionCloseReversed",
        reversalActivityId: reversal.closureReversal.reversalEventId,
      }),
    ]));
  });

  it("returns a deterministic domain error when position aggregates exceed safe integers", async () => {
    const service = new LedgerService(env.DB);
    const initialized = await service.initialize(
      { userId: "service-u1", idempotencyKey: "position-overflow-init" },
      {
        ...initialization,
        openingCash: 0,
        positions: [{ name: "Huge", kind: "term_deposit", balance: Number.MAX_SAFE_INTEGER }],
      },
    );
    await service.movePosition(
      { userId: "service-u1", idempotencyKey: "position-overflow-move" },
      initialized.positionIds[0],
      "fund",
      { amount: 1, date: "2026-08-10" },
    );

    await expect(service.positionReadModel("service-u1", true)).rejects.toMatchObject({
      status: 409,
      code: "LEDGER_AGGREGATE_OUT_OF_RANGE",
    });
    await expect(service.positionDetail("service-u1", initialized.positionIds[0])).rejects.toMatchObject({
      status: 409,
      code: "LEDGER_AGGREGATE_OUT_OF_RANGE",
    });
  });

  it("returns a deterministic domain error when summary aggregates exceed safe integers", async () => {
    const service = new LedgerService(env.DB);
    await service.initialize(
      { userId: "service-u1", idempotencyKey: "summary-overflow-init" },
      { ...initialization, openingCash: 0 },
    );
    await service.appendIncome(
      { userId: "service-u1", idempotencyKey: "summary-overflow-income-1" },
      { amount: Number.MAX_SAFE_INTEGER, categoryId: incomeCategoryId, date: "2026-08-10" },
    );
    await service.appendIncome(
      { userId: "service-u1", idempotencyKey: "summary-overflow-income-2" },
      { amount: 1, categoryId: incomeCategoryId, date: "2026-08-11" },
    );

    await expect(service.summary("service-u1", "2026-08-17", "Aug")).rejects.toMatchObject({
      status: 409,
      code: "LEDGER_AGGREGATE_OUT_OF_RANGE",
    });
  });

  it("resolves containing and historical periods without selecting a future period", async () => {
    const service = new LedgerService(env.DB);
    await service.initialize(
      { userId: "service-u1", idempotencyKey: "period-resolution-init" },
      { ...initialization, budget: { ...initialization.budget, label: "History", endDate: "2026-08-10" } },
    );
    const containing = await service.summary("service-u1", "2026-08-05");
    expect(containing).toMatchObject({ period: { label: "History" }, safeToSpend: 900 });
    const expense = await service.appendExpense(
      { userId: "service-u1", idempotencyKey: "history-expense" },
      { amount: 100, categoryId: expenseCategoryId, date: "2026-08-05" },
    );
    await service.refundEvent(
      { userId: "service-u1", idempotencyKey: "history-refund" },
      expense.event.id,
      { amount: 50, date: "2026-08-12" },
    );
    await service.createBudgetPeriod(
      { userId: "service-u1", idempotencyKey: "future-period" },
      { label: "Future", startDate: "2026-08-18", endDate: "2026-08-31", plannedIncome: 0, savingsTarget: 0, spendingLimit: 0 },
    );
    expect(await service.summary("service-u1", "2026-08-17")).toMatchObject({
      period: null,
      safeToSpend: null,
    });
    expect(await service.summary("service-u1", "2026-08-17", "History")).toMatchObject({
      period: { expense: 50, budgetRemaining: 1_450 },
      safeToSpend: null,
    });
    await expect(service.summary("service-u1", "2026-08-17", "Future")).rejects.toMatchObject({
      status: 400,
      code: "BUDGET_PERIOD_AFTER_AS_OF",
    });
  });

  it("supports a zero plan and exposes grouped position status/history", async () => {
    const service = new LedgerService(env.DB);
    const initialized = await service.initialize(
      { userId: "service-u1", idempotencyKey: "read-model-init" },
      {
        ...initialization,
        openingCash: 0,
        budget: { ...initialization.budget, plannedIncome: 0, savingsTarget: 0, spendingLimit: 0 },
        positions: [
          { name: "Late receivable", kind: "personal_receivable", balance: 100, dueDate: "2026-08-01" },
          { name: "Empty deposit", kind: "term_deposit", balance: 0 },
          { name: "Card credit", kind: "credit_card", balance: 0 },
          { name: "Payable", kind: "personal_payable", balance: -30 },
        ],
      },
    );
    await service.adjustPosition(
      { userId: "service-u1", idempotencyKey: "card-opening-credit-adjustment" },
      { positionId: initialized.positionIds[2], amount: 20, direction: "increase", note: "statement credit", date: "2026-08-01" },
    );
    const closed = await service.createPosition(
      { userId: "service-u1", idempotencyKey: "read-model-closed" },
      { name: "Closed deposit", kind: "term_deposit" },
    );
    await service.closePosition(
      { userId: "service-u1", idempotencyKey: "read-model-close" },
      closed.position.id,
      { date: "2026-08-10" },
    );
    const active = await service.positionReadModel("service-u1", false);
    const activePositions = active.groups.flatMap((group) => group.positions);
    expect(activePositions.map((position) => position.status)).toEqual(
      expect.arrayContaining(["overdue", "settled", "open"]),
    );
    expect(active.groups).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "creditCards", normalTotal: 0, oppositeSignTotal: 20 }),
      expect.objectContaining({ code: "owedToMe", normalTotal: 100 }),
      expect.objectContaining({ code: "iOwe", normalTotal: 30 }),
    ]));
    expect(active.closedHistory).toEqual([]);
    const history = await service.positionReadModel("service-u1", true);
    expect(history.closedHistory).toEqual([
      expect.objectContaining({ id: closed.position.id, status: "closed", closedAt: "2026-08-10" }),
    ]);
    const detail = await service.positionDetail("service-u1", initialized.positionIds[0]);
    expect(detail).toMatchObject({
      position: { name: "Late receivable", counterparty: null, status: "overdue" },
      closure: null,
      activities: [{ code: "openingBalance", label: "Số dư ban đầu" }],
      actions: [
        { code: "lend", maxAmount: null, cashEffect: "pay" },
        { code: "collect", maxAmount: 100, cashEffect: "receive" },
        { code: "close", maxAmount: 100, cashEffect: "receive" },
      ],
    });
    expect(JSON.stringify(detail)).not.toMatch(/user_id|position_delta|created_at/);
  });

  it("appends cash and position reconciliation events with reasons", async () => {
    const service = new LedgerService(env.DB);
    const initialized = await service.initialize(
      { userId: "service-u1", idempotencyKey: "reconcile-init" },
      { ...initialization, positions: [{ name: "Recon", kind: "term_deposit", balance: 10 }] },
    );
    await service.adjustCash(
      { userId: "service-u1", idempotencyKey: "reconcile-cash" },
      { amount: 5, direction: "increase", note: "cash count", date: "2026-08-10" },
    );
    await service.adjustPosition(
      { userId: "service-u1", idempotencyKey: "reconcile-position" },
      { positionId: initialized.positionIds[0], amount: 2, direction: "decrease", note: "statement", date: "2026-08-10" },
    );
    expect(await service.summary("service-u1", "2026-08-17", "Aug")).toMatchObject({
      cashBalance: 1_005,
      positionBalance: 8,
      netWorth: 1_013,
    });
  });
});
