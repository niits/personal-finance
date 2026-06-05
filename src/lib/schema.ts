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
  headline: string | null; // Big Idea — one Vietnamese sentence the whole report supports
  insights: string; // JSON: Insight[]
  is_dirty: Generated<number>;
  generated_at: Generated<number>;
}

export type StatisticsReport = Selectable<StatisticsReportTable>;
export type NewStatisticsReport = Insertable<StatisticsReportTable>;

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
}
