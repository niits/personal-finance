import {
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Firestore,
  type Timestamp,
} from "firebase/firestore";
import { categoriesCol, transactionsCol } from "@/lib/firestore-refs";
import type {
  Transaction,
  TransactionDoc,
  Type,
} from "@/lib/schema";
import { getBudgetMonthForDate } from "@/lib/validators";
import { isLeafCategory } from "./categories";
import { getBudgetByMonth } from "./monthly-budgets";
import { getCustomBudgetsByIds } from "./custom-budgets";

export class TransactionError extends Error {
  constructor(public code: string, message: string, public details?: Record<string, unknown>) {
    super(message);
  }
}

export type CreateTransactionInput = {
  amount: number;
  type: Type;
  categoryId: string;
  date: string;
  note: string | null;
  customBudgetIds?: string[];
};

export async function createTransaction(
  db: Firestore,
  uid: string,
  input: CreateTransactionInput,
): Promise<Transaction> {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new TransactionError("VALIDATION", "Số tiền phải là số nguyên lớn hơn 0");
  }
  if (input.type !== "expense" && input.type !== "income") {
    throw new TransactionError("VALIDATION", "Loại giao dịch phải là 'expense' hoặc 'income'");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    throw new TransactionError("VALIDATION", "Ngày không hợp lệ. Dùng định dạng YYYY-MM-DD");
  }

  // Validate category ownership and leaf status.
  const catSnap = await getDoc(doc(categoriesCol(db, uid), input.categoryId));
  if (!catSnap.exists()) throw new TransactionError("NOT_FOUND", "Danh mục không tồn tại");
  if (!(await isLeafCategory(db, uid, input.categoryId))) {
    throw new TransactionError("VALIDATION", "Chỉ được chọn danh mục không có danh mục con");
  }

  const customBudgetIds = (input.customBudgetIds ?? []).filter((s) => typeof s === "string");

  if (input.type === "income" && customBudgetIds.length > 0) {
    throw new TransactionError("VALIDATION", "Giao dịch thu nhập không thể gán vào Custom Budget");
  }

  let monthlyBudgetId: string | null = null;
  if (input.type === "expense") {
    const month = getBudgetMonthForDate(input.date);
    const budget = await getBudgetByMonth(db, uid, month);
    if (!budget) {
      throw new TransactionError(
        "MONTHLY_BUDGET_MISSING",
        `Chưa có budget tháng ${month}. Vui lòng tạo budget trước.`,
        { month },
      );
    }
    monthlyBudgetId = budget.id;
  }

  if (customBudgetIds.length > 0) {
    const valid = await getCustomBudgetsByIds(db, uid, customBudgetIds);
    if (valid.length !== customBudgetIds.length) {
      throw new TransactionError("FORBIDDEN", "Custom budget không hợp lệ");
    }
  }

  const data: TransactionDoc = {
    amount: input.amount,
    type: input.type,
    categoryId: input.categoryId,
    note: input.note,
    date: input.date,
    monthlyBudgetId,
    customBudgetIds,
    createdAt: serverTimestamp() as unknown as Timestamp,
    updatedAt: serverTimestamp() as unknown as Timestamp,
  };
  const ref = await addDoc(transactionsCol(db, uid), data);
  const created = await getDoc(ref);
  return { id: ref.id, ...(created.data() as TransactionDoc) };
}

export type UpdateTransactionInput = {
  amount?: number;
  type?: Type;
  categoryId?: string;
  date?: string;
  note?: string | null;
  customBudgetIds?: string[];
};

