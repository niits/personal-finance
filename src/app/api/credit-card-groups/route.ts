import type { NextRequest } from "next/server";
import { getKysely } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { Errors } from "@/lib/errors";
import { sql } from "kysely";

export async function GET(request: NextRequest) {
  const session = await requireSession(request);
  if (!session) return Errors.unauthorized();
  const db = await getKysely();
  const groups = await db.selectFrom("credit_card_group as g")
    .selectAll("g")
    .where("g.user_id", "=", session.user.id).orderBy("g.created_at", "desc").execute();
  const statements = await db.selectFrom("credit_card_statement as s")
    .selectAll("s").where("s.user_id", "=", session.user.id).orderBy("s.period_end", "desc").execute();
  const purchases = await db.selectFrom("transaction as t")
    .select(["t.id", "t.amount", "t.date", "t.note", "t.credit_card_group_id"])
    .where("t.user_id", "=", session.user.id).where("t.type", "=", "expense").execute();
  const enriched = groups.map((group) => ({ ...group, statements: statements.filter((statement) => statement.group_id === group.id).map((statement) => ({
    ...statement,
    amount: purchases.filter((purchase) => purchase.credit_card_group_id === group.id && purchase.date >= statement.period_start && purchase.date < statement.period_end)
      .reduce((sum, purchase) => sum + purchase.amount, 0),
    purchases: purchases.filter((purchase) => purchase.credit_card_group_id === group.id && purchase.date >= statement.period_start && purchase.date < statement.period_end),
  })) }));
  return Response.json({ groups: enriched });
}

export async function POST(request: NextRequest) {
  const session = await requireSession(request);
  if (!session) return Errors.unauthorized();
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.name !== "string" || !body.name.trim() || !Number.isInteger(body.statement_close_day) || Number(body.statement_close_day) < 1 || Number(body.statement_close_day) > 31)
    return Errors.validation("Tên nhóm và ngày chốt sao kê từ 1 đến 31 là bắt buộc");
  const group = await (await getKysely()).insertInto("credit_card_group").values({ id: crypto.randomUUID(), user_id: session.user.id, name: body.name.trim(), statement_close_day: Number(body.statement_close_day) }).returningAll().executeTakeFirstOrThrow();
  return Response.json({ group }, { status: 201 });
}
