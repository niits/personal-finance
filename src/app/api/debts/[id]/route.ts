import type { NextRequest } from "next/server";
import { getKysely, getDB } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { Errors } from "@/lib/errors";
import { getDebtWithRepayments } from "@/lib/debt";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  const session = await requireSession(req);
  if (!session) return Errors.unauthorized();

  const { id } = await params;
  const db = await getKysely();
  const debt = await getDebtWithRepayments(db, id, session.user.id);
  if (!debt) return Errors.notFound("Debt not found");
  return Response.json({ debt });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await requireSession(req);
  if (!session) return Errors.unauthorized();

  const { id } = await params;
  const db = await getKysely();

  const existing = await db
    .selectFrom("debt")
    .select(["id"])
    .where("id", "=", id)
    .where("user_id", "=", session.user.id)
    .executeTakeFirst();
  if (!existing) return Errors.notFound("Debt not found");

  let body: Record<string, unknown>;
  try { body = await req.json() as Record<string, unknown>; }
  catch { return Errors.validation("Invalid JSON"); }

  const update: Record<string, unknown> = {};
  if (typeof body.party === "string" && body.party.trim())
    update.party = body.party.trim();
  if ("note" in body)
    update.note = typeof body.note === "string" ? body.note : null;
  if ("due_date" in body)
    update.due_date = typeof body.due_date === "string" ? body.due_date : null;
  if (body.status === "open" || body.status === "settled")
    update.status = body.status;

  if (Object.keys(update).length === 0)
    return Errors.validation("Nothing to update");

  await db.updateTable("debt").set(update).where("id", "=", id).execute();

  const debt = await getDebtWithRepayments(db, id, session.user.id);
  return Response.json({ debt });
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const session = await requireSession(req);
  if (!session) return Errors.unauthorized();

  const { id } = await params;
  const db = await getKysely();

  const existing = await db
    .selectFrom("debt")
    .select(["id"])
    .where("id", "=", id)
    .where("user_id", "=", session.user.id)
    .executeTakeFirst();
  if (!existing) return Errors.notFound("Debt not found");

  // Debt-only expense entries (lend openings, borrow repayments) have no budget,
  // so FK ON DELETE SET NULL would leave them violating the transaction CHECK
  // (an expense must have a budget or a debt). Remove just those, then delete the
  // debt — SET NULL detaches the remaining valid transactions. Run as a single D1
  // batch so it is atomic (D1 has no interactive BEGIN/COMMIT transactions).
  const delTxns = db
    .deleteFrom("transaction")
    .where("debt_id", "=", id)
    .where("type", "=", "expense")
    .where("monthly_budget_id", "is", null)
    .compile();
  const delDebt = db.deleteFrom("debt").where("id", "=", id).compile();

  const d1 = await getDB();
  await d1.batch([
    d1.prepare(delTxns.sql).bind(...delTxns.parameters),
    d1.prepare(delDebt.sql).bind(...delDebt.parameters),
  ]);
  return new Response(null, { status: 204 });
}
