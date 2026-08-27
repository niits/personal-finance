import type { NextRequest } from "next/server";
import { getKysely } from "@/lib/db";
import { Errors } from "@/lib/errors";
import { requireSession } from "@/lib/session";

type Params = Promise<{ id: string }>;

export async function PATCH(request: NextRequest, { params }: { params: Params }) {
  const session = await requireSession(request);
  if (!session) return Errors.unauthorized();

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.name !== "string" || !body.name.trim()) {
    return Errors.validation("Tên tài khoản không được để trống");
  }

  const { id } = await params;
  const account = await (await getKysely())
    .updateTable("finance_account")
    .set({
      name: body.name.trim(),
      note: typeof body.note === "string" ? body.note.trim() || null : null,
    })
    .where("id", "=", id)
    .where("user_id", "=", session.user.id)
    .returningAll()
    .executeTakeFirst();

  if (!account) return Errors.notFound("Tài khoản không tồn tại");
  return Response.json({ account });
}

export async function DELETE(request: NextRequest, { params }: { params: Params }) {
  const session = await requireSession(request);
  if (!session) return Errors.unauthorized();

  const { id } = await params;
  const db = await getKysely();
  const userId = session.user.id;
  const account = await db
    .selectFrom("finance_account")
    .select("id")
    .where("id", "=", id)
    .where("user_id", "=", userId)
    .executeTakeFirst();

  if (!account) return Errors.notFound("Tài khoản không tồn tại");

  const transaction = await db
    .selectFrom("transaction")
    .select("id")
    .where("finance_account_id", "=", id)
    .executeTakeFirst();
  if (transaction) {
    return Errors.validation("Tài khoản có giao dịch không thể bị xóa");
  }

  await db
    .deleteFrom("finance_account")
    .where("id", "=", id)
    .where("user_id", "=", userId)
    .execute();

  return Response.json({});
}
