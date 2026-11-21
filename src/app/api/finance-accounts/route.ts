import type { NextRequest } from "next/server";
import { getKysely } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { Errors } from "@/lib/errors";
import { sql } from "kysely";

export async function GET(request: NextRequest) {
  const session = await requireSession(request);
  if (!session) return Errors.unauthorized();
  const db = await getKysely();
  // Balance = movements on the account (finance_account_id) plus, for overdraft
  // accounts, purchases paid from it (overdraft_account_id). Must match the
  // finance_balance_* triggers.
  const accounts = await db.selectFrom("finance_account as a")
    .select(["a.id", "a.type", "a.name", "a.debt_direction", "a.note", "a.is_overdraft", "a.created_at"])
    .select(sql<number>`(SELECT COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END), 0)
      FROM "transaction" AS t WHERE t.finance_account_id = a.id AND t.user_id = a.user_id)
      + (SELECT COALESCE(SUM(t.amount), 0)
      FROM "transaction" AS t WHERE t.overdraft_account_id = a.id AND t.user_id = a.user_id)`.as("balance"))
    .where("a.user_id", "=", session.user.id)
    .orderBy("a.created_at", "desc")
    .execute();
  const transactions = await db.selectFrom("transaction")
    .select(["id", "finance_account_id", "overdraft_account_id", "amount", "type", "date", "note"])
    .where("user_id", "=", session.user.id)
    .where((eb) => eb.or([eb("finance_account_id", "is not", null), eb("overdraft_account_id", "is not", null)]))
    .orderBy("date", "desc").orderBy("id", "desc").execute();
  return Response.json({ accounts: accounts.map((account) => ({
    ...account,
    is_overdraft: account.is_overdraft === 1,
    transactions: transactions
      .filter((transaction) => transaction.finance_account_id === account.id || transaction.overdraft_account_id === account.id)
      .map(({ overdraft_account_id, ...transaction }) => ({ ...transaction, overdraft_purchase: overdraft_account_id === account.id })),
  })) });
}

export async function POST(request: NextRequest) {
  const session = await requireSession(request);
  if (!session) return Errors.unauthorized();
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  // An overdraft account is always a bank borrowing account.
  const isOverdraft = body?.is_overdraft === true;
  if (body && isOverdraft) Object.assign(body, { type: "debt", debt_direction: "borrow" });
  if (!body || (body.type !== "debt" && body.type !== "savings") || typeof body.name !== "string" || !body.name.trim())
    return Errors.validation("Loại và tên tài khoản là bắt buộc");
  if (body.type === "debt" && body.debt_direction !== "lend" && body.debt_direction !== "borrow")
    return Errors.validation("Tài khoản nợ cần xác định cho vay hoặc đi vay");
  const db = await getKysely();
  const account = await db.insertInto("finance_account").values({
    id: crypto.randomUUID(), user_id: session.user.id, type: body.type,
    name: body.name.trim(), debt_direction: body.type === "debt" ? body.debt_direction as "lend" | "borrow" : null,
    note: typeof body.note === "string" ? body.note.trim() || null : null,
    is_overdraft: isOverdraft ? 1 : 0,
  }).returningAll().executeTakeFirstOrThrow();
  return Response.json({ account: { ...account, is_overdraft: account.is_overdraft === 1 } }, { status: 201 });
}
