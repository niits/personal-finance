import type { NextRequest } from "next/server";
import { getKysely, getDB } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { Errors } from "@/lib/errors";
import { getDebtWithRepayments, repaymentTxType, recalcAndSettle } from "@/lib/debt";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession(req);
  if (!session) return Errors.unauthorized();

  const { id } = await params;
  const userId = session.user.id;
  const db = await getKysely();

  const debt = await db
    .selectFrom("debt")
    .selectAll()
    .where("id", "=", id)
    .where("user_id", "=", userId)
    .executeTakeFirst();

  if (!debt) return Errors.notFound("Debt not found");
  if (debt.status === "settled") return Errors.validation("Khoản nợ này đã tất toán");

  let body: { amount?: unknown; note?: unknown; date?: unknown };
  try {
    body = await req.json() as typeof body;
  } catch {
    return Errors.validation("Invalid JSON");
  }

  const { amount, note, date } = body;

  if (typeof amount !== "number" || amount <= 0 || !Number.isInteger(amount))
    return Errors.validation("amount must be a positive integer");

  const txDate = typeof date === "string" ? date : new Date().toISOString().slice(0, 10);
  const txType = repaymentTxType(debt.type);

  const d1 = await getDB();
  await d1.prepare(
    `INSERT INTO "transaction" (user_id, amount, type, date, note, debt_id) VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(userId, amount, txType, txDate, note ?? null, id).run();

  await recalcAndSettle(db, id, debt.amount, debt.type);

  const updated = await getDebtWithRepayments(db, id, userId);
  return Response.json({ debt: updated }, { status: 201 });
}
