import type { NextRequest } from "next/server";
import { z } from "zod";
import { getDB, getKysely } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { Errors } from "@/lib/errors";

const ApplySchema = z.object({
  new_categories: z.array(z.object({
    temp_id: z.string(),
    name: z.string(),
    type: z.enum(["income", "expense"]),
    parent_category_id: z.number().nullable(),
    example_notes: z.array(z.string()),
  })),
  emoji_assignments: z.array(z.object({
    category_id: z.number().int(),
    emoji: z.string(),
  })),
  recategorizations: z.array(z.object({
    transaction_id: z.number().int(),
    note: z.string(),
    current_category_id: z.number().int(),
    current_category_name: z.string(),
    suggested_category_id: z.union([z.number().int(), z.string()]),
    suggested_category_name: z.string(),
    reason: z.string(),
  })),
});

export async function POST(request: NextRequest) {
  const session = await requireSession(request);
  if (!session) return Errors.unauthorized();

  const body = await request.json().catch(() => null);
  const parsed = ApplySchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "INVALID_BODY" }, { status: 400 });

  const { new_categories, emoji_assignments, recategorizations } = parsed.data;
  const userId = session.user.id;
  const [db, kysely] = await Promise.all([getDB(), getKysely()]);
  const now = Math.floor(Date.now() / 1000);

  // 1. Insert new categories, build temp_id → real_id map
  const tempIdMap = new Map<string, number>();
  for (const cat of new_categories) {
    const parentId = cat.parent_category_id;
    const { meta } = await db
      .prepare(`INSERT INTO category (user_id, name, type, parent_id, level, sort_order, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 0, ?, ?)`)
      .bind(
        userId,
        cat.name,
        cat.type,
        parentId ?? null,
        parentId === null ? 0 : 1,
        now,
        now,
      )
      .run();
    tempIdMap.set(cat.temp_id, meta.last_row_id as number);
  }

  // 2. Update emoji on categories (batch)
  for (const { category_id, emoji } of emoji_assignments) {
    await kysely
      .updateTable("category")
      .set({ emoji })
      .where("id", "=", category_id)
      .where("user_id", "=", userId)
      .execute();
  }

  // 3. Resolve temp_ids and update transaction category_ids
  for (const r of recategorizations) {
    const resolvedId = typeof r.suggested_category_id === "string"
      ? tempIdMap.get(r.suggested_category_id)
      : r.suggested_category_id;

    if (!resolvedId) continue;

    await kysely
      .updateTable("transaction")
      .set({ category_id: resolvedId, updated_at: now })
      .where("id", "=", r.transaction_id)
      .where("user_id", "=", userId)
      .execute();
  }

  return Response.json({ ok: true });
}
