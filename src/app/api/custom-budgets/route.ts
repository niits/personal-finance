import type { NextRequest } from "next/server";
import { getKysely } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { Errors } from "@/lib/errors";
import { parseAmount } from "@/lib/validators";
import type { Kysely } from "kysely";
import type { Database } from "@/lib/schema";
import { sql } from "kysely";

type BudgetWithActive = { id: number; name: string; amount: number; is_active: number; created_at: number };

async function withStats(
  db: Kysely<Database>,
  budgets: BudgetWithActive[],
) {
  if (budgets.length === 0) return budgets.map((b) => ({ ...b, spent: 0, linked_transaction_count: 0, adjustments: [] }));

  const ids = budgets.map((b) => b.id);
  const [results, adjustments] = await Promise.all([db
    .selectFrom("transaction_custom_budget as tcb")
    .innerJoin("transaction as t", "t.id", "tcb.transaction_id")
    .select([
      "tcb.custom_budget_id",
      sql<number>`COALESCE(SUM(t.amount), 0)`.as("spent"),
      sql<number>`COUNT(tcb.transaction_id)`.as("linked_transaction_count"),
    ])
    .where("tcb.custom_budget_id", "in", ids)
    .where("t.type", "=", "expense")
    .groupBy("tcb.custom_budget_id")
    .execute(), db
      .selectFrom("custom_budget_adjustment")
      .select(["id", "custom_budget_id", "previous_amount", "new_amount", "created_at"])
      .where("custom_budget_id", "in", ids)
      .orderBy("created_at", "asc")
      .orderBy("id", "asc")
      .execute()]);

  const statsMap = new Map(results.map((r) => [r.custom_budget_id, r]));
  const adjustmentsMap = new Map<number, typeof adjustments>();
  for (const adjustment of adjustments) {
    const current = adjustmentsMap.get(adjustment.custom_budget_id) ?? [];
    current.push(adjustment);
    adjustmentsMap.set(adjustment.custom_budget_id, current);
  }
  return budgets.map((b) => ({
    ...b,
    spent: statsMap.get(b.id)?.spent ?? 0,
    linked_transaction_count: statsMap.get(b.id)?.linked_transaction_count ?? 0,
    adjustments: adjustmentsMap.get(b.id) ?? [],
  }));
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
  const budgets = await withStats(db, results);
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

  return Response.json({ custom_budget: { ...result, spent: 0, linked_transaction_count: 0, adjustments: [] } }, { status: 201 });
}
