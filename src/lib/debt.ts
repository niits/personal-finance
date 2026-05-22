import type { Kysely } from "kysely";
import type { Database } from "./schema";

export type DebtWithRepayments = {
  id: string;
  type: "lend" | "borrow";
  party: string;
  amount: number;
  repaid: number;
  remaining: number;
  status: "open" | "settled";
  note: string | null;
  createdAt: string;
  repayments: { id: number; amount: number; date: string; note: string | null }[];
};

// Direction of the opening transaction for each debt type:
//   lend   → expense (money leaving me)
//   borrow → income  (money coming in)
export function debtOpeningTxType(debtType: "lend" | "borrow"): "expense" | "income" {
  return debtType === "lend" ? "expense" : "income";
}

// Direction of a repayment transaction (inverse of opening):
//   lend repayment   → income  (money coming back)
//   borrow repayment → expense (money going out)
export function repaymentTxType(debtType: "lend" | "borrow"): "expense" | "income" {
  return debtType === "lend" ? "income" : "expense";
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

  const repaymentTxDirection = repaymentTxType(debt.type);

  const txRows = await db
    .selectFrom("transaction")
    .select(["id", "amount", "date", "note"])
    .where("debt_id", "=", debtId)
    .where("type", "=", repaymentTxDirection)
    .orderBy("date", "asc")
    .execute();

  const repaid = txRows.reduce((sum, r) => sum + r.amount, 0);
  const remaining = Math.max(0, debt.amount - repaid);

  return {
    id: debt.id,
    type: debt.type,
    party: debt.party,
    amount: debt.amount,
    repaid,
    remaining,
    status: debt.status,
    note: debt.note,
    createdAt: debt.created_at,
    repayments: txRows.map((r) => ({
      id: r.id,
      amount: r.amount,
      date: r.date,
      note: r.note,
    })),
  };
}

export async function recalcAndSettle(
  db: Kysely<Database>,
  debtId: string,
  principal: number,
  debtType: "lend" | "borrow",
): Promise<void> {
  const repaymentDirection = repaymentTxType(debtType);

  const row = await db
    .selectFrom("transaction")
    .select((eb) => eb.fn.sum<number>("amount").as("total"))
    .where("debt_id", "=", debtId)
    .where("type", "=", repaymentDirection)
    .executeTakeFirst();

  const repaid = row?.total ?? 0;

  if (repaid >= principal) {
    await db
      .updateTable("debt")
      .set({ status: "settled" })
      .where("id", "=", debtId)
      .execute();
  }
}
