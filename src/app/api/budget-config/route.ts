import type { NextRequest } from "next/server";
import { getKysely } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { Errors } from "@/lib/errors";
import { parseAmount } from "@/lib/validators";
import { sql } from "kysely";

const DEFAULT_AMOUNT = 10_000_000;

export async function GET(request: NextRequest) {
  const session = await requireSession(request);
  if (!session) return Errors.unauthorized();

  const db = await getKysely();
  const row = await db
    .selectFrom("budget_config")
    .select(["default_monthly_amount", "updated_at"])
    .where("user_id", "=", session.user.id)
    .executeTakeFirst();

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

  const db = await getKysely();
  const userId = session.user.id;

  // Upsert: insert or update on conflict
  const row = await db
    .insertInto("budget_config")
    .values({
      user_id: userId,
      default_monthly_amount: amount,
      updated_at: sql<number>`unixepoch()`,
    })
    .onConflict((oc) =>
      oc.column("user_id").doUpdateSet({
        default_monthly_amount: amount,
        updated_at: sql<number>`unixepoch()`,
      }),
    )
    .returning(["default_monthly_amount", "updated_at"])
    .executeTakeFirst();

  return Response.json({ budget_config: row });
}
