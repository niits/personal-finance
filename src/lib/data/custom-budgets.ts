import {
  addDoc,
  arrayRemove,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
  type Timestamp,
} from "firebase/firestore";
import { customBudgetsCol, transactionsCol } from "@/lib/firestore-refs";
import type {
  CustomBudget,
  CustomBudgetDoc,
} from "@/lib/schema";

export class CustomBudgetError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

export type CustomBudgetWithSpent = CustomBudget & { spent: number };

export async function listCustomBudgets(
  db: Firestore,
  uid: string,
  opts?: { activeOnly?: boolean },
): Promise<CustomBudgetWithSpent[]> {
  let q = query(customBudgetsCol(db, uid), orderBy("createdAt", "desc"));
  if (opts?.activeOnly) {
    q = query(customBudgetsCol(db, uid), where("isActive", "==", true), orderBy("createdAt", "desc"));
  }
  const snap = await getDocs(q);
  const budgets: CustomBudget[] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (budgets.length === 0) return [];

  // Compute spent per budget by reading all expense transactions that reference any of these budgets.
  // Firestore in-clause limit is 30; chunk if needed.
  const ids = budgets.map((b) => b.id);
  const spentByBudget = new Map<string, number>();
  for (let i = 0; i < ids.length; i += 30) {
    const chunk = ids.slice(i, i + 30);
    const txSnap = await getDocs(
      query(
        transactionsCol(db, uid),
        where("type", "==", "expense"),
        where("customBudgetIds", "array-contains-any", chunk),
      ),
    );
    for (const t of txSnap.docs) {
      const data = t.data();
      for (const cbId of data.customBudgetIds) {
        if (!chunk.includes(cbId)) continue;
        spentByBudget.set(cbId, (spentByBudget.get(cbId) ?? 0) + data.amount);
      }
    }
  }

  return budgets.map((b) => ({ ...b, spent: spentByBudget.get(b.id) ?? 0 }));
}

export async function createCustomBudget(
  db: Firestore,
  uid: string,
  input: { name: string; amount: number },
): Promise<CustomBudget> {
  const name = input.name.trim();
  if (name.length === 0) throw new CustomBudgetError("VALIDATION", "Tên không được để trống");
  if (name.length > 100) throw new CustomBudgetError("VALIDATION", "Tên tối đa 100 ký tự");
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new CustomBudgetError("VALIDATION", "Số tiền mục tiêu phải là số nguyên lớn hơn 0");
  }

  const data: CustomBudgetDoc = {
    name,
    amount: input.amount,
    isActive: true,
    createdAt: serverTimestamp() as unknown as Timestamp,
  };
  const ref = await addDoc(customBudgetsCol(db, uid), data);
  const created = await getDoc(ref);
  return { id: ref.id, ...(created.data() as CustomBudgetDoc) };
}

export async function updateCustomBudget(
  db: Firestore,
  uid: string,
  id: string,
  input: { name?: string; amount?: number; isActive?: boolean },
): Promise<void> {
  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (name.length === 0) throw new CustomBudgetError("VALIDATION", "Tên không được để trống");
    if (name.length > 100) throw new CustomBudgetError("VALIDATION", "Tên tối đa 100 ký tự");
    updates.name = name;
  }
  if (input.amount !== undefined) {
    if (!Number.isInteger(input.amount) || input.amount <= 0) {
      throw new CustomBudgetError("VALIDATION", "Số tiền mục tiêu phải là số nguyên lớn hơn 0");
    }
    updates.amount = input.amount;
  }
  if (input.isActive !== undefined) updates.isActive = input.isActive;
  if (Object.keys(updates).length === 0) {
    throw new CustomBudgetError("VALIDATION", "Không có trường nào để cập nhật");
  }
  await updateDoc(doc(customBudgetsCol(db, uid), id), updates);
}

// Delete + scrub the id from any transaction's customBudgetIds list.
// Note: not atomic with the delete — tolerate brief windows where the id is gone but still referenced.
export async function deleteCustomBudget(
  db: Firestore,
  uid: string,
  id: string,
): Promise<void> {
  const txSnap = await getDocs(
    query(transactionsCol(db, uid), where("customBudgetIds", "array-contains", id)),
  );
  if (!txSnap.empty) {
    const batch = writeBatch(db);
    for (const t of txSnap.docs) {
      batch.update(t.ref, { customBudgetIds: arrayRemove(id) });
    }
    await batch.commit();
  }
  await deleteDoc(doc(customBudgetsCol(db, uid), id));
}

export async function getCustomBudgetsByIds(
  db: Firestore,
  uid: string,
  ids: string[],
): Promise<CustomBudget[]> {
  if (ids.length === 0) return [];
  // documentId() in-clause supports up to 30 per query.
  const out: CustomBudget[] = [];
  for (let i = 0; i < ids.length; i += 30) {
    const chunk = ids.slice(i, i + 30);
    const snap = await getDocs(
      query(customBudgetsCol(db, uid), where(documentId(), "in", chunk)),
    );
    for (const d of snap.docs) out.push({ id: d.id, ...d.data() });
  }
  return out;
}
