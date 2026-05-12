// Centralized Firestore reference helpers (client SDK).
// Both UI and tests use these so paths stay in one place.
import {
  collection,
  doc,
  type Firestore,
  type CollectionReference,
  type DocumentReference,
} from "firebase/firestore";
import type {
  CategoryDoc,
  MonthlyBudgetDoc,
  AdjustmentDoc,
  CustomBudgetDoc,
  TransactionDoc,
  BudgetConfigDoc,
  AiSuggestionRunDoc,
} from "./schema";

export const userDoc = (db: Firestore, uid: string) => doc(db, "users", uid);

export const categoriesCol = (db: Firestore, uid: string) =>
  collection(db, "users", uid, "categories") as CollectionReference<CategoryDoc>;

export const monthlyBudgetsCol = (db: Firestore, uid: string) =>
  collection(db, "users", uid, "monthlyBudgets") as CollectionReference<MonthlyBudgetDoc>;

export const adjustmentsCol = (db: Firestore, uid: string, budgetId: string) =>
  collection(
    db,
    "users",
    uid,
    "monthlyBudgets",
    budgetId,
    "adjustments",
  ) as CollectionReference<AdjustmentDoc>;

export const customBudgetsCol = (db: Firestore, uid: string) =>
  collection(db, "users", uid, "customBudgets") as CollectionReference<CustomBudgetDoc>;

export const transactionsCol = (db: Firestore, uid: string) =>
  collection(db, "users", uid, "transactions") as CollectionReference<TransactionDoc>;

export const aiRunsCol = (db: Firestore, uid: string) =>
  collection(db, "users", uid, "aiSuggestionRuns") as CollectionReference<AiSuggestionRunDoc>;

export const budgetConfigDoc = (db: Firestore, uid: string) =>
  doc(db, "users", uid, "budgetConfig", "default") as DocumentReference<BudgetConfigDoc>;
