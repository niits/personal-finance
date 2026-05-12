import type { NextRequest } from "next/server";
import { Errors } from "@/lib/errors";
import { requireUid } from "@/lib/server-auth";
import { aiRunCol } from "@/lib/firestore";

type Params = Promise<{ id: string }>;

// PATCH transitions a run from 'pending' → 'available' so recategorize can pick it up.
export async function PATCH(request: NextRequest, { params }: { params: Params }) {
  const uid = await requireUid(request);
  if (!uid) return Errors.unauthorized();

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { status?: string } | null;
  if (body?.status !== "available") return Errors.validation("Chỉ hỗ trợ chuyển sang 'available'");

  const ref = aiRunCol(uid).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return Errors.notFound("Phiên gợi ý không tồn tại");
  const data = snap.data();
  if (data?.status !== "pending") {
    return Errors.notFound("Phiên gợi ý không ở trạng thái pending");
  }
  await ref.update({ status: "available" });
  return Response.json({ ok: true });
}
