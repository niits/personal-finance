import type { NextRequest } from "next/server";
import { getDB } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { Errors } from "@/lib/errors";
import { parseAmount } from "@/lib/validators";

const DEFAULT_AMOUNT = 10_000_000;

export async function GET(request: NextRequest) {
  const session = await requireSession(request);
  if (!session) return Errors.unauthorized();

  const db = await getDB();
  const row = await db
    .prepare("SELECT default_monthly_amount, updated_at FROM budget_config WHERE user_id = ?")
    .bind(session.user.id)
    .first<{ default_monthly_amount: number; updated_at: number }>();

  return Response.json({
    budget_config: {
      default_monthly_amount: row?.default_monthly_amount ?? DEFAULT_AMOUNT,
      updated_at: row?.updated_at ?? null,
    },
  });
}

export async function PUT(request: NextRequest) {
  const session = await requireSession(request);
  if (!session) return Errors.unauthorized();

  const body = await request.json().catch(() => null);
  if (!body) return Errors.validation("Request body không hợp lệ");

  const amount = parseAmount((body as Record<string, unknown>).default_monthly_amount);
  if (!amount) return Errors.validation("Số tiền mặc định phải là số nguyên lớn hơn 0");

  const db = await getDB();
  const row = await db
    .prepare(
      "INSERT INTO budget_config (user_id, default_monthly_amount, updated_at) VALUES (?, ?, unixepoch()) ON CONFLICT(user_id) DO UPDATE SET default_monthly_amount = excluded.default_monthly_amount, updated_at = excluded.updated_at RETURNING default_monthly_amount, updated_at",
    )
    .bind(session.user.id, amount)
    .first<{ default_monthly_amount: number; updated_at: number }>();

  return Response.json({ budget_config: row });
}
