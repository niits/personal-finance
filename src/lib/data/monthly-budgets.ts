import {
  addDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type Firestore,
  type Timestamp,
} from "firebase/firestore";
import { adjustmentsCol, monthlyBudgetsCol } from "@/lib/firestore-refs";
import type {
  Adjustment,
  AdjustmentDoc,
  MonthlyBudget,
  MonthlyBudgetDoc,
} from "@/lib/schema";
import { getBudgetPeriodInclusive } from "@/lib/validators";

export class BudgetError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

export async function getBudgetByMonth(
  db: Firestore,
  uid: string,
  month: string,
): Promise<MonthlyBudget | null> {
  const snap = await getDocs(
    query(monthlyBudgetsCol(db, uid), where("month", "==", month), limit(1)),
  );
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

export async function listAdjustments(
  db: Firestore,
  uid: string,
  budgetId: string,
): Promise<Adjustment[]> {
  const snap = await getDocs(
    query(adjustmentsCol(db, uid, budgetId), orderBy("createdAt", "asc")),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createMonthlyBudget(
  db: Firestore,
  uid: string,
  input: { month: string; amount: number },
): Promise<MonthlyBudget> {
  if (!/^\d{4}-\d{2}$/.test(input.month)) {
    throw new BudgetError("VALIDATION", "Tháng không hợp lệ. Dùng định dạng YYYY-MM");
  }
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new BudgetError("VALIDATION", "Số tiền phải là số nguyên lớn hơn 0");
  }

  const existing = await getBudgetByMonth(db, uid, input.month);
  if (existing) throw new BudgetError("CONFLICT", `Budget tháng ${input.month} đã tồn tại`);

  const { start_date, end_date } = getBudgetPeriodInclusive(input.month);
  const data: MonthlyBudgetDoc = {
    month: input.month,
    amount: input.amount,
    startDate: start_date,
    endDate: end_date,
    createdAt: serverTimestamp() as unknown as Timestamp,
  };
  const ref = await addDoc(monthlyBudgetsCol(db, uid), data);
  const created = await getDoc(ref);
  return { id: ref.id, ...(created.data() as MonthlyBudgetDoc) };
}

export async function adjustMonthlyBudget(
  db: Firestore,
  uid: string,
  budgetId: string,
  input: { delta: number; note: string | null },
): Promise<{ budget: MonthlyBudget; adjustment: Adjustment }> {
  if (!Number.isInteger(input.delta)) {
    throw new BudgetError("VALIDATION", "delta phải là số nguyên");
  }
  if (input.delta === 0) throw new BudgetError("VALIDATION", "Delta phải khác 0");

  const ref = doc(monthlyBudgetsCol(db, uid), budgetId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new BudgetError("NOT_FOUND", "Budget không tồn tại");
  const current = snap.data();
  const newAmount = current.amount + input.delta;
  if (newAmount <= 0) {
    throw new BudgetError(
      "VALIDATION",
      `Số tiền budget sau điều chỉnh phải lớn hơn 0. Hiện tại: ${current.amount} ₫, delta: ${input.delta} ₫`,
    );
  }

  const batch = writeBatch(db);
  batch.update(ref, { amount: increment(input.delta) });
  const adjRef = doc(adjustmentsCol(db, uid, budgetId));
  const adjData: AdjustmentDoc = {
    delta: input.delta,
    note: input.note,
    createdAt: serverTimestamp() as unknown as Timestamp,
  };
  batch.set(adjRef, adjData);
  await batch.commit();

  const updated = await getDoc(ref);
  const adjSnap = await getDoc(adjRef);
  return {
    budget: { id: ref.id, ...(updated.data() as MonthlyBudgetDoc) },
    adjustment: { id: adjRef.id, ...(adjSnap.data() as AdjustmentDoc) },
  };
}
