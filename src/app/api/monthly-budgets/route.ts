import type { NextRequest } from "next/server";
import { getKysely } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { Errors } from "@/lib/errors";
import { parseAmount, parseMonth, currentBudgetMonth, getBudgetPeriodInclusive } from "@/lib/validators";
import type { Kysely } from "kysely";
import type { Database } from "@/lib/schema";

async function getBudgetWithAdjustments(db: Kysely<Database>, budgetId: number) {
  const budget = await db
    .selectFrom("monthly_budget")
    .select(["id", "user_id", "month", "amount", "created_at"])
    .where("id", "=", budgetId)
    .executeTakeFirst();

  if (!budget) return null;

  const adjustments = await db
    .selectFrom("budget_adjustment")
    .select(["id", "delta", "note", "created_at"])
    .where("monthly_budget_id", "=", budgetId)
    .orderBy("created_at", "asc")
    .execute();

  return { ...budget, adjustments };
}

export async function GET(request: NextRequest) {
  const session = await requireSession(request);
  if (!session) return Errors.unauthorized();

  const month = parseMonth(request.nextUrl.searchParams.get("month")) ?? currentBudgetMonth();
  const db = await getKysely();

  const row = await db
    .selectFrom("monthly_budget")
    .select("id")
    .where("user_id", "=", session.user.id)
    .where("month", "=", month)
    .executeTakeFirst();

  const { start_date, end_date } = getBudgetPeriodInclusive(month);
  if (!row) return Response.json({ month, monthly_budget: null, start: start_date, end: end_date });

  const budget = await getBudgetWithAdjustments(db, row.id);
  return Response.json({ month, monthly_budget: budget, start: start_date, end: end_date });
}

export async function POST(request: NextRequest) {
  const session = await requireSession(request);
  if (!session) return Errors.unauthorized();

  const body = await request.json().catch(() => null);
  if (!body) return Errors.validation("Request body không hợp lệ");

  const b = body as Record<string, unknown>;
  const month = parseMonth(b.month);
  if (!month) return Errors.validation("Tháng không hợp lệ. Dùng định dạng YYYY-MM");

  const amount = parseAmount(b.amount);
  if (!amount) return Errors.validation("Số tiền phải là số nguyên lớn hơn 0");

  const db = await getKysely();
  const userId = session.user.id;

  const existing = await db
    .selectFrom("monthly_budget")
    .select("id")
    .where("user_id", "=", userId)
    .where("month", "=", month)
    .executeTakeFirst();

  if (existing) return Errors.conflict(`Budget tháng ${month} đã tồn tại`, "CONFLICT");

  const { start_date, end_date } = getBudgetPeriodInclusive(month);
  const result = await db
    .insertInto("monthly_budget")
    .values({ user_id: userId, month, amount, start_date, end_date })
    .returning("id")
    .executeTakeFirst();

  const budget = await getBudgetWithAdjustments(db, result!.id);
  return Response.json({ monthly_budget: budget, start: start_date, end: end_date }, { status: 201 });
}
