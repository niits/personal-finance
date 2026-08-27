import type { NextRequest } from "next/server";
import { getKysely } from "@/lib/db";
import { Errors } from "@/lib/errors";
import { requireSession } from "@/lib/session";

type Params = Promise<{ id: string }>;

function parseGroup(body: Record<string, unknown>) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const closeDay = body.statement_close_day;
  return name && Number.isInteger(closeDay) && Number(closeDay) >= 1 && Number(closeDay) <= 31
    ? { name, statement_close_day: Number(closeDay) }
    : null;
}

export async function PATCH(request: NextRequest, { params }: { params: Params }) {
  const session = await requireSession(request);
  if (!session) return Errors.unauthorized();
  const input = await request.json().catch(() => null) as Record<string, unknown> | null;
  const values = input ? parseGroup(input) : null;
  if (!values) return Errors.validation("Tên nhóm và ngày chốt sao kê từ 1 đến 31 là bắt buộc");
  const { id } = await params;
  const group = await (await getKysely()).updateTable("credit_card_group").set(values)
    .where("id", "=", id).where("user_id", "=", session.user.id).returningAll().executeTakeFirst();
  if (!group) return Errors.notFound("Nhóm thẻ không tồn tại");
  return Response.json({ group });
}

export async function DELETE(request: NextRequest, { params }: { params: Params }) {
  const session = await requireSession(request);
  if (!session) return Errors.unauthorized();
  const { id } = await params;
  const db = await getKysely();
  const group = await db.selectFrom("credit_card_group").select("id")
    .where("id", "=", id).where("user_id", "=", session.user.id).executeTakeFirst();
  if (!group) return Errors.notFound("Nhóm thẻ không tồn tại");
  const transaction = await db.selectFrom("transaction").select("id")
    .where("credit_card_group_id", "=", id).executeTakeFirst();
  if (transaction) return Errors.validation("Nhóm thẻ có giao dịch không thể bị xóa");
  await db.deleteFrom("credit_card_group").where("id", "=", id).where("user_id", "=", session.user.id).execute();
  return Response.json({});
}
