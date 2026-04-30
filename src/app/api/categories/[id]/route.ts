import type { NextRequest } from "next/server";
import { getKysely } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { Errors } from "@/lib/errors";

type Params = Promise<{ id: string }>;

export async function PATCH(request: NextRequest, { params }: { params: Params }) {
  const session = await requireSession(request);
  if (!session) return Errors.unauthorized();

  const { id } = await params;
  const categoryId = Number(id);
  if (!Number.isInteger(categoryId)) return Errors.notFound();

  const db = await getKysely();
  const userId = session.user.id;

  const existing = await db
    .selectFrom("category")
    .select("id")
    .where("id", "=", categoryId)
    .where("user_id", "=", userId)
    .executeTakeFirst();
  if (!existing) return Errors.notFound("Danh mục không tồn tại");

  const body = await request.json().catch(() => null);
  if (!body) return Errors.validation("Request body không hợp lệ");

  const { name, sort_order } = body as { name?: unknown; sort_order?: unknown };
  const updates: Record<string, unknown> = {};

  if (name !== undefined) {
    if (typeof name !== "string" || name.trim().length === 0)
      return Errors.validation("Tên danh mục không được để trống");
    if (name.trim().length > 100)
      return Errors.validation("Tên danh mục tối đa 100 ký tự");
    updates.name = name.trim();
  }

  if (sort_order !== undefined) {
    if (typeof sort_order !== "number" || !Number.isInteger(sort_order))
      return Errors.validation("sort_order phải là số nguyên");
    updates.sort_order = sort_order;
  }

  if (Object.keys(updates).length === 0) return Errors.validation("Không có trường nào để cập nhật");

  const row = await db
    .updateTable("category")
    .set(updates)
    .where("id", "=", categoryId)
    .where("user_id", "=", userId)
    .returning(["id", "name", "parent_id", "level", "sort_order", "created_at"])
    .executeTakeFirst();

  return Response.json({ category: row });
}

export async function DELETE(request: NextRequest, { params }: { params: Params }) {
  const session = await requireSession(request);
  if (!session) return Errors.unauthorized();

  const { id } = await params;
  const categoryId = Number(id);
  if (!Number.isInteger(categoryId)) return Errors.notFound();

  const db = await getKysely();
  const userId = session.user.id;

  const existing = await db
    .selectFrom("category")
    .select("id")
    .where("id", "=", categoryId)
    .where("user_id", "=", userId)
    .executeTakeFirst();
  if (!existing) return Errors.notFound("Danh mục không tồn tại");

  const txnCount = await db
    .selectFrom("transaction")
    .select((eb) => eb.fn.countAll<number>().as("cnt"))
    .where("category_id", "=", categoryId)
    .where("user_id", "=", userId)
    .executeTakeFirst();
  const txnCnt = txnCount?.cnt ?? 0;
  if (txnCnt > 0) {
    return Errors.conflict(
      `Danh mục đang được dùng bởi ${txnCnt} giao dịch`,
      "CATEGORY_IN_USE",
      { transaction_count: txnCnt },
    );
  }

  const childCount = await db
    .selectFrom("category")
    .select((eb) => eb.fn.countAll<number>().as("cnt"))
    .where("parent_id", "=", categoryId)
    .where("user_id", "=", userId)
    .executeTakeFirst();
  if ((childCount?.cnt ?? 0) > 0) {
    return Errors.conflict("Vui lòng xóa danh mục con trước");
  }

  await db
    .deleteFrom("category")
    .where("id", "=", categoryId)
    .where("user_id", "=", userId)
    .execute();

  return Response.json({});
}
