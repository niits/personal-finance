import type { NextRequest } from "next/server";
import { getDB } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { Errors } from "@/lib/errors";
import { parseAmount } from "@/lib/validators";

async function withSpent(
  db: D1Database,
  budgets: { id: number; name: string; amount: number; is_active: number; created_at: number }[],
) {
  if (budgets.length === 0) return budgets.map((b) => ({ ...b, spent: 0 }));

  const placeholders = budgets.map(() => "?").join(",");
  const ids = budgets.map((b) => b.id);

  const { results } = await db
    .prepare(
      `SELECT tcb.custom_budget_id, COALESCE(SUM(t.amount), 0) as spent FROM transaction_custom_budget tcb JOIN "transaction" t ON tcb.transaction_id = t.id WHERE tcb.custom_budget_id IN (${placeholders}) AND t.type = 'expense' GROUP BY tcb.custom_budget_id`,
    )
    .bind(...ids)
    .all<{ custom_budget_id: number; spent: number }>();

  const spentMap = new Map(results.map((r) => [r.custom_budget_id, r.spent]));
  return budgets.map((b) => ({ ...b, spent: spentMap.get(b.id) ?? 0 }));
}

export async function GET(request: NextRequest) {
  const session = await requireSession(request);
  if (!session) return Errors.unauthorized();

  const activeOnly = request.nextUrl.searchParams.get("active_only") === "true";
  const db = await getDB();

  const query = activeOnly
    ? "SELECT id, name, amount, is_active, created_at FROM custom_budget WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC"
    : "SELECT id, name, amount, is_active, created_at FROM custom_budget WHERE user_id = ? ORDER BY created_at DESC";

  const { results } = await db
    .prepare(query)
    .bind(session.user.id)
    .all<{ id: number; name: string; amount: number; is_active: number; created_at: number }>();

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

  const db = await getDB();
  const result = await db
    .prepare(
      "INSERT INTO custom_budget (user_id, name, amount) VALUES (?, ?, ?) RETURNING id, name, amount, is_active, created_at",
    )
    .bind(session.user.id, b.name.trim(), amount)
    .first<{ id: number; name: string; amount: number; is_active: number; created_at: number }>();

  return Response.json({ custom_budget: { ...result, spent: 0 } }, { status: 201 });
}
