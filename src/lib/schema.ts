import type { Generated, Insertable, Selectable, Updateable } from "kysely";

// ─── monthly_budget ──────────────────────────────────────────────────────────
export interface MonthlyBudgetTable {
  id: Generated<number>;
  user_id: string;
  month: string;
  amount: number;
  start_date: string | null;
  end_date: string | null;
  objective: string | null;
  created_at: Generated<number>;
}

export type MonthlyBudget = Selectable<MonthlyBudgetTable>;
export type NewMonthlyBudget = Insertable<MonthlyBudgetTable>;
export type MonthlyBudgetUpdate = Updateable<MonthlyBudgetTable>;

// ─── budget_adjustment ───────────────────────────────────────────────────────
export interface BudgetAdjustmentTable {
  id: Generated<number>;
  monthly_budget_id: number;
  delta: number;
  note: string | null;
  created_at: Generated<number>;
}

export type BudgetAdjustment = Selectable<BudgetAdjustmentTable>;
export type NewBudgetAdjustment = Insertable<BudgetAdjustmentTable>;

// ─── custom_budget ───────────────────────────────────────────────────────────
export interface CustomBudgetTable {
  id: Generated<number>;
  user_id: string;
  name: string;
  amount: number;
  is_active: Generated<number>;
  created_at: Generated<number>;
}

export type CustomBudget = Selectable<CustomBudgetTable>;
export type NewCustomBudget = Insertable<CustomBudgetTable>;
export type CustomBudgetUpdate = Updateable<CustomBudgetTable>;

// ─── debt ─────────────────────────────────────────────────────────────────────
export interface DebtTable {
  id: string;
  user_id: string;
  type: "lend" | "borrow";
  party: string;
  note: string | null;
  due_date: string | null;
  status: "open" | "settled";
  opening_transaction_id: number | null;
  created_at: Generated<string>;
}

export type Debt = Selectable<DebtTable>;
export type NewDebt = Insertable<DebtTable>;
export type DebtUpdate = Updateable<DebtTable>;

// ─── transaction ─────────────────────────────────────────────────────────────
export interface TransactionTable {
  id: Generated<number>;
  user_id: string;
  amount: number;
  type: "expense" | "income";
  category_id: number | null;
  note: string | null;
  emoji: string | null;
  date: string;
  monthly_budget_id: number | null;
  debt_id: string | null;
  linked_amount: number | null;
  is_credit_card: Generated<number>;
  created_at: Generated<number>;
  updated_at: Generated<number>;
}

export type Transaction = Selectable<TransactionTable>;
export type NewTransaction = Insertable<TransactionTable>;
export type TransactionUpdate = Updateable<TransactionTable>;

// ─── transaction_custom_budget ────────────────────────────────────────────────
export interface TransactionCustomBudgetTable {
  transaction_id: number;
  custom_budget_id: number;
}

export type TransactionCustomBudget = Selectable<TransactionCustomBudgetTable>;

// ─── category ────────────────────────────────────────────────────────────────
export interface CategoryTable {
  id: Generated<number>;
  user_id: string;
  name: string;
  emoji: string | null;
  parent_id: number | null;
  level: number;
  sort_order: number;
  type: "income" | "expense";
  created_at: Generated<number>;
}

export type Category = Selectable<CategoryTable>;
export type NewCategory = Insertable<CategoryTable>;
export type CategoryUpdate = Updateable<CategoryTable>;

// ─── budget_config ───────────────────────────────────────────────────────────
export interface BudgetConfigTable {
  id: Generated<number>;
  user_id: string;
  default_monthly_amount: number;
  updated_at: number;
}

export type BudgetConfig = Selectable<BudgetConfigTable>;

// ─── statistics_report ───────────────────────────────────────────────────────
export interface StatisticsReportTable {
  id: Generated<number>;
  user_id: string;
  period_type: "monthly";
  period_key: string;
  insights: string; // JSON: Insight[]
  is_dirty: Generated<number>;
  generated_at: Generated<number>;
}

export type StatisticsReport = Selectable<StatisticsReportTable>;
export type NewStatisticsReport = Insertable<StatisticsReportTable>;

// ─── single-cash ledger ──────────────────────────────────────────────────────
export type FinancialEventKind =
  | "opening_cash" | "opening_position" | "income_cash"
  | "expense_cash" | "expense_position" | "refund_cash" | "refund_position"
  | "cash_to_position" | "position_to_cash" | "cash_adjustment"
  | "position_adjustment" | "reversal";

export interface FinancialWriteRequestTable {
  user_id: string; idempotency_key: string; operation: string; request_hash: string;
  result_resource_id: string | null; response_json: string; created_at: Generated<number>;
}
export interface FinancialProfileTable {
  user_id: string; ledger_start_date: string; minimum_cash_reserve: Generated<number>;
  initialized_at: Generated<number>; legacy_data_consent_at: number | null;
  legacy_data_archive_state: Generated<"not_applicable" | "preserved">;
}
export interface FinancialProfileAdjustmentTable {
  id: string; user_id: string; target: "minimum_cash_reserve"; delta: number;
  note: string; write_key: string; created_at: Generated<number>;
}
export type FinancialPositionKind =
  | "term_deposit" | "personal_receivable" | "credit_card" | "personal_payable";
