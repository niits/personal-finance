import type { NextRequest } from "next/server";
import { getKysely } from "@/lib/db";
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

  // FK ON DELETE SET NULL clears transaction.debt_id automatically.
  await db.deleteFrom("debt").where("id", "=", id).execute();
  return new Response(null, { status: 204 });
}
