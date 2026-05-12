// Firestore document type definitions (client SDK).
// Stored shape uses camelCase + Firestore Timestamps. UI converts to display strings.
import type { Timestamp } from "firebase/firestore";

export type Type = "income" | "expense";
export type RunStatus = "pending" | "available" | "done";

export type CategoryDoc = {
  name: string;
  parentId: string | null;
  level: number;
  sortOrder: number;
  type: Type;
  createdAt: Timestamp;
};

export type MonthlyBudgetDoc = {
  month: string;
  amount: number;
  startDate: string | null;
  endDate: string | null;
  createdAt: Timestamp;
};

export type AdjustmentDoc = {
  delta: number;
  note: string | null;
  createdAt: Timestamp;
};

export type CustomBudgetDoc = {
  name: string;
  amount: number;
  isActive: boolean;
  createdAt: Timestamp;
};

export type TransactionDoc = {
  amount: number;
  type: Type;
  categoryId: string;
  note: string | null;
  date: string;
  monthlyBudgetId: string | null;
  customBudgetIds: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type BudgetConfigDoc = {
  defaultMonthlyAmount: number;
  updatedAt: Timestamp;
};

export type AiSuggestionRunDoc = {
  fromUpdatedAt: Timestamp | null;
  upToUpdatedAt: Timestamp;
  status: RunStatus;
  createdAt: Timestamp;
};

// Identity: each "WithId" attaches the Firestore doc id to the data shape.
export type WithId<T> = T & { id: string };

export type Category = WithId<CategoryDoc>;
export type MonthlyBudget = WithId<MonthlyBudgetDoc>;
export type Adjustment = WithId<AdjustmentDoc>;
export type CustomBudget = WithId<CustomBudgetDoc>;
export type Transaction = WithId<TransactionDoc>;
export type AiSuggestionRun = WithId<AiSuggestionRunDoc>;