export interface FinancialPositionTable {
  id: string; user_id: string; name: string; kind: FinancialPositionKind;
  counterparty: string | null; due_date: string | null; reserve_against_cash: 0 | 1;
  note: string | null; created_at: Generated<number>; updated_at: Generated<number>;
}
export interface BudgetPeriodTable {
  id: Generated<number>; user_id: string; label: string; start_date: string; end_date: string;
  planned_income: number; savings_target: Generated<number>; spending_limit: number;
  objective: string | null; created_at: Generated<number>;
}
export interface BudgetPeriodLockTable {
  budget_period_id: number; user_id: string; first_event_id: string;
  created_at: Generated<number>;
}
export interface LedgerBudgetAdjustmentTable {
  id: string; budget_period_id: number; user_id: string;
  target: "planned_income" | "savings_target" | "spending_limit";
  delta: number; note: string; write_key: string; created_at: Generated<number>;
}
export interface LedgerCustomBudgetTable {
  id: string; user_id: string; budget_period_id: number; name: string; amount: number;
  series_key: string | null; created_at: Generated<number>; updated_at: Generated<number>;
}
export interface LedgerCustomBudgetAdjustmentTable {
  id: string; custom_budget_id: string; user_id: string; delta: number; note: string;
  write_key: string; created_at: Generated<number>;
}
export interface FinancialEventTable {
  id: string; user_id: string; write_key: string; kind: FinancialEventKind; amount: number;
  cash_delta: Generated<number>; position_id: string | null; position_delta: Generated<number>;
  income_delta: Generated<number>; expense_delta: Generated<number>; equity_delta: Generated<number>;
  category_id: number | null; budget_period_id: number | null; related_event_id: string | null;
  refund_prior_total: number | null;
  reversal_of_event_id: string | null; note: string | null; date: string;
  created_at: Generated<number>;
}
export interface FinancialEventCustomBudgetAllocationTable {
  financial_event_id: string; custom_budget_id: string; user_id: string;
  allocated_expense_delta: number;
}
export interface FinancialEventCommitTable {
  sequence: Generated<number>; event_id: string; user_id: string; write_key: string;
  created_at: Generated<number>;
}
export interface FinancialPositionClosureTable {
  id: string; user_id: string; position_id: string; settlement_event_id: string | null;
  write_key: string; date: string; created_at: Generated<number>;
}
export interface FinancialPositionClosureReversalTable {
  closure_id: string; user_id: string; reversal_event_id: string | null;
  write_key: string; created_at: Generated<number>;
}
export interface LedgerCustomBudgetClosureTable {
  id: string; custom_budget_id: string; user_id: string; write_key: string;
  created_at: Generated<number>;
}
export interface LedgerCustomBudgetClosureReversalTable {
  closure_id: string; user_id: string; write_key: string; created_at: Generated<number>;
}

export type FinancialEvent = Selectable<FinancialEventTable>;
export type NewFinancialEvent = Insertable<FinancialEventTable>;
export type FinancialPosition = Selectable<FinancialPositionTable>;
export type NewFinancialPosition = Insertable<FinancialPositionTable>;
export type BudgetPeriod = Selectable<BudgetPeriodTable>;
export type NewBudgetPeriod = Insertable<BudgetPeriodTable>;

// ─── Database interface ───────────────────────────────────────────────────────
export interface Database {
  monthly_budget: MonthlyBudgetTable;
  budget_adjustment: BudgetAdjustmentTable;
  custom_budget: CustomBudgetTable;
  transaction: TransactionTable;
  transaction_custom_budget: TransactionCustomBudgetTable;
  category: CategoryTable;
  budget_config: BudgetConfigTable;
  statistics_report: StatisticsReportTable;
  debt: DebtTable;
  financial_write_request: FinancialWriteRequestTable;
  financial_profile: FinancialProfileTable;
  financial_profile_adjustment: FinancialProfileAdjustmentTable;
  financial_position: FinancialPositionTable;
  financial_position_closure: FinancialPositionClosureTable;
  financial_position_closure_reversal: FinancialPositionClosureReversalTable;
  budget_period: BudgetPeriodTable;
  budget_period_lock: BudgetPeriodLockTable;
  ledger_budget_adjustment: LedgerBudgetAdjustmentTable;
  ledger_custom_budget: LedgerCustomBudgetTable;
  ledger_custom_budget_adjustment: LedgerCustomBudgetAdjustmentTable;
  ledger_custom_budget_closure: LedgerCustomBudgetClosureTable;
  ledger_custom_budget_closure_reversal: LedgerCustomBudgetClosureReversalTable;
  financial_event: FinancialEventTable;
  financial_event_custom_budget_allocation: FinancialEventCustomBudgetAllocationTable;
  financial_event_commit: FinancialEventCommitTable;
}
