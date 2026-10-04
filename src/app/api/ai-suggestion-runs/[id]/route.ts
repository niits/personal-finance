import type { NextRequest } from "next/server";
import { getDB } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { Errors } from "@/lib/errors";

type Params = Promise<{ id: string }>;

export async function PATCH(request: NextRequest, { params }: { params: Params }) {
  const session = await requireSession(request);
  if (!session) return Errors.unauthorized();

  const { id } = await params;
  const runId = Number(id);
  if (!Number.isInteger(runId)) return Errors.notFound();

  const body = await request.json().catch(() => null) as { status?: string } | null;
  if (body?.status !== "available") return Errors.validation("Trạng thái đề xuất không hợp lệ.");

  const db = await getDB();
  const { meta } = await db
    .prepare(
      `UPDATE ai_suggestion_run SET status = 'available'
       WHERE id = ? AND user_id = ? AND status = 'pending'`,
    )
    .bind(runId, session.user.id)
    .run();

  if (meta.changes === 0) return Errors.notFound("Không tìm thấy đề xuất đang chờ xử lý.");

  return Response.json({ ok: true });
}
