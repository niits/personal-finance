import type { NextRequest } from "next/server";
import { getKysely, getDB } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { Errors } from "@/lib/errors";
import { getDebtWithRepayments, debtOpeningTxType } from "@/lib/debt";

export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return Errors.unauthorized();

  const userId = session.user.id;
  const db = await getKysely();

  const debts = await db
    .selectFrom("debt")
    .selectAll()
    .where("user_id", "=", userId)
    .orderBy("created_at", "desc")
    .execute();

  const withDetails = await Promise.all(
    debts.map((d) => getDebtWithRepayments(db, d.id, userId)),
  );
  const valid = withDetails.filter(Boolean);

  return Response.json({
    lending:   valid.filter((d) => d!.type === "lend"   && d!.status === "open"),
    borrowing: valid.filter((d) => d!.type === "borrow" && d!.status === "open"),
    settled:   valid.filter((d) => d!.status === "settled"),
  });
}

export async function POST(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return Errors.unauthorized();

  const userId = session.user.id;

  let body: Record<string, unknown>;
  try { body = await req.json() as Record<string, unknown>; }
  catch { return Errors.validation("Invalid JSON"); }

  const { type, party, note, due_date, amount, date, transaction_note } = body;

  if (type !== "lend" && type !== "borrow")
    return Errors.validation("type must be 'lend' or 'borrow'");
  if (typeof party !== "string" || !party.trim())
    return Errors.validation("party is required");
  if (typeof amount !== "number" || amount <= 0 || !Number.isInteger(amount))
    return Errors.validation("amount must be a positive integer");
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    return Errors.validation("date must be YYYY-MM-DD");
  if (due_date !== undefined && due_date !== null && typeof due_date !== "string")
    return Errors.validation("due_date must be YYYY-MM-DD or null");

  const debtId = crypto.randomUUID();
  const txType = debtOpeningTxType(type);
  const d1 = await getDB();

  // Atomic 3-step: insert debt (opening_transaction_id=NULL) → insert opening tx
  // → update debt with the new tx id. Both FKs are nullable so SQLite allows
  // this without deferred constraints.
  const [, txResult] = await d1.batch([
    d1.prepare(
      `INSERT INTO debt (id, user_id, type, party, note, due_date, status)
       VALUES (?, ?, ?, ?, ?, ?, 'open')`
    ).bind(debtId, userId, type, party.trim(), note ?? null, due_date ?? null),

    d1.prepare(
      `INSERT INTO "transaction" (user_id, amount, type, date, note, debt_id)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(userId, amount, txType, date, transaction_note ?? null, debtId),
  ]);

  const openingTxId = (txResult as { meta: { last_row_id: number } }).meta.last_row_id;

  await d1.prepare(
    `UPDATE debt SET opening_transaction_id = ? WHERE id = ?`
  ).bind(openingTxId, debtId).run();

  const db = await getKysely();
  const debt = await getDebtWithRepayments(db, debtId, userId);
  return Response.json({ debt }, { status: 201 });
}
