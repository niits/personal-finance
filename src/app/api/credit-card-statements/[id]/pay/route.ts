import type { NextRequest } from "next/server";
import { getKysely } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { Errors } from "@/lib/errors";
import { parseDate, currentDate } from "@/lib/validators";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Context) {
  const session = await requireSession(request);
  if (!session) return Errors.unauthorized();
  const date = parseDate((await request.json().catch(() => null) as { paid_at?: unknown } | null)?.paid_at);
  if (!date || date > currentDate()) return Errors.validation("Ngày thanh toán không hợp lệ");
  const { id } = await params;
  const db = await getKysely();
  const existing = await db.selectFrom("credit_card_statement").select("id")
    .where("id", "=", id).where("user_id", "=", session.user.id).where("status", "=", "unpaid").executeTakeFirst();
  if (!existing) return Errors.notFound("Sao kê chưa thanh toán không tồn tại");
  await db.updateTable("credit_card_statement").set({ status: "paid", paid_at: date }).where("id", "=", id).execute();
  const statement = await db.selectFrom("credit_card_statement").selectAll().where("id", "=", id).executeTakeFirstOrThrow();
  return Response.json({ statement });
}
