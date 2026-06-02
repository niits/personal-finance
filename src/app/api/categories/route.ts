import type { NextRequest } from "next/server";
import { getKysely } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { Errors } from "@/lib/errors";

type CategoryRow = {
  id: number;
  name: string;
  emoji: string | null;
  parent_id: number | null;
  level: number;
  sort_order: number;
  type: "income" | "expense";
  created_at: number;
};

type CategoryNode = CategoryRow & { children: CategoryNode[] };

function buildTree(rows: CategoryRow[]): CategoryNode[] {
  const map = new Map<number, CategoryNode>();
  for (const row of rows) map.set(row.id, { ...row, children: [] });

  const roots: CategoryNode[] = [];
  for (const row of rows) {
    const node = map.get(row.id)!;
    if (row.parent_id === null) {
      roots.push(node);
    } else {
      map.get(row.parent_id)?.children.push(node);
    }
  }
  return roots;
}

export async function GET(request: NextRequest) {
  const session = await requireSession(request);
  if (!session) return Errors.unauthorized();

  const db = await getKysely();
  const [results, usageRows] = await Promise.all([
    db
      .selectFrom("category")
      .select(["id", "name", "emoji", "parent_id", "level", "sort_order", "type", "created_at"])
      .where("user_id", "=", session.user.id)
      .orderBy("level")
      .orderBy("sort_order")
      .orderBy("id")
      .execute() as Promise<CategoryRow[]>,
    db
      .selectFrom("transaction")
      .select(["category_id"])
      .select((eb) => eb.fn.countAll<number>().as("cnt"))
      .where("user_id", "=", session.user.id)
      .where("category_id", "is not", null)
      .groupBy("category_id")
      .execute(),
  ]);

  const usageCounts: Record<number, number> = {};
  for (const row of usageRows) {
    if (row.category_id !== null) usageCounts[row.category_id] = Number(row.cnt);
  }

  return Response.json({ categories: buildTree(results as CategoryRow[]), usage_counts: usageCounts });
}

export async function POST(request: NextRequest) {
  const session = await requireSession(request);
  if (!session) return Errors.unauthorized();

  const body = await request.json().catch(() => null);
  if (!body) return Errors.validation("Request body không hợp lệ");

  const { name, parent_id, type, emoji } = body as {
    name?: unknown;
    parent_id?: unknown;
    type?: unknown;
    emoji?: unknown;
  };

  if (typeof name !== "string" || name.trim().length === 0)
    return Errors.validation("Tên danh mục không được để trống");
  if (name.trim().length > 100)
    return Errors.validation("Tên danh mục tối đa 100 ký tự");

  const db = await getKysely();
  const userId = session.user.id;

  let level = 1;
  let resolvedType: "income" | "expense";

  if (parent_id !== undefined && parent_id !== null) {
    if (typeof parent_id !== "number")
      return Errors.validation("parent_id phải là số nguyên");

    const parent = await db
      .selectFrom("category")
      .select(["level", "type"])
      .where("id", "=", parent_id)
      .where("user_id", "=", userId)
      .executeTakeFirst();

    if (!parent) return Errors.forbidden();
    if (parent.level >= 3)
      return Errors.conflict("Danh mục cấp 3 không thể có danh mục con", "CONFLICT");

    level = parent.level + 1;
    resolvedType = parent.type;
  } else {
    if (type !== "income" && type !== "expense")
      return Errors.validation("type phải là 'income' hoặc 'expense'");
    resolvedType = type;
  }

  const emojiVal = typeof emoji === "string" && emoji.trim() ? emoji.trim() : null;

  const result = (await db
    .insertInto("category")
    .values({
      user_id: userId,
      name: name.trim(),
      emoji: emojiVal,
      parent_id: (parent_id as number | null | undefined) ?? null,
      level,
      sort_order: 0,
      type: resolvedType,
    })
    .returning(["id", "name", "emoji", "parent_id", "level", "sort_order", "type", "created_at"])
    .executeTakeFirst()) as CategoryRow;

  return Response.json({ category: result }, { status: 201 });
}
