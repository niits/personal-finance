import type { Kysely } from "kysely";
import type { Database } from "./schema";

export type LinkedTransaction = {
  id: number;
  type: "expense" | "income";
  amount: number;
  linked_amount: number | null;
  date: string;
  note: string | null;
  emoji: string | null;
  is_opening: boolean;
};

export type DebtWithRepayments = {
  id: string;
  type: "lend" | "borrow";
  party: string;
  note: string | null;
  due_date: string | null;
  status: "open" | "settled";
  opening_transaction_id: number | null;
  created_at: string;
  // computed
  opening_amount: number;
  total_repaid: number;
  remaining: number;
  is_overdue: boolean;
  transactions: LinkedTransaction[];
};

// Opening transaction type per debt type:
//   lend   → expense (user gives money out)
//   borrow → income  (user receives money)
export function debtOpeningTxType(debtType: "lend" | "borrow"): "expense" | "income" {
  return debtType === "lend" ? "expense" : "income";
}

// Repayment transaction type (inverse of opening):
//   lend repayment   → income  (user gets money back)
//   borrow repayment → expense (user pays money back)
export function repaymentTxType(debtType: "lend" | "borrow"): "expense" | "income" {
  return debtType === "lend" ? "income" : "expense";
}

// Remaining balance (SRS §3.4). May be negative when overpaid (D-09) or when the
// debt has no opening transaction (opening_amount = 0).
export function computeRemaining(openingAmount: number, totalRepaid: number): number {
  return openingAmount - totalRepaid;
}

// Overdue when a due date has passed and the debt is still open (SRS §3.4).
// Strict `<` — a debt due exactly today is not yet overdue.
export function isOverdue(
  dueDate: string | null,
  status: "open" | "settled",
  today: string,
): boolean {
  return !!dueDate && dueDate < today && status === "open";
}

export async function getDebtWithRepayments(
  db: Kysely<Database>,
  debtId: string,
  userId: string,
): Promise<DebtWithRepayments | null> {
  const debt = await db
    .selectFrom("debt")
    .selectAll()
    .where("id", "=", debtId)
    .where("user_id", "=", userId)
    .executeTakeFirst();

  if (!debt) return null;

  const txRows = await db
    .selectFrom("transaction")
    .select(["id", "type", "amount", "linked_amount", "date", "note", "emoji"])
    .where("debt_id", "=", debtId)
    .orderBy("date", "asc")
    .orderBy("id", "asc")
    .execute();

  const openingId = debt.opening_transaction_id;
  const openingTx = txRows.find((t) => t.id === openingId);
  const repayments = txRows.filter((t) => t.id !== openingId);

  const opening_amount = openingTx ? (openingTx.linked_amount ?? openingTx.amount) : 0;
  const total_repaid = repayments.reduce((s, t) => s + (t.linked_amount ?? t.amount), 0);
  const remaining = computeRemaining(opening_amount, total_repaid);

  const today = new Date().toISOString().slice(0, 10);
  const is_overdue = isOverdue(debt.due_date, debt.status, today);

  return {
    id: debt.id,
    type: debt.type,
    party: debt.party,
    note: debt.note,
    due_date: debt.due_date,
    status: debt.status,
    opening_transaction_id: debt.opening_transaction_id,
    created_at: debt.created_at,
    opening_amount,
    total_repaid,
    remaining,
    is_overdue,
    transactions: txRows.map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      linked_amount: t.linked_amount,
      date: t.date,
      note: t.note,
      emoji: t.emoji,
      is_opening: t.id === openingId,
    })),
  };
}
