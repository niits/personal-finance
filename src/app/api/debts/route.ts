import type { NextRequest } from "next/server";
import { getKysely } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { Errors } from "@/lib/errors";
import { getDebtWithRepayments, debtOpeningTxType } from "@/lib/debt";
import { sql } from "kysely";

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

  const withRepayments = await Promise.all(
    debts.map((d) => getDebtWithRepayments(db, d.id, userId))
  );

  const lending = withRepayments.filter((d) => d?.type === "lend" && d.status === "open");
  const borrowing = withRepayments.filter((d) => d?.type === "borrow" && d.status === "open");
  const settled = withRepayments.filter((d) => d?.status === "settled");

  return Response.json({ lending, borrowing, settled });
}

export async function POST(req: NextRequest) {
  const session = await requireSession(req);
  if (!session) return Errors.unauthorized();

  const userId = session.user.id;

  let body: { type?: unknown; party?: unknown; amount?: unknown; note?: unknown; date?: unknown };
  try {
    body = await req.json() as typeof body;
  } catch {
    return Errors.validation("Invalid JSON");
  }

  const { type, party, amount, note, date } = body;

  if (type !== "lend" && type !== "borrow")
    return Errors.validation("type must be 'lend' or 'borrow'");
  if (typeof party !== "string" || party.trim() === "")
    return Errors.validation("party is required");
  if (typeof amount !== "number" || amount <= 0 || !Number.isInteger(amount))
    return Errors.validation("amount must be a positive integer");

  const txDate = typeof date === "string" ? date : new Date().toISOString().slice(0, 10);
  const debtId = crypto.randomUUID();
  const db = await getKysely();
  const d1 = await import("@/lib/db").then((m) => m.getDB());

  // Atomic: insert debt + opening transaction in one D1 batch
  await d1.batch([
    d1.prepare(
      `INSERT INTO debt (id, user_id, type, party, amount, note) VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(debtId, userId, type, party.trim(), amount, note ?? null),

    d1.prepare(
      `INSERT INTO "transaction" (user_id, amount, type, date, debt_id) VALUES (?, ?, ?, ?, ?)`
    ).bind(userId, amount, debtOpeningTxType(type), txDate, debtId),
  ]);

  const debt = await getDebtWithRepayments(db, debtId, userId);
  return Response.json({ debt }, { status: 201 });
}
