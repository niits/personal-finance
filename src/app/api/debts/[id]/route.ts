import type { NextRequest } from "next/server";
import { getKysely } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { Errors } from "@/lib/errors";
import { getDebtWithRepayments } from "@/lib/debt";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession(req);
  if (!session) return Errors.unauthorized();

  const { id } = await params;
  const db = await getKysely();
  const debt = await getDebtWithRepayments(db, id, session.user.id);

  if (!debt) return Errors.notFound("Debt not found");
  return Response.json({ debt });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

  let body: { party?: unknown; note?: unknown };
  try {
    body = await req.json() as typeof body;
  } catch {
    return Errors.validation("Invalid JSON");
  }

  const update: { party?: string; note?: string | null } = {};
  if (typeof body.party === "string" && body.party.trim()) update.party = body.party.trim();
  if ("note" in body) update.note = typeof body.note === "string" ? body.note : null;

  if (Object.keys(update).length === 0)
    return Errors.validation("Nothing to update");

  await db.updateTable("debt").set(update).where("id", "=", id).execute();

  const debt = await getDebtWithRepayments(db, id, session.user.id);
  return Response.json({ debt });
}
