import {
  getDoc,
  serverTimestamp,
  setDoc,
  type Firestore,
  type Timestamp,
} from "firebase/firestore";
import { budgetConfigDoc } from "@/lib/firestore-refs";

export const DEFAULT_AMOUNT = 10_000_000;

export async function getBudgetConfig(
  db: Firestore,
  uid: string,
): Promise<{ defaultMonthlyAmount: number; updatedAt: Timestamp | null }> {
  const snap = await getDoc(budgetConfigDoc(db, uid));
  if (!snap.exists()) return { defaultMonthlyAmount: DEFAULT_AMOUNT, updatedAt: null };
  const data = snap.data();
  return { defaultMonthlyAmount: data.defaultMonthlyAmount, updatedAt: data.updatedAt };
}

export async function setBudgetConfig(
  db: Firestore,
  uid: string,
  amount: number,
): Promise<void> {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Số tiền mặc định phải là số nguyên lớn hơn 0");
  }
  await setDoc(
    budgetConfigDoc(db, uid),
    {
      defaultMonthlyAmount: amount,
      updatedAt: serverTimestamp() as unknown as Timestamp,
    },
    { merge: true },
  );
}
