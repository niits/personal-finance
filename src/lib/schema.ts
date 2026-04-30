import type { Generated, Insertable, Selectable, Updateable } from "kysely";

// ─── monthly_budget ──────────────────────────────────────────────────────────
export interface MonthlyBudgetTable {
  id: Generated<number>;
  user_id: string;
  month: string;
  amount: number;
  start_date: string | null;
  end_date: string | null;
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

// ─── transaction ─────────────────────────────────────────────────────────────
export interface TransactionTable {
  id: Generated<number>;
  user_id: string;
  amount: number;
  type: "expense" | "income";
  category_id: number;
  note: string | null;
  date: string;
  monthly_budget_id: number | null;
  created_at: Generated<number>;
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

// ─── Database interface ───────────────────────────────────────────────────────
export interface Database {
  monthly_budget: MonthlyBudgetTable;
  budget_adjustment: BudgetAdjustmentTable;
  custom_budget: CustomBudgetTable;
  transaction: TransactionTable;
  transaction_custom_budget: TransactionCustomBudgetTable;
  category: CategoryTable;
  budget_config: BudgetConfigTable;
}
