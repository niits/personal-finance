import type { NextRequest } from "next/server";
import { getKysely } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { Errors } from "@/lib/errors";
import { parseAmount } from "@/lib/validators";
import type { Kysely } from "kysely";
import type { Database } from "@/lib/schema";
import { sql } from "kysely";

type BudgetWithActive = { id: number; name: string; amount: number; is_active: number; created_at: number };

async function withSpent(
  db: Kysely<Database>,
  budgets: BudgetWithActive[],
) {
  if (budgets.length === 0) return budgets.map((b) => ({ ...b, spent: 0 }));

  const ids = budgets.map((b) => b.id);
  const results = await db
    .selectFrom("transaction_custom_budget as tcb")
    .innerJoin("transaction as t", "t.id", "tcb.transaction_id")
    .select([
      "tcb.custom_budget_id",
      sql<number>`COALESCE(SUM(t.amount), 0)`.as("spent"),
    ])
    .where("tcb.custom_budget_id", "in", ids)
    .where("t.type", "=", "expense")
    .groupBy("tcb.custom_budget_id")
    .execute();

  const spentMap = new Map(results.map((r) => [r.custom_budget_id, r.spent]));
  return budgets.map((b) => ({ ...b, spent: spentMap.get(b.id) ?? 0 }));
}

export async function GET(request: NextRequest) {
  const session = await requireSession(request);
  if (!session) return Errors.unauthorized();

  const activeOnly = request.nextUrl.searchParams.get("active_only") === "true";
  const db = await getKysely();

  let query = db
    .selectFrom("custom_budget")
    .select(["id", "name", "amount", "is_active", "created_at"])
    .where("user_id", "=", session.user.id)
    .orderBy("created_at", "desc");

  if (activeOnly) {
    query = query.where("is_active", "=", 1);
  }

  const results = (await query.execute()) as BudgetWithActive[];
  const budgets = await withSpent(db, results);
  return Response.json({ custom_budgets: budgets });
}

export async function POST(request: NextRequest) {
  const session = await requireSession(request);
  if (!session) return Errors.unauthorized();

  const body = await request.json().catch(() => null);
  if (!body) return Errors.validation("Request body không hợp lệ");

  const b = body as Record<string, unknown>;
  if (typeof b.name !== "string" || b.name.trim().length === 0)
    return Errors.validation("Tên không được để trống");
  if (b.name.trim().length > 100) return Errors.validation("Tên tối đa 100 ký tự");

  const amount = parseAmount(b.amount);
  if (!amount) return Errors.validation("Số tiền mục tiêu phải là số nguyên lớn hơn 0");

  const db = await getKysely();
  const result = (await db
    .insertInto("custom_budget")
    .values({ user_id: session.user.id, name: b.name.trim(), amount })
    .returning(["id", "name", "amount", "is_active", "created_at"])
    .executeTakeFirst()) as BudgetWithActive;

  return Response.json({ custom_budget: { ...result, spent: 0 } }, { status: 201 });
}