export async function updateTransaction(
  db: Firestore,
  uid: string,
  id: string,
  input: UpdateTransactionInput,
): Promise<Transaction> {
  const ref = doc(transactionsCol(db, uid), id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new TransactionError("NOT_FOUND", "Giao dịch không tồn tại");
  const existing = snap.data();

  const newType: Type = input.type ?? existing.type;
  const newDate = input.date ?? existing.date;
  if (input.date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
    throw new TransactionError("VALIDATION", "Ngày không hợp lệ. Dùng định dạng YYYY-MM-DD");
  }
  const newCategoryId = input.categoryId ?? existing.categoryId;
  if (input.amount !== undefined && (!Number.isInteger(input.amount) || input.amount <= 0)) {
    throw new TransactionError("VALIDATION", "Số tiền phải là số nguyên lớn hơn 0");
  }

  const newCustomBudgetIds =
    input.customBudgetIds !== undefined
      ? input.customBudgetIds.filter((s) => typeof s === "string")
      : undefined;

  if (newType === "income" && newCustomBudgetIds && newCustomBudgetIds.length > 0) {
    throw new TransactionError("VALIDATION", "Giao dịch thu nhập không thể gán vào Custom Budget");
  }

  if (input.categoryId !== undefined) {
    const catSnap = await getDoc(doc(categoriesCol(db, uid), newCategoryId));
    if (!catSnap.exists()) throw new TransactionError("NOT_FOUND", "Danh mục không tồn tại");
    if (!(await isLeafCategory(db, uid, newCategoryId))) {
      throw new TransactionError("VALIDATION", "Chỉ được chọn danh mục không có danh mục con");
    }
  }

  let newMonthlyBudgetId: string | null = existing.monthlyBudgetId;
  if (newType === "income") {
    newMonthlyBudgetId = null;
  } else if (input.date !== undefined || input.type !== undefined) {
    const month = getBudgetMonthForDate(newDate);
    const budget = await getBudgetByMonth(db, uid, month);
    if (!budget) {
      throw new TransactionError(
        "MONTHLY_BUDGET_MISSING",
        `Chưa có budget tháng ${month}. Vui lòng tạo budget trước.`,
        { month },
      );
    }
    newMonthlyBudgetId = budget.id;
  }

  if (newCustomBudgetIds && newCustomBudgetIds.length > 0) {
    const valid = await getCustomBudgetsByIds(db, uid, newCustomBudgetIds);
    if (valid.length !== newCustomBudgetIds.length) {
      throw new TransactionError("FORBIDDEN", "Custom budget không hợp lệ");
    }
  }

  const updates: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (input.amount !== undefined) updates.amount = input.amount;
  if (input.type !== undefined) updates.type = newType;
  if (input.categoryId !== undefined) updates.categoryId = newCategoryId;
  if (input.note !== undefined) updates.note = input.note;
  if (input.date !== undefined) updates.date = newDate;
  if (input.type !== undefined || input.date !== undefined) {
    updates.monthlyBudgetId = newMonthlyBudgetId;
  }
  if (newCustomBudgetIds !== undefined) updates.customBudgetIds = newCustomBudgetIds;

  await updateDoc(ref, updates);
  const updated = await getDoc(ref);
  return { id: ref.id, ...(updated.data() as TransactionDoc) };
}

export async function deleteTransaction(
  db: Firestore,
  uid: string,
  id: string,
): Promise<void> {
  const ref = doc(transactionsCol(db, uid), id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new TransactionError("NOT_FOUND", "Giao dịch không tồn tại");
  await deleteDoc(ref);
}

// List transactions in [startDate, endDate] inclusive.
export async function listTransactionsInRange(
  db: Firestore,
  uid: string,
  startDate: string,
  endDate: string,
  filters?: { type?: Type; categoryId?: string; customBudgetId?: string },
): Promise<Transaction[]> {
  // Build a single composite query when possible, but Firestore caps inequality
  // filters to one field. Date range is the inequality; type/category use equality.
  const constraints = [
    where("date", ">=", startDate),
    where("date", "<=", endDate),
  ] as const;
  let q = query(transactionsCol(db, uid), ...constraints, orderBy("date", "desc"));

  if (filters?.type) q = query(q, where("type", "==", filters.type));
  if (filters?.categoryId) q = query(q, where("categoryId", "==", filters.categoryId));
  if (filters?.customBudgetId) {
    q = query(q, where("customBudgetIds", "array-contains", filters.customBudgetId));
  }

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export type RangeSummary = {
  total_expense: number;
  total_income: number;
  savings: number;
};

export function summarize(txns: Transaction[]): RangeSummary {
  let exp = 0;
  let inc = 0;
  for (const t of txns) {
    if (t.type === "expense") exp += t.amount;
    else inc += t.amount;
  }
  return { total_expense: exp, total_income: inc, savings: inc - exp };
}
