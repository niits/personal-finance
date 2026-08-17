import { constructEvent, constructReversal } from "./events";
import { assertCanonicalDate } from "./date";
import {
  availablePositionActions,
  closePosition,
  positionActionEventKind,
  positionActivityPresentation,
  positionGroupDefinitions,
  positionKindLabels,
} from "./positions";
import type {
  PositionDetailResponse,
  PositionActivity,
  PositionLifecycleActivity,
  PositionListResponse,
  PositionStatus,
  PositionSummary,
} from "./positions";
import type { EventKind, LedgerEvent, PositionAction, PositionKind } from "./types";
import { assertSafeInteger, safeNumber, safeSum } from "./money";
import { allocateCumulativeRefund } from "./refund-allocation";
import type { RecordedLedgerEvent } from "./types";

export class LedgerServiceError extends Error {
  constructor(
    public readonly status: 400 | 404 | 409,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function aggregateError(label: string): LedgerServiceError {
  return new LedgerServiceError(
    409,
    "LEDGER_AGGREGATE_OUT_OF_RANGE",
    `${label} is outside the supported safe-integer range`,
  );
}

function safeAggregateInteger(value: number, label: string): number {
  try {
    assertSafeInteger(value, label);
    return value;
  } catch {
    throw aggregateError(label);
  }
}

function safeAggregateNumber(value: bigint, label: string): number {
  try {
    return safeNumber(value, label);
  } catch {
    throw aggregateError(label);
  }
}

function safeAggregateSum(values: number[], label: string): number {
  try {
    return safeSum(values, label);
  } catch {
    throw aggregateError(label);
  }
}

type WriteContext = { userId: string; idempotencyKey: string };
type AllocationInput = { customBudgetId: string; amount: number };

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

async function requestHash(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(stableJson(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function positiveInteger(value: unknown, name: string): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new LedgerServiceError(400, "VALIDATION_ERROR", `${name} must be a positive integer`);
  }
  return value as number;
}

function nonnegativeInteger(value: unknown, name: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new LedgerServiceError(400, "VALIDATION_ERROR", `${name} must be a nonnegative integer`);
  }
  return value as number;
}

function currentVietnamDate(): string {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function actualDate(value: unknown): string {
  if (typeof value !== "string") {
    throw new LedgerServiceError(400, "VALIDATION_ERROR", "date must use YYYY-MM-DD");
  }
  try {
    assertCanonicalDate(value, "Event date");
  } catch {
    throw new LedgerServiceError(400, "VALIDATION_ERROR", "date must be a real YYYY-MM-DD date");
  }
  if (value > currentVietnamDate()) {
    throw new LedgerServiceError(400, "FUTURE_EVENT", "Actual events cannot be in the future");
  }
  return value;
}

function planDate(value: unknown, name: string): string {
  if (typeof value !== "string") throw new LedgerServiceError(400, "VALIDATION_ERROR", `${name} must use YYYY-MM-DD`);
  try {
    assertCanonicalDate(value, name);
  } catch {
    throw new LedgerServiceError(400, "VALIDATION_ERROR", `${name} must be a real YYYY-MM-DD date`);
  }
  return value;
}

function eventStatement(db: D1Database, id: string, userId: string, writeKey: string, event: LedgerEvent) {
  return db
    .prepare(
      `INSERT INTO financial_event
       (id,user_id,write_key,kind,amount,cash_delta,position_id,position_delta,income_delta,
        expense_delta,equity_delta,category_id,budget_period_id,related_event_id,refund_prior_total,
        reversal_of_event_id,note,date)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .bind(
      id,
      userId,
      writeKey,
      event.kind,
      event.amount,
      event.effects.cash,
      event.positionId,
      event.effects.position,
      event.effects.income,
      event.effects.expense,
      event.effects.equity,
      event.categoryId,
      event.budgetPeriodId,
      event.relatedEventId,
      event.refundPriorTotal,
      event.reversalOfEventId,
      event.note,
      event.date,
    );
}

function commitStatement(db: D1Database, eventId: string, userId: string, writeKey: string) {
  return db
    .prepare("INSERT INTO financial_event_commit (event_id,user_id,write_key) VALUES (?,?,?)")
    .bind(eventId, userId, writeKey);
}

function recordedEvent(row: Record<string, unknown>): RecordedLedgerEvent {
  return {
    id: String(row.id),
    kind: row.kind as RecordedLedgerEvent["kind"],
    amount: Number(row.amount),
    date: String(row.date),
    effects: {
      cash: Number(row.cash_delta),
      position: Number(row.position_delta),
      income: Number(row.income_delta),
      expense: Number(row.expense_delta),
      equity: Number(row.equity_delta),
    },
    positionId: row.position_id === null ? null : String(row.position_id),
    categoryId: row.category_id === null ? null : Number(row.category_id),
    budgetPeriodId: row.budget_period_id === null ? null : Number(row.budget_period_id),
    relatedEventId: row.related_event_id === null ? null : String(row.related_event_id),
    refundPriorTotal: row.refund_prior_total === null ? null : Number(row.refund_prior_total),
    reversalOfEventId:
      row.reversal_of_event_id === null ? null : String(row.reversal_of_event_id),
    note: row.note === null ? null : String(row.note),
  };
}

function generatedIntegerId(): number {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return bytes.reduce((value, byte) => value * 256 + byte, 0);
}

export class LedgerService {
  constructor(private readonly db: D1Database) {}

  private async requireProfile(userId: string) {
    const profile = await this.db.prepare("SELECT 1 FROM financial_profile WHERE user_id=?").bind(userId).first();
    if (!profile) throw new LedgerServiceError(404, "LEDGER_NOT_INITIALIZED", "Ledger is not initialized");
  }

  private async legacyFinancialCounts(userId: string) {
    const row = await this.db.prepare(`SELECT
      (SELECT COUNT(*) FROM "transaction" WHERE user_id=?) transactionCount,
      (SELECT COUNT(*) FROM monthly_budget WHERE user_id=?) monthlyBudgetCount,
      (SELECT COUNT(*) FROM custom_budget WHERE user_id=?) customBudgetCount,
      (SELECT COUNT(*) FROM debt WHERE user_id=?) debtCount`).bind(userId, userId, userId, userId).first<{
        transactionCount: number; monthlyBudgetCount: number; customBudgetCount: number; debtCount: number;
      }>();
    const counts = row ?? { transactionCount: 0, monthlyBudgetCount: 0, customBudgetCount: 0, debtCount: 0 };
    return { hasData: Object.values(counts).some((count) => count > 0), ...counts };
  }

  async profile(userId: string) {
    const legacyFinancialData = await this.legacyFinancialCounts(userId);
    const row = await this.db.prepare(`SELECT
      p.ledger_start_date,p.initialized_at,p.legacy_data_consent_at,p.legacy_data_archive_state,
      p.minimum_cash_reserve+COALESCE((SELECT SUM(delta) FROM financial_profile_adjustment a WHERE a.user_id=p.user_id),0) minimum_cash_reserve
      FROM financial_profile p WHERE p.user_id=?`).bind(userId).first<Record<string, unknown>>();
    if (!row) return {
      mode: legacyFinancialData.hasData ? "legacy-data" as const : "legacy-empty" as const,
      legacyFinancialData,
      consentRequired: legacyFinancialData.hasData,
      profile: null,
    };
    return {
      mode: "ledger" as const,
      legacyFinancialData,
      consentRequired: false,
      profile: {
        ledgerStartDate: String(row.ledger_start_date),
        minimumCashReserve: Number(row.minimum_cash_reserve),
        initializedAt: Number(row.initialized_at),
        legacyDataConsentAt: row.legacy_data_consent_at === null ? null : Number(row.legacy_data_consent_at),
        legacyDataArchiveState: row.legacy_data_archive_state as "not_applicable" | "preserved",
      },
    };
  }

  private async replay(userId: string, key: string, operation: string, hash: string) {
    const existing = await this.db
      .prepare(
        "SELECT operation,request_hash,response_json FROM financial_write_request WHERE user_id=? AND idempotency_key=?",
      )
      .bind(userId, key)
      .first<{ operation: string; request_hash: string; response_json: string }>();
    if (!existing) return null;
    if (existing.operation !== operation || existing.request_hash !== hash) {
      throw new LedgerServiceError(409, "IDEMPOTENCY_KEY_REUSED", "Idempotency key was used for another request");
    }
    return JSON.parse(existing.response_json) as unknown;
  }

  private async write<T>(
    context: WriteContext,
    operation: string,
    payload: unknown,
    prepare: () => Promise<{ response: T; statements: D1PreparedStatement[]; resourceId?: string }>,
  ): Promise<T> {
    if (!context.idempotencyKey.trim()) {
      throw new LedgerServiceError(400, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key is required");
    }
    const hash = await requestHash(payload);
    const replay = await this.replay(context.userId, context.idempotencyKey, operation, hash);
    if (replay !== null) return replay as T;

    const prepared = await prepare();
    const responseJson = JSON.stringify(prepared.response);
    const claim = this.db
      .prepare(
        "INSERT INTO financial_write_request (user_id,idempotency_key,operation,request_hash,result_resource_id,response_json) VALUES (?,?,?,?,?,?)",
      )
      .bind(
        context.userId,
        context.idempotencyKey,
        operation,
        hash,
        prepared.resourceId ?? null,
        responseJson,
      );
    try {
      await this.db.batch([claim, ...prepared.statements]);
      return prepared.response;
    } catch (error) {
      const concurrentReplay = await this.replay(
        context.userId,
        context.idempotencyKey,
        operation,
        hash,
      );
      if (concurrentReplay !== null) return concurrentReplay as T;
      const internalMessage = error instanceof Error ? error.message : String(error);
      const code = /ledger_[a-z_]+/.exec(internalMessage)?.[0]?.toUpperCase() ?? "LEDGER_CONFLICT";
      throw new LedgerServiceError(409, code, "Ledger write conflicted");
    }
  }

  async initialize(context: WriteContext, input: Record<string, unknown>) {
    return this.write(context, "ledger.initialize", input, async () => {
      if (await this.db.prepare("SELECT 1 FROM financial_profile WHERE user_id=?").bind(context.userId).first()) {
        throw new LedgerServiceError(409, "LEDGER_ALREADY_INITIALIZED", "Ledger is already initialized");
      }
      const ledgerStartDate = actualDate(input.ledgerStartDate);
      const legacyFinancialData = await this.legacyFinancialCounts(context.userId);
      if (legacyFinancialData.hasData && input.acceptLegacyDataFreshStart !== true) {
        throw new LedgerServiceError(409, "LEGACY_DATA_CONSENT_REQUIRED", "Explicit fresh-start consent is required because legacy financial data will remain archived");
      }
      const initializedAt = Math.floor(Date.now() / 1000);
      const archiveState = legacyFinancialData.hasData ? "preserved" : "not_applicable";
      const consentAt = legacyFinancialData.hasData ? initializedAt : null;
      const reserve = input.minimumCashReserve === undefined ? 0 : Number(input.minimumCashReserve);
      if (!Number.isSafeInteger(reserve) || reserve < 0) {
        throw new LedgerServiceError(400, "VALIDATION_ERROR", "minimumCashReserve must be nonnegative");
      }
      const budget = input.budget as Record<string, unknown> | undefined;
      if (!budget) throw new LedgerServiceError(400, "VALIDATION_ERROR", "Initial budget is required");
      const plannedIncome = nonnegativeInteger(budget.plannedIncome, "plannedIncome");
      const spendingLimit = nonnegativeInteger(budget.spendingLimit, "spendingLimit");
      const savingsTarget = budget.savingsTarget === undefined ? 0 : Number(budget.savingsTarget);
      const label = typeof budget.label === "string" && budget.label.trim() ? budget.label.trim() : "Initial";
      const startDate = planDate(budget.startDate, "startDate");
      const endDate = planDate(budget.endDate, "endDate");
      if (startDate > ledgerStartDate || endDate < ledgerStartDate) throw new LedgerServiceError(400, "VALIDATION_ERROR", "Initial budget must cover ledger start date");
      if (spendingLimit + savingsTarget > plannedIncome) throw new LedgerServiceError(400, "VALIDATION_ERROR", "Initial budget allocation exceeds planned income");
      const budgetPeriodId = generatedIntegerId();
      if (!Number.isSafeInteger(savingsTarget) || savingsTarget < 0) throw new LedgerServiceError(400, "VALIDATION_ERROR", "savingsTarget must be nonnegative");
      const statements: D1PreparedStatement[] = [
        this.db.prepare("INSERT INTO financial_profile (user_id,ledger_start_date,minimum_cash_reserve,initialized_at,legacy_data_consent_at,legacy_data_archive_state) VALUES (?,?,?,?,?,?)").bind(context.userId, ledgerStartDate, reserve, initializedAt, consentAt, archiveState),
        this.db.prepare("INSERT INTO budget_period (id,user_id,label,start_date,end_date,planned_income,savings_target,spending_limit,objective) VALUES (?,?,?,?,?,?,?,?,?)").bind(budgetPeriodId, context.userId, label, startDate, endDate, plannedIncome, savingsTarget, spendingLimit, typeof budget.objective === "string" ? budget.objective : null),
      ];
      const openingCash = input.openingCash === undefined ? 0 : Number(input.openingCash);
      if (!Number.isSafeInteger(openingCash) || openingCash < 0) throw new LedgerServiceError(400, "VALIDATION_ERROR", "openingCash must be nonnegative");
      const positionIds: string[] = [];
      const positions: Array<{ inputIndex: number; id: string; name: string; kind: PositionKind; openingBalance: number }> = [];
      for (const [inputIndex, raw] of (Array.isArray(input.positions) ? input.positions : []).entries()) {
        const position = raw as Record<string, unknown>;
        const id = crypto.randomUUID();
        const kind = position.kind as PositionKind;
        if (!(["term_deposit", "personal_receivable", "credit_card", "personal_payable"] as string[]).includes(kind)) throw new LedgerServiceError(400, "VALIDATION_ERROR", "Invalid position kind");
        const balance = Number(position.balance ?? 0);
        if (!Number.isSafeInteger(balance)) throw new LedgerServiceError(400, "VALIDATION_ERROR", "Position balance must be an integer");
        const assetKind = kind === "term_deposit" || kind === "personal_receivable";
        if ((assetKind && balance < 0) || (!assetKind && balance > 0)) throw new LedgerServiceError(400, "VALIDATION_ERROR", "Opening position balance has the wrong sign for its kind");
        positionIds.push(id);
        positions.push({ inputIndex, id, name: String(position.name ?? "").trim(), kind, openingBalance: balance });
        statements.push(this.db.prepare("INSERT INTO financial_position (id,user_id,name,kind,counterparty,due_date,reserve_against_cash,note) VALUES (?,?,?,?,?,?,?,?)").bind(id, context.userId, String(position.name ?? "").trim(), kind, position.counterparty ?? null, position.dueDate ?? null, kind === "credit_card" ? 1 : 0, position.note ?? null));
        if (balance !== 0) {
          const eventId = crypto.randomUUID();
          const event = constructEvent({ type: "open_position", positionId: id, balance, date: ledgerStartDate });
          statements.push(eventStatement(this.db, eventId, context.userId, context.idempotencyKey, event), commitStatement(this.db, eventId, context.userId, context.idempotencyKey));
        }
      }
      if (openingCash > 0) {
        const eventId = crypto.randomUUID();
        const event = constructEvent({ type: "open_cash", amount: openingCash, date: ledgerStartDate });
        statements.push(eventStatement(this.db, eventId, context.userId, context.idempotencyKey, event), commitStatement(this.db, eventId, context.userId, context.idempotencyKey));
      }
      const response = {
        initialized: true,
        ledgerStartDate,
        positionIds,
        profile: { ledgerStartDate, minimumCashReserve: reserve, initializedAt, legacyDataConsentAt: consentAt, legacyDataArchiveState: archiveState },
        budgetPeriod: {
          id: budgetPeriodId, label, startDate, endDate, objective: typeof budget.objective === "string" ? budget.objective : null,
          plannedIncome, savingsTarget, spendingLimit,
          effectivePlannedIncome: plannedIncome, effectiveSavingsTarget: savingsTarget, effectiveSpendingLimit: spendingLimit,
        },
        positions,
      };
      return { response, statements, resourceId: context.userId };
    });
  }

  async appendIncome(context: WriteContext, input: Record<string, unknown>) {
    return this.appendOperatingEvent(context, "financial-events.income", input, false);
  }

  async appendExpense(context: WriteContext, input: Record<string, unknown>) {
    return this.appendOperatingEvent(context, "financial-events.expense", input, true);
  }

  async adjustCash(context: WriteContext, input: Record<string, unknown>) {
    return this.write(context, "reconciliation.cash", input, async () => {
      const id = crypto.randomUUID();
      const event = constructEvent({ type: "adjust_cash", amount: positiveInteger(input.amount, "amount"), direction: input.direction as "increase" | "decrease", note: String(input.note), date: actualDate(input.date) });
      const response = { event: { id, ...event } };
      return { response, resourceId: id, statements: [eventStatement(this.db, id, context.userId, context.idempotencyKey, event), commitStatement(this.db, id, context.userId, context.idempotencyKey)] };
    });
  }

  async adjustPosition(context: WriteContext, input: Record<string, unknown>) {
    const positionId = String(input.positionId);
    return this.write(context, `reconciliation.position.${positionId}`, input, async () => {
      if (!(await this.positionRow(context.userId, positionId))) throw new LedgerServiceError(404, "NOT_FOUND", "Position not found");
      if (await this.positionClosed(context.userId, positionId)) throw new LedgerServiceError(409, "POSITION_CLOSED", "Position is closed");
      const id = crypto.randomUUID();
      const event = constructEvent({ type: "adjust_position", positionId, amount: positiveInteger(input.amount, "amount"), direction: input.direction as "increase" | "decrease", note: String(input.note), date: actualDate(input.date) });
      const response = { event: { id, ...event } };
      return { response, resourceId: id, statements: [eventStatement(this.db, id, context.userId, context.idempotencyKey, event), commitStatement(this.db, id, context.userId, context.idempotencyKey)] };
    });
  }

  async refundEvent(context: WriteContext, originalId: string, input: Record<string, unknown>) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.refundAttempt(context, originalId, input);
      } catch (error) {
        if (!(error instanceof LedgerServiceError) || error.code !== "LEDGER_REFUND_STALE_PRIOR" || attempt === 2) throw error;
      }
    }
    throw new LedgerServiceError(409, "LEDGER_REFUND_STALE_PRIOR", "Refund state changed concurrently");
  }

  private async refundAttempt(context: WriteContext, originalId: string, input: Record<string, unknown>) {
    return this.write(context, `financial-events.${originalId}.refund`, input, async () => {
      const originalRow = await this.db
        .prepare("SELECT e.* FROM financial_event e JOIN financial_event_commit ec ON ec.event_id=e.id WHERE e.id=? AND e.user_id=?")
        .bind(originalId, context.userId)
        .first<Record<string, unknown>>();
      if (!originalRow) throw new LedgerServiceError(404, "NOT_FOUND", "Expense event not found");
      const original = recordedEvent(originalRow);
      if (original.kind !== "expense_cash" && original.kind !== "expense_position") {
        throw new LedgerServiceError(409, "REFUND_ORIGINAL_INVALID", "Only expenses can be refunded");
      }
      const amount = positiveInteger(input.amount, "amount");
      const date = actualDate(input.date);
      if (date < original.date) {
        throw new LedgerServiceError(400, "REFUND_BEFORE_EXPENSE", "Refund date cannot precede the original expense");
      }
      const activeRefunds = await this.db
        .prepare(`SELECT r.id,r.amount FROM financial_event r JOIN financial_event_commit rc ON rc.event_id=r.id WHERE r.user_id=? AND r.related_event_id=? AND r.kind IN ('refund_cash','refund_position') AND NOT EXISTS (SELECT 1 FROM financial_event reversal JOIN financial_event_commit reversal_commit ON reversal_commit.event_id=reversal.id WHERE reversal.reversal_of_event_id=r.id)`)
        .bind(context.userId, originalId)
        .all<{ id: string; amount: number }>();
      const previousCumulative = activeRefunds.results.reduce((sum, refund) => sum + refund.amount, 0);
      const cumulative = previousCumulative + amount;
      if (!Number.isSafeInteger(cumulative) || cumulative > original.amount) {
        throw new LedgerServiceError(409, "REFUND_EXCEEDS_EXPENSE", "Refund exceeds remaining expense amount");
      }
      const originals = await this.db
        .prepare("SELECT custom_budget_id customBudgetId,allocated_expense_delta amount FROM financial_event_custom_budget_allocation WHERE financial_event_id=? ORDER BY custom_budget_id")
        .bind(originalId)
        .all<{ customBudgetId: string; amount: number }>();
      const activeIds = activeRefunds.results.map((refund) => refund.id);
      const released = new Map<string, number>();
      if (activeIds.length > 0) {
        const placeholders = activeIds.map(() => "?").join(",");
        const rows = await this.db
          .prepare(`SELECT custom_budget_id,SUM(-allocated_expense_delta) amount FROM financial_event_custom_budget_allocation WHERE financial_event_id IN (${placeholders}) GROUP BY custom_budget_id`)
          .bind(...activeIds)
          .all<{ custom_budget_id: string; amount: number }>();
        for (const row of rows.results) released.set(row.custom_budget_id, row.amount);
      }
      const customReleased = [...released.values()].reduce((sum, value) => sum + value, 0);
      const allocation = allocateCumulativeRefund({
        expenseAmount: original.amount,
        originalAllocations: originals.results,
        cumulativeRefundAmount: cumulative,
        previousCumulativeRefundAmount: previousCumulative,
        previouslyReleased: [...released].map(([customBudgetId, releasedAmount]) => ({
          customBudgetId,
          amount: releasedAmount,
        })),
        previouslyReleasedUnallocated: previousCumulative - customReleased,
      });
      const id = crypto.randomUUID();
      const event = constructEvent({
        type: "record_refund",
        amount,
        originalExpense: original,
        priorRefundTotal: previousCumulative,
        date,
        note: typeof input.note === "string" ? input.note : undefined,
      });
      const statements = [eventStatement(this.db, id, context.userId, context.idempotencyKey, event)];
      for (const item of allocation.customBudgetAllocations) {
        statements.push(
          this.db
            .prepare("INSERT INTO financial_event_custom_budget_allocation (financial_event_id,custom_budget_id,user_id,allocated_expense_delta) VALUES (?,?,?,?)")
            .bind(id, item.customBudgetId, context.userId, item.allocatedExpenseDelta),
        );
      }
      statements.push(commitStatement(this.db, id, context.userId, context.idempotencyKey));
      const response = { event: { id, ...event } };
      return { response, resourceId: id, statements };
    });
  }

  async reverseEvent(context: WriteContext, targetId: string, input: Record<string, unknown>) {
    return this.write(context, `financial-events.${targetId}.reverse`, input, async () => {
      const row = await this.db
        .prepare("SELECT e.* FROM financial_event e JOIN financial_event_commit ec ON ec.event_id=e.id WHERE e.id=? AND e.user_id=?")
        .bind(targetId, context.userId)
        .first<Record<string, unknown>>();
      if (!row) throw new LedgerServiceError(404, "NOT_FOUND", "Event not found");
      const target = recordedEvent(row);
      let reversal: LedgerEvent;
      try {
        reversal = constructReversal(target);
      } catch (error) {
        throw new LedgerServiceError(409, "EVENT_NOT_REVERSIBLE", error instanceof Error ? error.message : "Event cannot be reversed");
      }
      const reversalId = crypto.randomUUID();
      const statements: D1PreparedStatement[] = [];
      const allocations = await this.db
        .prepare("SELECT custom_budget_id,allocated_expense_delta FROM financial_event_custom_budget_allocation WHERE financial_event_id=? ORDER BY custom_budget_id")
        .bind(targetId)
        .all<{ custom_budget_id: string; allocated_expense_delta: number }>();
      for (const allocation of allocations.results) {
        const closure = await this.db
          .prepare(`SELECT c.id FROM ledger_custom_budget_closure c WHERE c.custom_budget_id=? AND c.user_id=? AND NOT EXISTS (SELECT 1 FROM ledger_custom_budget_closure_reversal r WHERE r.closure_id=c.id)`)
          .bind(allocation.custom_budget_id, context.userId)
          .first<{ id: string }>();
        if (closure) {
          statements.push(
            this.db
              .prepare("INSERT INTO ledger_custom_budget_closure_reversal (closure_id,user_id,write_key) VALUES (?,?,?)")
              .bind(closure.id, context.userId, context.idempotencyKey),
          );
        }
      }
      statements.push(eventStatement(this.db, reversalId, context.userId, context.idempotencyKey, reversal));
      for (const allocation of allocations.results) {
        statements.push(
          this.db
            .prepare("INSERT INTO financial_event_custom_budget_allocation (financial_event_id,custom_budget_id,user_id,allocated_expense_delta) VALUES (?,?,?,?)")
            .bind(reversalId, allocation.custom_budget_id, context.userId, -allocation.allocated_expense_delta),
        );
      }
      const positionClosure = await this.db
        .prepare(`SELECT c.id FROM financial_position_closure c WHERE c.settlement_event_id=? AND c.user_id=? AND NOT EXISTS (SELECT 1 FROM financial_position_closure_reversal r WHERE r.closure_id=c.id AND (r.reversal_event_id IS NULL OR EXISTS (SELECT 1 FROM financial_event_commit rc WHERE rc.event_id=r.reversal_event_id)))`)
        .bind(targetId, context.userId)
        .first<{ id: string }>();
      if (positionClosure) {
        statements.push(
          this.db
            .prepare("INSERT INTO financial_position_closure_reversal (closure_id,user_id,reversal_event_id,write_key) VALUES (?,?,?,?)")
            .bind(positionClosure.id, context.userId, reversalId, context.idempotencyKey),
        );
      }
      statements.push(commitStatement(this.db, reversalId, context.userId, context.idempotencyKey));
      const response = { event: { id: reversalId, ...reversal } };
      return { response, resourceId: reversalId, statements };
    });
  }

  private async appendOperatingEvent(context: WriteContext, operation: string, input: Record<string, unknown>, expense: boolean) {
    return this.write(context, operation, input, async () => {
      const amount = positiveInteger(input.amount, "amount");
      const date = actualDate(input.date);
      const categoryId = positiveInteger(input.categoryId, "categoryId");
      const category = await this.db.prepare("SELECT type,NOT EXISTS(SELECT 1 FROM category child WHERE child.parent_id=category.id AND child.user_id=category.user_id) is_leaf FROM category WHERE id=? AND user_id=?").bind(categoryId, context.userId).first<{ type: string; is_leaf: number }>();
      if (!category) throw new LedgerServiceError(404, "NOT_FOUND", "Category not found");
      if (category.type !== (expense ? "expense" : "income")) throw new LedgerServiceError(400, "CATEGORY_TYPE_MISMATCH", "Category type is incompatible");
      if (!category.is_leaf) throw new LedgerServiceError(400, "CATEGORY_NOT_LEAF", "Operating events require a leaf category");
      const id = crypto.randomUUID();
      let event: LedgerEvent;
      const statements: D1PreparedStatement[] = [];
      if (expense) {
        const period = await this.db.prepare("SELECT id FROM budget_period WHERE user_id=? AND start_date<=? AND end_date>=?").bind(context.userId, date, date).first<{ id: number }>();
        if (!period) throw new LedgerServiceError(409, "BUDGET_PERIOD_MISSING", "No budget period covers this date");
        const positionId = typeof input.positionId === "string" ? input.positionId : null;
        if (positionId) {
          const card = await this.db.prepare("SELECT kind FROM financial_position WHERE id=? AND user_id=?").bind(positionId, context.userId).first<{ kind: string }>();
          if (!card) throw new LedgerServiceError(404, "NOT_FOUND", "Position not found");
          if (card.kind !== "credit_card") throw new LedgerServiceError(400, "POSITION_KIND_MISMATCH", "Expense position must be a credit card");
        }
        event = constructEvent({ type: "record_expense", amount, categoryId, budgetPeriodId: period.id, payment: positionId ? { medium: "position", positionId } : { medium: "cash" }, note: typeof input.note === "string" ? input.note : undefined, date });
        const allocations = Array.isArray(input.allocations) ? (input.allocations as AllocationInput[]) : [];
        const total = allocations.reduce((sum, allocation) => sum + positiveInteger(allocation.amount, "allocation amount"), 0);
        if (total > amount) throw new LedgerServiceError(400, "ALLOCATION_EXCEEDS_EVENT", "Allocations exceed expense amount");
        for (const allocation of allocations) statements.push(this.db.prepare("INSERT INTO financial_event_custom_budget_allocation (financial_event_id,custom_budget_id,user_id,allocated_expense_delta) VALUES (?,?,?,?)").bind(id, allocation.customBudgetId, context.userId, allocation.amount));
      } else {
        event = constructEvent({ type: "record_income", amount, categoryId, note: typeof input.note === "string" ? input.note : undefined, date });
      }
      statements.unshift(eventStatement(this.db, id, context.userId, context.idempotencyKey, event));
      statements.push(commitStatement(this.db, id, context.userId, context.idempotencyKey));
      const response = { event: { id, ...event } };
      return { response, statements, resourceId: id };
    });
  }

  async createPosition(context: WriteContext, input: Record<string, unknown>) {
    return this.write(context, "positions.create", input, async () => {
      if (!(await this.db.prepare("SELECT 1 FROM financial_profile WHERE user_id=?").bind(context.userId).first())) {
        throw new LedgerServiceError(404, "LEDGER_NOT_INITIALIZED", "Ledger is not initialized");
      }
      const kind = input.kind as PositionKind;
      if (!(["term_deposit", "personal_receivable", "credit_card", "personal_payable"] as string[]).includes(kind)) throw new LedgerServiceError(400, "VALIDATION_ERROR", "Invalid position kind");
      const name = typeof input.name === "string" ? input.name.trim() : "";
      if (!name) throw new LedgerServiceError(400, "VALIDATION_ERROR", "name is required");
      const id = crypto.randomUUID();
      const response = { position: { id, name, kind, balance: 0 } };
      return { response, resourceId: id, statements: [this.db.prepare("INSERT INTO financial_position (id,user_id,name,kind,counterparty,due_date,reserve_against_cash,note) VALUES (?,?,?,?,?,?,?,?)").bind(id, context.userId, name, kind, input.counterparty ?? null, input.dueDate ?? null, kind === "credit_card" ? 1 : 0, input.note ?? null)] };
    });
  }

  async adjustReserve(context: WriteContext, input: Record<string, unknown>) {
    return this.write(context, "ledger.profile.reserve-adjust", input, async () => {
      const delta = Number(input.delta);
      if (!Number.isSafeInteger(delta) || delta === 0) throw new LedgerServiceError(400, "VALIDATION_ERROR", "delta must be a nonzero safe integer");
      const id = crypto.randomUUID();
      const response = { adjustment: { id, target: "minimum_cash_reserve", delta } };
      return { response, resourceId: id, statements: [this.db.prepare("INSERT INTO financial_profile_adjustment (id,user_id,target,delta,note,write_key) VALUES (?,?,'minimum_cash_reserve',?,?,?)").bind(id, context.userId, delta, input.note, context.idempotencyKey)] };
    });
  }

  async listBudgetPeriods(userId: string) {
    const result = await this.db.prepare(`SELECT bp.*,bp.planned_income+COALESCE(SUM(CASE WHEN a.target='planned_income' THEN a.delta ELSE 0 END),0) effectivePlannedIncome,bp.savings_target+COALESCE(SUM(CASE WHEN a.target='savings_target' THEN a.delta ELSE 0 END),0) effectiveSavingsTarget,bp.spending_limit+COALESCE(SUM(CASE WHEN a.target='spending_limit' THEN a.delta ELSE 0 END),0) effectiveSpendingLimit FROM budget_period bp LEFT JOIN ledger_budget_adjustment a ON a.budget_period_id=bp.id WHERE bp.user_id=? GROUP BY bp.id ORDER BY bp.start_date`).bind(userId).all();
    return result.results;
  }

  async budgetPeriodReadModel(userId: string) {
    await this.requireProfile(userId);
    const periods = await this.listBudgetPeriods(userId) as Array<Record<string, unknown>>;
    return Promise.all(periods.map(async (period) => {
      const custom = await this.listCustomBudgets(userId, Number(period.id)) as Array<Record<string, unknown>>;
      const effectiveLimit = Number(period.effectiveSpendingLimit);
      const customCapacity = custom.reduce((sum, item) => sum + Number(item.effectiveAmount), 0);
      const customSpent = custom.reduce((sum, item) => sum + Number(item.spent), 0);
      const actual = await this.db.prepare(`SELECT COALESCE(SUM(e.expense_delta),0) expense FROM financial_event e JOIN financial_event_commit ec ON ec.event_id=e.id WHERE e.user_id=? AND e.budget_period_id=?`).bind(userId, period.id).first<{ expense: number }>();
      const expense = Number(actual?.expense ?? 0);
      const unallocatedExpense = expense - customSpent;
      const unassignedRemaining = effectiveLimit - customCapacity - unallocatedExpense;
      const customRemaining = customCapacity - customSpent;
      const remaining = effectiveLimit - expense;
      return {
        id: Number(period.id), label: String(period.label), startDate: String(period.start_date), endDate: String(period.end_date),
        objective: period.objective === null ? null : String(period.objective), isLocked: Boolean(await this.db.prepare("SELECT 1 FROM budget_period_lock WHERE budget_period_id=?").bind(period.id).first()),
        initial: { plannedIncome: Number(period.planned_income), savingsTarget: Number(period.savings_target), spendingLimit: Number(period.spending_limit) },
        effective: { plannedIncome: Number(period.effectivePlannedIncome), savingsTarget: Number(period.effectiveSavingsTarget), spendingLimit: effectiveLimit },
        actual: { expense, remaining },
        capacity: { customCapacity, customSpent, customRemaining, unallocatedExpense, unassignedRemaining, reconciledRemaining: customRemaining + unassignedRemaining, reconciles: customRemaining + unassignedRemaining === remaining },
      };
    }));
  }

  async createBudgetPeriod(context: WriteContext, input: Record<string, unknown>) {
    return this.write(context, "budget-periods.create", input, async () => {
      await this.requireProfile(context.userId);
      const id = generatedIntegerId();
      const response = { budgetPeriod: { id, ...input } };
      return { response, resourceId: String(id), statements: [this.db.prepare("INSERT INTO budget_period (id,user_id,label,start_date,end_date,planned_income,savings_target,spending_limit,objective) VALUES (?,?,?,?,?,?,?,?,?)").bind(id, context.userId, input.label, input.startDate, input.endDate, input.plannedIncome, input.savingsTarget, input.spendingLimit, input.objective ?? null)] };
    });
  }

  async patchBudgetPeriod(context: WriteContext, id: number, input: Record<string, unknown>) {
    return this.write(context, `budget-periods.${id}.patch`, input, async () => {
      await this.requireProfile(context.userId);
      const existing = await this.db.prepare("SELECT id FROM budget_period WHERE id=? AND user_id=?").bind(id, context.userId).first();
      if (!existing) throw new LedgerServiceError(404, "NOT_FOUND", "Budget period not found");
      const fields: string[] = [];
      const values: unknown[] = [];
      for (const [api, column] of [["label", "label"], ["startDate", "start_date"], ["endDate", "end_date"], ["objective", "objective"]] as const) {
        if (api in input) { fields.push(`${column}=?`); values.push(input[api] ?? null); }
      }
      const response = { budgetPeriod: { id, ...input } };
      return { response, resourceId: String(id), statements: [this.db.prepare(`UPDATE budget_period SET ${fields.join(",")} WHERE id=? AND user_id=?`).bind(...values, id, context.userId)] };
    });
  }

  async adjustBudgetPeriod(context: WriteContext, id: number, input: Record<string, unknown>) {
    return this.write(context, `budget-periods.${id}.adjust`, input, async () => {
      await this.requireProfile(context.userId);
      if (!(await this.db.prepare("SELECT 1 FROM budget_period WHERE id=? AND user_id=?").bind(id, context.userId).first())) throw new LedgerServiceError(404, "NOT_FOUND", "Budget period not found");
      const adjustmentId = crypto.randomUUID();
      const response = { adjustment: { id: adjustmentId, budgetPeriodId: id, ...input } };
      return { response, resourceId: adjustmentId, statements: [this.db.prepare("INSERT INTO ledger_budget_adjustment (id,budget_period_id,user_id,target,delta,note,write_key) VALUES (?,?,?,?,?,?,?)").bind(adjustmentId, id, context.userId, input.target, input.delta, input.note, context.idempotencyKey)] };
    });
  }

  async listCustomBudgets(userId: string, periodId: number) {
    await this.requireProfile(userId);
    if (!(await this.db.prepare("SELECT 1 FROM budget_period WHERE id=? AND user_id=?").bind(periodId, userId).first())) throw new LedgerServiceError(404, "NOT_FOUND", "Budget period not found");
    const result = await this.db.prepare(`SELECT cb.*,cb.amount+COALESCE((SELECT SUM(delta) FROM ledger_custom_budget_adjustment a WHERE a.custom_budget_id=cb.id),0) effectiveAmount,COALESCE((SELECT SUM(allocation.allocated_expense_delta) FROM financial_event_custom_budget_allocation allocation JOIN financial_event_commit ec ON ec.event_id=allocation.financial_event_id WHERE allocation.custom_budget_id=cb.id),0) spent,CASE WHEN EXISTS (SELECT 1 FROM ledger_custom_budget_closure c WHERE c.custom_budget_id=cb.id AND NOT EXISTS (SELECT 1 FROM ledger_custom_budget_closure_reversal r WHERE r.closure_id=c.id)) THEN 1 ELSE 0 END closed FROM ledger_custom_budget cb WHERE cb.user_id=? AND cb.budget_period_id=? ORDER BY cb.id`).bind(userId, periodId).all();
    return result.results;
  }

  async customBudgetReadModel(userId: string, periodId: number) {
    const rows = await this.listCustomBudgets(userId, periodId) as Array<Record<string, unknown>>;
    return rows.map((row) => {
      const effectiveAmount = Number(row.effectiveAmount);
      const spent = Number(row.spent);
      return {
        id: String(row.id), budgetPeriodId: Number(row.budget_period_id), name: String(row.name),
        seriesKey: row.series_key === null ? null : String(row.series_key), initialAmount: Number(row.amount),
        effectiveAmount, spent, remaining: effectiveAmount - spent, locked: Boolean(row.closed),
      };
    });
  }

  async createCustomBudget(context: WriteContext, periodId: number, input: Record<string, unknown>) {
    return this.write(context, `budget-periods.${periodId}.custom.create`, input, async () => {
      await this.requireProfile(context.userId);
      if (!(await this.db.prepare("SELECT 1 FROM budget_period WHERE id=? AND user_id=?").bind(periodId, context.userId).first())) throw new LedgerServiceError(404, "NOT_FOUND", "Budget period not found");
      const id = crypto.randomUUID();
      const response = { customBudget: { id, budgetPeriodId: periodId, ...input } };
      return { response, resourceId: id, statements: [this.db.prepare("INSERT INTO ledger_custom_budget (id,user_id,budget_period_id,name,amount,series_key) VALUES (?,?,?,?,?,?)").bind(id, context.userId, periodId, input.name, input.amount, input.seriesKey ?? null)] };
    });
  }

  async patchCustomBudget(context: WriteContext, id: string, input: Record<string, unknown>) {
    return this.write(context, `custom-budgets.${id}.patch`, input, async () => {
      await this.requireProfile(context.userId);
      if (!(await this.db.prepare("SELECT 1 FROM ledger_custom_budget WHERE id=? AND user_id=?").bind(id, context.userId).first())) throw new LedgerServiceError(404, "NOT_FOUND", "Custom budget not found");
      const fields: string[] = [];
      const values: unknown[] = [];
      if ("name" in input) { fields.push("name=?"); values.push(input.name); }
      if ("seriesKey" in input) { fields.push("series_key=?"); values.push(input.seriesKey ?? null); }
      fields.push("updated_at=unixepoch()");
      const response = { customBudget: { id, ...input } };
      return { response, resourceId: id, statements: [this.db.prepare(`UPDATE ledger_custom_budget SET ${fields.join(",")} WHERE id=? AND user_id=?`).bind(...values, id, context.userId)] };
    });
  }

  async adjustCustomBudget(context: WriteContext, id: string, input: Record<string, unknown>) {
    return this.write(context, `custom-budgets.${id}.adjust`, input, async () => {
      await this.requireProfile(context.userId);
      if (!(await this.db.prepare("SELECT 1 FROM ledger_custom_budget WHERE id=? AND user_id=?").bind(id, context.userId).first())) throw new LedgerServiceError(404, "NOT_FOUND", "Custom budget not found");
      const adjustmentId = crypto.randomUUID();
      const response = { adjustment: { id: adjustmentId, customBudgetId: id, ...input } };
      return { response, resourceId: adjustmentId, statements: [this.db.prepare("INSERT INTO ledger_custom_budget_adjustment (id,custom_budget_id,user_id,delta,note,write_key) VALUES (?,?,?,?,?,?)").bind(adjustmentId, id, context.userId, input.delta, input.note, context.idempotencyKey)] };
    });
  }

  async closeCustomBudget(context: WriteContext, id: string, input: Record<string, unknown>) {
    return this.write(context, `custom-budgets.${id}.close`, input, async () => {
      await this.requireProfile(context.userId);
      if (!(await this.db.prepare("SELECT 1 FROM ledger_custom_budget WHERE id=? AND user_id=?").bind(id, context.userId).first())) throw new LedgerServiceError(404, "NOT_FOUND", "Custom budget not found");
      const closureId = crypto.randomUUID();
      const response = { closure: { id: closureId, customBudgetId: id } };
      return { response, resourceId: closureId, statements: [this.db.prepare("INSERT INTO ledger_custom_budget_closure (id,custom_budget_id,user_id,write_key) VALUES (?,?,?,?)").bind(closureId, id, context.userId, context.idempotencyKey)] };
    });
  }

  async patchPosition(context: WriteContext, id: string, input: Record<string, unknown>) {
    return this.write(context, `positions.${id}.patch`, input, async () => {
      if (!(await this.db.prepare("SELECT 1 FROM financial_position WHERE id=? AND user_id=?").bind(id, context.userId).first())) throw new LedgerServiceError(404, "NOT_FOUND", "Position not found");
      const fields: string[] = [];
      const values: unknown[] = [];
      for (const [api, column] of [["name", "name"], ["counterparty", "counterparty"], ["dueDate", "due_date"], ["note", "note"]] as const) {
        if (api in input) { fields.push(`${column}=?`); values.push(input[api] ?? null); }
      }
      fields.push("updated_at=unixepoch()");
      const response = { position: { id, ...input } };
      return { response, resourceId: id, statements: [this.db.prepare(`UPDATE financial_position SET ${fields.join(",")} WHERE id=? AND user_id=?`).bind(...values, id, context.userId)] };
    });
  }

  async movePosition(context: WriteContext, positionId: string, action: PositionAction, input: Record<string, unknown>) {
    return this.write(context, `positions.${positionId}.${action}`, input, async () => {
      const position = await this.positionRow(context.userId, positionId);
      if (!position) throw new LedgerServiceError(404, "NOT_FOUND", "Position not found");
      if (await this.positionClosed(context.userId, positionId)) {
        throw new LedgerServiceError(409, "POSITION_CLOSED", "Position is closed");
      }
      const amount = positiveInteger(input.amount, "amount");
      const date = actualDate(input.date);
      const semanticAction: PositionAction =
        action === "fund" && position.kind === "personal_receivable"
          ? "lend"
          : action === "withdraw" && position.kind === "personal_receivable"
            ? "collect"
            : action === "pay" && position.kind === "personal_payable"
              ? "repay"
              : action;
      const invalid =
        (position.kind === "term_deposit" &&
          ((semanticAction === "fund" && position.balance < 0) ||
            (semanticAction === "withdraw" && position.balance <= 0))) ||
        (position.kind === "personal_receivable" &&
          ((semanticAction === "lend" && position.balance < 0) ||
            (semanticAction === "collect" && position.balance <= 0))) ||
        (position.kind === "credit_card" &&
          (semanticAction !== "pay" || position.balance >= 0)) ||
        (position.kind === "personal_payable" &&
          ((semanticAction === "borrow" && position.balance > 0) ||
            (semanticAction === "repay" && position.balance >= 0)));
      if (invalid) {
        throw new LedgerServiceError(400, "POSITION_ACTION_INVALID", "Action is invalid for the signed position balance");
      }
      if (["withdraw", "collect", "pay", "repay"].includes(semanticAction) && amount > Math.abs(position.balance)) throw new LedgerServiceError(409, "POSITION_OVERPAYMENT", "Principal movement cannot cross zero");
      let kind: "cash_to_position" | "position_to_cash";
      try {
        kind = positionActionEventKind(position.kind, semanticAction);
      } catch {
        throw new LedgerServiceError(400, "POSITION_ACTION_INVALID", "Action is not valid for this position kind");
      }
      const id = crypto.randomUUID();
      const event = constructEvent({ type: "move_position", amount, positionId, direction: kind, date });
      const response = { event: { id, ...event } };
      return { response, resourceId: id, statements: [eventStatement(this.db, id, context.userId, context.idempotencyKey, event), commitStatement(this.db, id, context.userId, context.idempotencyKey)] };
    });
  }

  async closePosition(context: WriteContext, positionId: string, input: Record<string, unknown>) {
    return this.write(context, `positions.${positionId}.close`, input, async () => {
      const position = await this.positionRow(context.userId, positionId);
      if (!position) throw new LedgerServiceError(404, "NOT_FOUND", "Position not found");
      const date = actualDate(input.date);
      const profile = await this.db.prepare("SELECT ledger_start_date FROM financial_profile WHERE user_id=?").bind(context.userId).first<{ ledger_start_date: string }>();
      if (!profile || date < profile.ledger_start_date) {
        throw new LedgerServiceError(400, "CLOSE_BEFORE_LEDGER_START", "Close date cannot precede ledger start");
      }
      const command = closePosition(positionId, position.balance, date);
      const closureId = crypto.randomUUID();
      const statements: D1PreparedStatement[] = [];
      let settlementEventId: string | null = null;
      if (command) {
        settlementEventId = crypto.randomUUID();
        const event = constructEvent(command);
        statements.push(eventStatement(this.db, settlementEventId, context.userId, context.idempotencyKey, event), commitStatement(this.db, settlementEventId, context.userId, context.idempotencyKey));
      }
      statements.push(this.db.prepare("INSERT INTO financial_position_closure (id,user_id,position_id,settlement_event_id,write_key,date) VALUES (?,?,?,?,?,?)").bind(closureId, context.userId, positionId, settlementEventId, context.idempotencyKey, date));
      const response = { closure: { id: closureId, positionId, settlementEventId, date } };
      return { response, resourceId: closureId, statements };
    });
  }

  async reversePositionClose(context: WriteContext, positionId: string, input: Record<string, unknown>) {
    return this.write(context, `positions.${positionId}.close.reverse`, input, async () => {
      const closure = await this.db.prepare(`SELECT c.* FROM financial_position_closure c JOIN financial_position p ON p.id=c.position_id WHERE c.position_id=? AND p.user_id=? AND NOT EXISTS (SELECT 1 FROM financial_position_closure_reversal r WHERE r.closure_id=c.id AND (r.reversal_event_id IS NULL OR EXISTS (SELECT 1 FROM financial_event_commit rc WHERE rc.event_id=r.reversal_event_id)))`).bind(positionId, context.userId).first<Record<string, unknown>>();
      if (!closure) throw new LedgerServiceError(404, "NOT_FOUND", "Effective position closure not found");
      const statements: D1PreparedStatement[] = [];
      let reversalId: string | null = null;
      if (closure.settlement_event_id !== null) {
        const targetRow = await this.db.prepare("SELECT e.* FROM financial_event e JOIN financial_event_commit ec ON ec.event_id=e.id WHERE e.id=? AND e.user_id=?").bind(closure.settlement_event_id, context.userId).first<Record<string, unknown>>();
        if (!targetRow) throw new LedgerServiceError(409, "CLOSURE_SETTLEMENT_MISSING", "Closure settlement is missing");
        reversalId = crypto.randomUUID();
        const reversal = constructReversal(recordedEvent(targetRow));
        statements.push(eventStatement(this.db, reversalId, context.userId, context.idempotencyKey, reversal));
        statements.push(this.db.prepare("INSERT INTO financial_position_closure_reversal (closure_id,user_id,reversal_event_id,write_key) VALUES (?,?,?,?)").bind(closure.id, context.userId, reversalId, context.idempotencyKey));
        statements.push(commitStatement(this.db, reversalId, context.userId, context.idempotencyKey));
      } else {
        statements.push(this.db.prepare("INSERT INTO financial_position_closure_reversal (closure_id,user_id,reversal_event_id,write_key) VALUES (?,?,NULL,?)").bind(closure.id, context.userId, context.idempotencyKey));
      }
      const response = { closureReversal: { closureId: closure.id, reversalEventId: reversalId } };
      return { response, resourceId: String(closure.id), statements };
    });
  }

  private async positionRow(userId: string, id: string) {
    return this.db.prepare(`SELECT p.id,p.kind,COALESCE(SUM(CASE WHEN ec.event_id IS NOT NULL THEN e.position_delta ELSE 0 END),0) balance FROM financial_position p LEFT JOIN financial_event e ON e.position_id=p.id LEFT JOIN financial_event_commit ec ON ec.event_id=e.id WHERE p.id=? AND p.user_id=? GROUP BY p.id,p.kind`).bind(id, userId).first<{ id: string; kind: PositionKind; balance: number }>();
  }

  private async positionClosed(userId: string, id: string): Promise<boolean> {
    const row = await this.db.prepare(`SELECT 1 FROM financial_position_closure c JOIN financial_position p ON p.id=c.position_id WHERE c.position_id=? AND p.user_id=? AND NOT EXISTS (SELECT 1 FROM financial_position_closure_reversal r WHERE r.closure_id=c.id AND (r.reversal_event_id IS NULL OR EXISTS (SELECT 1 FROM financial_event_commit rc WHERE rc.event_id=r.reversal_event_id)))`).bind(id, userId).first();
    return row !== null;
  }

  async listPositions(userId: string) {
    return this.positionReadModel(userId, false);
  }

  async positionReadModel(userId: string, includeClosed: boolean): Promise<PositionListResponse> {
    if (!(await this.db.prepare("SELECT 1 FROM financial_profile WHERE user_id=?").bind(userId).first())) {
      throw new LedgerServiceError(404, "LEDGER_NOT_INITIALIZED", "Ledger is not initialized");
    }
    const rows = await this.db.prepare(`SELECT
      p.id,p.name,p.kind,p.counterparty,p.due_date,p.note,
      COALESCE(SUM(CASE WHEN ec.event_id IS NOT NULL THEN e.position_delta ELSE 0 END),0) balance,
      MAX(CASE WHEN ec.event_id IS NOT NULL THEN e.date END) latest_activity_date,
      MAX(c.date) closed_at
      FROM financial_position p
      LEFT JOIN financial_event e ON e.position_id=p.id
      LEFT JOIN financial_event_commit ec ON ec.event_id=e.id
      LEFT JOIN financial_position_closure c ON c.position_id=p.id
        AND NOT EXISTS (
          SELECT 1 FROM financial_position_closure_reversal cr
          WHERE cr.closure_id=c.id
            AND (cr.reversal_event_id IS NULL OR EXISTS (
              SELECT 1 FROM financial_event_commit rc WHERE rc.event_id=cr.reversal_event_id
            ))
        )
      WHERE p.user_id=?
      GROUP BY p.id,p.name,p.kind,p.counterparty,p.due_date,p.note
      ORDER BY p.created_at,p.id`).bind(userId).all<Record<string, unknown>>();
    const today = currentVietnamDate();
    const positions: PositionSummary[] = rows.results.map((row) => {
      const balance = safeAggregateInteger(Number(row.balance), `Position balance for ${String(row.id)}`);
      const closedAt = typeof row.closed_at === "string" ? row.closed_at : null;
      const status: PositionStatus = closedAt
        ? "closed"
        : balance === 0
          ? "settled"
          : typeof row.due_date === "string" && row.due_date < today
            ? "overdue"
            : "open";
      const kind = row.kind as PositionKind;
      return {
        id: String(row.id),
        name: String(row.name),
        kind,
        kindLabel: positionKindLabels[kind],
        counterparty: typeof row.counterparty === "string" ? row.counterparty : null,
        dueDate: typeof row.due_date === "string" ? row.due_date : null,
        note: typeof row.note === "string" ? row.note : null,
        balance,
        status,
        latestActivityDate: typeof row.latest_activity_date === "string" ? row.latest_activity_date : null,
        closedAt,
      };
    });
    const active = positions.filter((position) => position.status !== "closed");
    const groups = positionGroupDefinitions.map((definition) => {
      const members = active.filter((position) => position.kind === definition.kind);
      return {
        code: definition.code,
        label: definition.label,
        normalTotal: safeAggregateSum(
          members.filter((position) => definition.expectedSign * position.balance > 0).map((position) => Math.abs(position.balance)),
          `${definition.label} normal total`,
        ),
        oppositeSignTotal: safeAggregateSum(
          members.filter((position) => definition.expectedSign * position.balance < 0).map((position) => Math.abs(position.balance)),
          `${definition.label} opposite-sign total`,
        ),
        count: members.length,
        positions: members,
      };
    });
    return {
      groups,
      closedHistory: includeClosed ? positions.filter((position) => position.status === "closed") : [],
    };
  }

  async positionDetail(userId: string, id: string): Promise<PositionDetailResponse> {
    const model = await this.positionReadModel(userId, true);
    const position = [...model.groups.flatMap((group) => group.positions), ...model.closedHistory]
      .find((item) => item.id === id);
    if (!position) throw new LedgerServiceError(404, "NOT_FOUND", "Position not found");
    const closureRow = await this.db.prepare(`SELECT c.id,c.date,c.settlement_event_id
      FROM financial_position_closure c
      WHERE c.user_id=? AND c.position_id=?
        AND NOT EXISTS (
          SELECT 1 FROM financial_position_closure_reversal cr
          WHERE cr.closure_id=c.id
            AND (cr.reversal_event_id IS NULL OR EXISTS (
              SELECT 1 FROM financial_event_commit rc WHERE rc.event_id=cr.reversal_event_id
            ))
        )`).bind(userId, id).first<Record<string, unknown>>();
    const timeline = await this.db.prepare(`SELECT
      e.id,e.kind,e.amount,e.cash_delta,e.position_delta,e.note,e.date,e.category_id,
      e.reversal_of_event_id,category.name category_name,category.emoji category_emoji,
      ec.sequence
      FROM financial_event e
      JOIN financial_event_commit ec ON ec.event_id=e.id
      LEFT JOIN category ON category.id=e.category_id AND category.user_id=e.user_id
      WHERE e.user_id=? AND e.position_id=?
      ORDER BY e.date,ec.sequence`).bind(userId, id).all<Record<string, unknown>>();
    const allocationRows = await this.db.prepare(`SELECT
      a.financial_event_id,a.custom_budget_id,a.allocated_expense_delta,cb.name
      FROM financial_event_custom_budget_allocation a
      JOIN ledger_custom_budget cb ON cb.id=a.custom_budget_id AND cb.user_id=a.user_id
      JOIN financial_event_commit ec ON ec.event_id=a.financial_event_id
      JOIN financial_event e ON e.id=a.financial_event_id AND e.user_id=a.user_id
      WHERE a.user_id=? AND e.position_id=?
      ORDER BY a.custom_budget_id`).bind(userId, id).all<Record<string, unknown>>();
    const reversedBy = new Map<string, string>();
    for (const event of timeline.results) {
      if (typeof event.reversal_of_event_id === "string") {
        reversedBy.set(event.reversal_of_event_id, String(event.id));
      }
    }
    const settlementActivityId = closureRow?.settlement_event_id === null || closureRow?.settlement_event_id === undefined
      ? null
      : String(closureRow.settlement_event_id);
    const lifecycleRows = await this.db.prepare(`SELECT
      c.id,c.date,c.settlement_event_id,c.created_at closure_created_at,
      cr.reversal_event_id,cr.created_at reversal_created_at
      FROM financial_position_closure c
      LEFT JOIN financial_position_closure_reversal cr
        ON cr.closure_id=c.id AND cr.user_id=c.user_id
      WHERE c.user_id=? AND c.position_id=?
      ORDER BY c.created_at,c.id`).bind(userId, id).all<Record<string, unknown>>();
    const closureSettlementIds = new Set(
      lifecycleRows.results.flatMap((row) => typeof row.settlement_event_id === "string" ? [row.settlement_event_id] : []),
    );
    const financialActivities = timeline.results.map((event) => {
      const eventId = String(event.id);
      const isCloseSettlement = closureSettlementIds.has(eventId);
      const presentation = positionActivityPresentation(
        position.kind,
        event.kind as EventKind,
        isCloseSettlement,
      );
      return {
        type: "financial" as const,
        id: eventId,
        ...presentation,
        date: String(event.date),
        amount: Number(event.amount),
        cashChange: Number(event.cash_delta),
        positionChange: Number(event.position_delta),
        note: typeof event.note === "string" ? event.note : null,
        category: event.category_id === null
          ? null
          : {
              id: Number(event.category_id),
              name: String(event.category_name),
              emoji: typeof event.category_emoji === "string" ? event.category_emoji : null,
            },
        allocations: allocationRows.results
          .filter((allocation) => allocation.financial_event_id === event.id)
          .map((allocation) => ({
            customBudgetId: String(allocation.custom_budget_id),
            name: String(allocation.name),
            amount: Number(allocation.allocated_expense_delta),
          })),
        reversal: {
          reversesActivityId: typeof event.reversal_of_event_id === "string" ? event.reversal_of_event_id : null,
          reversedByActivityId: reversedBy.get(eventId) ?? null,
        },
        isCloseSettlement,
        sortDate: String(event.date),
        sortOrder: Number(event.sequence),
      };
    });
    const sequenceByEvent = new Map(
      timeline.results.map((event) => [String(event.id), Number(event.sequence)]),
    );
    const lifecycleActivities = lifecycleRows.results.flatMap((row) => {
      const closureId = String(row.id);
      const date = String(row.date);
      const settlementId = typeof row.settlement_event_id === "string" ? row.settlement_event_id : null;
      const reversalId = typeof row.reversal_event_id === "string" ? row.reversal_event_id : null;
      const fallbackOrder = timeline.results
        .filter((event) => String(event.date) <= date)
        .reduce((maximum, event) => Math.max(maximum, Number(event.sequence)), 0) + 1;
      const entries: Array<PositionLifecycleActivity & { sortDate: string; sortOrder: number }> = [{
        type: "lifecycle" as const,
        id: `closure:${closureId}`,
        code: "positionClosed" as const,
        label: "Đã tất toán vị thế",
        date,
        recordedAt: Number(row.closure_created_at),
        closureId,
        settlementActivityId: settlementId,
        reversalActivityId: null,
        sortDate: date,
        sortOrder: (settlementId ? sequenceByEvent.get(settlementId) : undefined) ?? fallbackOrder,
      }];
      if (row.reversal_created_at !== null && row.reversal_created_at !== undefined) {
        entries.push({
          type: "lifecycle" as const,
          id: `closure-reversal:${closureId}`,
          code: "positionCloseReversed" as const,
          label: "Đã hoàn tác tất toán",
          date,
          recordedAt: Number(row.reversal_created_at),
          closureId,
          settlementActivityId: settlementId,
          reversalActivityId: reversalId,
          sortDate: date,
          sortOrder: ((reversalId ? sequenceByEvent.get(reversalId) : undefined) ?? fallbackOrder) + 0.25,
        });
      }
      return entries;
    });
    const activities = [...financialActivities, ...lifecycleActivities]
      .sort((left, right) => left.sortDate.localeCompare(right.sortDate) || left.sortOrder - right.sortOrder)
      .map((entry) => {
        const activity = { ...entry } as Record<string, unknown>;
        delete activity.sortDate;
        delete activity.sortOrder;
        return activity as PositionActivity;
      });
    return {
      position,
      closure: closureRow
        ? { id: String(closureRow.id), date: String(closureRow.date), settlementActivityId }
        : null,
      activities,
      actions: availablePositionActions(position.kind, position.balance, position.status === "closed"),
    };
  }

  async listEvents(userId: string) {
    const rows = await this.db.prepare("SELECT e.*,ec.sequence FROM financial_event e JOIN financial_event_commit ec ON ec.event_id=e.id WHERE e.user_id=? ORDER BY e.date DESC,ec.sequence DESC").bind(userId).all();
    return rows.results;
  }

  async eventFeed(userId: string, options: { from?: string; to?: string; limit?: number; cursor?: string }) {
    await this.requireProfile(userId);
    const from = options.from === undefined ? null : planDate(options.from, "from");
    const to = options.to === undefined ? null : planDate(options.to, "to");
    if (from && to && from > to) throw new LedgerServiceError(400, "VALIDATION_ERROR", "from cannot be after to");
    const limit = options.limit ?? 50;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new LedgerServiceError(400, "VALIDATION_ERROR", "limit must be between 1 and 100");
    const cursor = options.cursor === undefined ? null : Number(options.cursor);
    if (cursor !== null && (!Number.isSafeInteger(cursor) || cursor < 1)) throw new LedgerServiceError(400, "VALIDATION_ERROR", "cursor is invalid");
    const conditions = ["e.user_id=?"];
    const bindings: unknown[] = [userId];
    if (from) { conditions.push("e.date>=?"); bindings.push(from); }
    if (to) { conditions.push("e.date<=?"); bindings.push(to); }
    if (cursor !== null) { conditions.push("ec.sequence<?"); bindings.push(cursor); }
    const rows = await this.db.prepare(`SELECT
      e.id,e.kind,e.amount,e.date,e.note,e.cash_delta,e.position_delta,e.income_delta,e.expense_delta,e.equity_delta,
      e.related_event_id,e.reversal_of_event_id,e.category_id,e.position_id,ec.sequence,
      c.name category_name,c.emoji category_emoji,p1.name category_parent_name,p2.name category_grandparent_name,
      p.name position_name,p.kind position_kind,
      (SELECT reversal.id FROM financial_event reversal JOIN financial_event_commit reversal_commit ON reversal_commit.event_id=reversal.id WHERE reversal.reversal_of_event_id=e.id LIMIT 1) reversed_by_event_id,
      (SELECT COALESCE(SUM(refund.amount),0) FROM financial_event refund JOIN financial_event_commit refund_commit ON refund_commit.event_id=refund.id WHERE refund.related_event_id=e.id AND NOT EXISTS (SELECT 1 FROM financial_event refund_reversal JOIN financial_event_commit refund_reversal_commit ON refund_reversal_commit.event_id=refund_reversal.id WHERE refund_reversal.reversal_of_event_id=refund.id)) active_refund_total,
      EXISTS (SELECT 1 FROM financial_position_closure closure WHERE closure.position_id=e.position_id AND closure.user_id=e.user_id AND NOT EXISTS (SELECT 1 FROM financial_position_closure_reversal closure_reversal WHERE closure_reversal.closure_id=closure.id AND (closure_reversal.reversal_event_id IS NULL OR EXISTS (SELECT 1 FROM financial_event_commit closure_reversal_commit WHERE closure_reversal_commit.event_id=closure_reversal.reversal_event_id)))) position_closed,
      EXISTS (SELECT 1 FROM financial_position_closure closure WHERE closure.position_id=e.position_id AND closure.user_id=e.user_id AND closure.settlement_event_id=e.id AND NOT EXISTS (SELECT 1 FROM financial_position_closure_reversal closure_reversal WHERE closure_reversal.closure_id=closure.id AND (closure_reversal.reversal_event_id IS NULL OR EXISTS (SELECT 1 FROM financial_event_commit closure_reversal_commit WHERE closure_reversal_commit.event_id=closure_reversal.reversal_event_id)))) is_close_settlement
      FROM financial_event e
      JOIN financial_event_commit ec ON ec.event_id=e.id
      LEFT JOIN category c ON c.id=e.category_id AND c.user_id=e.user_id
      LEFT JOIN category p1 ON p1.id=c.parent_id AND p1.user_id=e.user_id
      LEFT JOIN category p2 ON p2.id=p1.parent_id AND p2.user_id=e.user_id
      LEFT JOIN financial_position p ON p.id=e.position_id AND p.user_id=e.user_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY ec.sequence DESC LIMIT ?`).bind(...bindings, limit + 1).all<Record<string, unknown>>();
    const page = rows.results.slice(0, limit);
    const ids = page.map((row) => String(row.id));
    const allocations = ids.length === 0 ? [] : (await this.db.prepare(`SELECT
      a.financial_event_id,a.custom_budget_id,a.allocated_expense_delta,cb.name
      FROM financial_event_custom_budget_allocation a
      JOIN ledger_custom_budget cb ON cb.id=a.custom_budget_id AND cb.user_id=a.user_id
      WHERE a.financial_event_id IN (${ids.map(() => "?").join(",")})
      ORDER BY a.custom_budget_id`).bind(...ids).all<Record<string, unknown>>()).results;
    const events = page.map((row) => {
      const kind = row.kind as EventKind;
      const principal = kind === "cash_to_position" || kind === "position_to_cash";
      const activity = kind.startsWith("opening_") ? { type: "opening" as const, label: "Opening balance" }
        : kind === "income_cash" ? { type: "income" as const, label: "Income" }
        : kind.startsWith("expense_") ? { type: "expense" as const, label: "Expense" }
        : kind.startsWith("refund_") ? { type: "refund" as const, label: "Refund" }
        : principal ? { type: "transfer" as const, label: "Transfer" }
        : kind === "reversal" ? { type: "correction" as const, label: "Correction" }
        : { type: "reconciliation" as const, label: "Reconciliation" };
      const categoryPath = row.category_id === null ? null : [row.category_grandparent_name, row.category_parent_name, row.category_name]
        .filter((part): part is string => typeof part === "string").join(" > ");
      const activeRefundTotal = Number(row.active_refund_total);
      const positionActionBlocked = Boolean(row.position_closed) && !Boolean(row.is_close_settlement);
      const remainingRefundableAmount = kind.startsWith("expense_")
        ? row.reversed_by_event_id === null ? Number(row.amount) - activeRefundTotal : 0
        : null;
      return {
        id: String(row.id), kind, amount: Number(row.amount), date: String(row.date), note: row.note === null ? null : String(row.note),
        remainingRefundableAmount,
        category: row.category_id === null ? null : { id: Number(row.category_id), name: String(row.category_name), emoji: row.category_emoji === null ? null : String(row.category_emoji), path: categoryPath! },
        position: row.position_id === null ? null : { id: String(row.position_id), name: String(row.position_name), kind: row.position_kind as PositionKind },
        allocations: allocations.filter((allocation) => allocation.financial_event_id === row.id).map((allocation) => ({ customBudgetId: String(allocation.custom_budget_id), name: String(allocation.name), amount: Number(allocation.allocated_expense_delta) })),
        reversal: { reversesEventId: row.reversal_of_event_id === null ? null : String(row.reversal_of_event_id), reversedByEventId: row.reversed_by_event_id === null ? null : String(row.reversed_by_event_id), relatedEventId: row.related_event_id === null ? null : String(row.related_event_id) },
        effects: { cash: Number(row.cash_delta), position: Number(row.position_delta), income: Number(row.income_delta), expense: Number(row.expense_delta), equity: Number(row.equity_delta) },
        activity: { ...activity, actions: {
          canRefund: remainingRefundableAmount !== null && remainingRefundableAmount > 0 && !positionActionBlocked,
          canReverse: !kind.startsWith("opening_") && kind !== "reversal" && row.reversed_by_event_id === null && !(kind.startsWith("expense_") && activeRefundTotal > 0) && !positionActionBlocked,
        } },
      };
    });
    return { events, pagination: { nextCursor: rows.results.length > limit ? String(page[page.length - 1].sequence) : null } };
  }

  async summaryReadModel(userId: string, asOf: string, periodId?: number) {
    let periodLabel: string | undefined;
    if (periodId !== undefined) {
      if (!Number.isSafeInteger(periodId) || periodId <= 0) throw new LedgerServiceError(400, "VALIDATION_ERROR", "periodId must be a positive integer");
      const row = await this.db.prepare("SELECT label FROM budget_period WHERE id=? AND user_id=?").bind(periodId, userId).first<{ label: string }>();
      if (!row) throw new LedgerServiceError(404, "NOT_FOUND", "Budget period not found");
      periodLabel = row.label;
    }
    const raw = await this.summary(userId, asOf, periodLabel) as Record<string, unknown>;
    const period = raw.period as Record<string, unknown> | null;
    let activePeriod = null;
    if (period) {
      const envelopes = period.customEnvelopes as Array<{ id: string; name: string; effectiveAmount: number; spent: number; remaining: number }>;
      const customCapacity = envelopes.reduce((sum, envelope) => sum + envelope.effectiveAmount, 0);
      const customSpent = envelopes.reduce((sum, envelope) => sum + envelope.spent, 0);
      const remaining = Number(period.budgetRemaining);
      const unassignedRemaining = Number(period.periodUnassignedRemaining);
      activePeriod = {
        id: Number(period.id), label: String(period.label), startDate: String(period.start_date), endDate: String(period.end_date),
        plan: { plannedIncome: Number(period.effective_income), savingsTarget: Number(period.effective_savings), spendingLimit: Number(period.effective_limit) },
        actual: { income: Number(period.income), expense: Number(period.expense), savings: Number(period.actualSavings), savingsRate: period.savingsRate as number | null, savingsTargetGap: Number(period.savingsTargetGap), remaining },
        allocationBreakdown: { customCapacity, customSpent, unallocatedExpense: Number(period.periodUnallocatedExpense), unassignedRemaining, reconciledRemaining: envelopes.reduce((sum, envelope) => sum + envelope.remaining, 0) + unassignedRemaining },
        customEnvelopes: envelopes,
      };
    }
    const reservedPayables = Number(raw.reservedPayables);
    return {
      asOf,
      balances: { cash: Number(raw.cashBalance), positions: Number(raw.positionBalance), netWorth: Number(raw.netWorth), reservedCardDebt: Math.abs(Math.min(0, reservedPayables)), reservedPayables, minimumCashReserve: Number(raw.minimumCashReserve), cashAfterCommitments: Number(raw.cashAfterCommitments) },
      activePeriod,
      safeToSpend: raw.safeToSpend as number | null,
    };
  }

  async summary(userId: string, asOf: string, periodLabel?: string) {
    actualDate(asOf);
    const profile = await this.db.prepare("SELECT minimum_cash_reserve + COALESCE((SELECT SUM(delta) FROM financial_profile_adjustment a WHERE a.user_id=p.user_id),0) reserve FROM financial_profile p WHERE user_id=?").bind(userId).first<{ reserve: number }>();
    if (!profile) throw new LedgerServiceError(404, "LEDGER_NOT_INITIALIZED", "Ledger is not initialized");
    const reservePolicy = safeAggregateInteger(profile.reserve, "Minimum cash reserve");
    const totals = await this.db.prepare("SELECT COALESCE(SUM(cash_delta),0) cash,COALESCE(SUM(position_delta),0) positions FROM financial_event e JOIN financial_event_commit ec ON ec.event_id=e.id WHERE e.user_id=? AND e.date<=?").bind(userId, asOf).first<{ cash: number; positions: number }>();
    const reserved = await this.db.prepare(`SELECT COALESCE(SUM(balance),0) reserved FROM (SELECT p.id,SUM(e.position_delta) balance FROM financial_position p JOIN financial_event e ON e.position_id=p.id JOIN financial_event_commit ec ON ec.event_id=e.id WHERE p.user_id=? AND p.reserve_against_cash=1 AND e.date<=? GROUP BY p.id HAVING balance<0)`).bind(userId, asOf).first<{ reserved: number }>();
    const periodSql = `SELECT bp.*,bp.planned_income+COALESCE(SUM(CASE WHEN a.target='planned_income' THEN a.delta ELSE 0 END),0) effective_income,bp.savings_target+COALESCE(SUM(CASE WHEN a.target='savings_target' THEN a.delta ELSE 0 END),0) effective_savings,bp.spending_limit+COALESCE(SUM(CASE WHEN a.target='spending_limit' THEN a.delta ELSE 0 END),0) effective_limit FROM budget_period bp LEFT JOIN ledger_budget_adjustment a ON a.budget_period_id=bp.id WHERE bp.user_id=?`;
    const period = periodLabel
      ? await this.db.prepare(`${periodSql} AND bp.label=? AND bp.start_date<=? GROUP BY bp.id`).bind(userId, periodLabel, asOf).first<Record<string, number | string>>()
      : await this.db.prepare(`${periodSql} AND bp.start_date<=? AND bp.end_date>=? GROUP BY bp.id`).bind(userId, asOf, asOf).first<Record<string, number | string>>();
    if (periodLabel && !period) {
      const exists = await this.db.prepare("SELECT 1 FROM budget_period WHERE user_id=? AND label=?").bind(userId, periodLabel).first();
      if (exists) throw new LedgerServiceError(400, "BUDGET_PERIOD_AFTER_AS_OF", "Budget period starts after asOf");
      throw new LedgerServiceError(404, "NOT_FOUND", "Budget period not found");
    }
    let periodMetrics = null;
    if (period) {
      const metrics = await this.db.prepare("SELECT COALESCE(SUM(CASE WHEN date>=? AND date<=MIN(?,?) THEN income_delta ELSE 0 END),0) income,COALESCE(SUM(CASE WHEN budget_period_id=? AND date<=? THEN expense_delta ELSE 0 END),0) expense FROM financial_event e JOIN financial_event_commit ec ON ec.event_id=e.id WHERE e.user_id=?").bind(period.start_date, period.end_date, asOf, period.id, asOf, userId).first<{ income: number; expense: number }>();
      const periodIncome = safeAggregateInteger(metrics!.income, "Period income");
      const periodExpense = safeAggregateInteger(metrics!.expense, "Period expense");
      const effectiveIncome = safeAggregateInteger(Number(period.effective_income), "Effective planned income");
      const effectiveSavings = safeAggregateInteger(Number(period.effective_savings), "Effective savings target");
      const effectiveLimit = safeAggregateInteger(Number(period.effective_limit), "Effective spending limit");
      const actualSavings = safeAggregateNumber(BigInt(periodIncome) - BigInt(periodExpense), "Actual savings");
      const budgetRemaining = safeAggregateNumber(BigInt(effectiveLimit) - BigInt(periodExpense), "Budget remaining");
      const savingsTargetGap = safeAggregateNumber(
        BigInt(effectiveSavings) - BigInt(actualSavings),
        "Savings target gap",
      );
      const savingsRate = periodIncome === 0 ? null : actualSavings / periodIncome;
      const customResult = await this.db.prepare(`SELECT cb.id,cb.name,cb.amount+COALESCE((SELECT SUM(delta) FROM ledger_custom_budget_adjustment a WHERE a.custom_budget_id=cb.id),0) effectiveAmount,COALESCE((SELECT SUM(allocation.allocated_expense_delta) FROM financial_event_custom_budget_allocation allocation JOIN financial_event event ON event.id=allocation.financial_event_id JOIN financial_event_commit commit_marker ON commit_marker.event_id=event.id WHERE allocation.custom_budget_id=cb.id AND event.date<=?),0) spent FROM ledger_custom_budget cb WHERE cb.user_id=? AND cb.budget_period_id=? ORDER BY cb.id`).bind(asOf, userId, period.id).all<{ id: string; name: string; effectiveAmount: number; spent: number }>();
      const customEnvelopes = customResult.results.map((custom) => {
        const effectiveAmount = safeAggregateInteger(custom.effectiveAmount, `Custom budget ${custom.id} effective amount`);
        const spent = safeAggregateInteger(custom.spent, `Custom budget ${custom.id} spent`);
        return {
          ...custom,
          effectiveAmount,
          spent,
          remaining: safeAggregateNumber(BigInt(effectiveAmount) - BigInt(spent), `Custom budget ${custom.id} remaining`),
        };
      });
      const customSpent = safeAggregateSum(customEnvelopes.map((custom) => custom.spent), "Custom budget spent total");
      const customAmount = safeAggregateSum(customEnvelopes.map((custom) => custom.effectiveAmount), "Custom budget amount total");
      const periodUnallocatedExpense = safeAggregateNumber(BigInt(periodExpense) - BigInt(customSpent), "Period unallocated expense");
      const periodUnassignedRemaining = safeAggregateNumber(
        BigInt(effectiveLimit) - BigInt(customAmount) - BigInt(periodUnallocatedExpense),
        "Period unassigned remaining",
      );
      periodMetrics = {
        ...period,
        effective_income: effectiveIncome,
        income: periodIncome,
        expense: periodExpense,
        actualSavings,
        savingsRate,
        savingsTargetGap,
        budgetRemaining,
        periodUnallocatedExpense,
        periodUnassignedRemaining,
        customEnvelopes,
      };
    }
    const cash = safeAggregateInteger(totals?.cash ?? 0, "Cash balance");
    const positions = safeAggregateInteger(totals?.positions ?? 0, "Position balance");
    const reservedPayables = safeAggregateInteger(reserved?.reserved ?? 0, "Reserved payables");
    const cashAfterCommitments = safeAggregateNumber(
      BigInt(cash) + BigInt(reservedPayables) - BigInt(reservePolicy),
      "Cash after commitments",
    );
    const netWorth = safeAggregateNumber(BigInt(cash) + BigInt(positions), "Net worth");
    const periodIsActive =
      period !== null && asOf >= String(period.start_date) && asOf <= String(period.end_date);
    return { cashBalance: cash, positionBalance: positions, netWorth, reservedPayables, minimumCashReserve: reservePolicy, cashAfterCommitments, period: periodMetrics, safeToSpend: periodMetrics && periodIsActive ? Math.min(cashAfterCommitments, periodMetrics.budgetRemaining) : null };
  }
}
