import type { NextRequest } from "next/server";
import { getKysely } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { Errors } from "@/lib/errors";

export async function POST(request: NextRequest) {
  const session = await requireSession(request);
  if (!session) return Errors.unauthorized();
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.name !== "string" || !body.name.trim() || typeof body.group_id !== "string") return Errors.validation("Tên thẻ và nhóm thẻ là bắt buộc");
  const db = await getKysely();
  const group = await db.selectFrom("credit_card_group").select("id").where("id", "=", body.group_id).where("user_id", "=", session.user.id).executeTakeFirst();
  if (!group) return Errors.notFound("Nhóm thẻ không tồn tại");
  const card = await db.insertInto("credit_card").values({ id: crypto.randomUUID(), user_id: session.user.id, group_id: body.group_id, name: body.name.trim() }).returningAll().executeTakeFirstOrThrow();
  return Response.json({ card }, { status: 201 });
}
