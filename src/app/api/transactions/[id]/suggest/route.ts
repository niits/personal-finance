import type { NextRequest } from "next/server";
import { z } from "zod";
import { getDB } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { Errors } from "@/lib/errors";
import { runAIObject } from "@/lib/llm";

type Params = Promise<{ id: string }>;

type TxnRow = {
  id: number;
  amount: number;
  type: "expense" | "income";
  note: string | null;
  category_id: number;
  cat_name: string;
};

type CategoryRow = {
  id: number;
  name: string;
  type: "income" | "expense";
  level: number;
  parent_id: number | null;
  emoji: string | null;
};

const SuggestSchema = z.object({
  suggested_category_id: z
    .number()
    .int()
    .nullable()
    .describe("ID danh mục lá phù hợp nhất từ danh sách, null nếu danh mục hiện tại đã đúng"),
  category_reason: z
    .string()
    .nullable()
    .describe("Lý do đổi danh mục, null nếu không đổi"),
  emoji: z
    .string()
    .nullable()
    .describe("Một emoji Unicode duy nhất phù hợp với giao dịch này, null nếu không cần"),
});

const SYSTEM_PROMPT = `Bạn là trợ lý tài chính cá nhân. Phân tích một giao dịch và gợi ý:
1. Danh mục lá phù hợp hơn (nếu danh mục hiện tại chưa đúng)
2. Emoji đại diện cho giao dịch này

Quy tắc:
- suggested_category_id phải là ID từ danh sách danh mục lá đã cung cấp
- Chỉ gợi ý đổi danh mục khi có danh mục RÕ RÀNG phù hợp hơn
- emoji là một ký tự emoji Unicode duy nhất, phù hợp với nội dung giao dịch
- Nếu danh mục hiện tại đã đúng, trả về null cho suggested_category_id và category_reason`;

export async function POST(request: NextRequest, { params }: { params: Params }) {
  const session = await requireSession(request);
  if (!session) return Errors.unauthorized();

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) return Errors.validation("Invalid transaction id");

  const db = await getDB();
  const userId = session.user.id;

  const txn = await db
    .prepare(
      `SELECT t.id, t.amount, t.type, t.note, t.category_id, c.name as cat_name
       FROM "transaction" t JOIN category c ON t.category_id = c.id
       WHERE t.id = ? AND t.user_id = ?`,
    )
    .bind(id, userId)
    .first<TxnRow>();

  if (!txn) return Errors.notFound("Giao dịch không tồn tại");

  const { results: allCategories } = await db
    .prepare(
      `SELECT id, name, type, level, parent_id, emoji
       FROM category WHERE user_id = ? ORDER BY level, id`,
    )
    .bind(userId)
    .all<CategoryRow>();

  // Only pass leaf categories as valid targets for recategorization
  const leafIds = new Set(allCategories.map((c) => c.id));
  for (const c of allCategories) {
    if (c.parent_id !== null) leafIds.delete(c.parent_id);
  }
  const leafCategories = allCategories.filter((c) => leafIds.has(c.id));

  const prompt = `Giao dịch:
${JSON.stringify({ id: txn.id, amount: txn.amount, type: txn.type, note: txn.note, current_category: txn.cat_name })}

Danh mục lá hiện có:
${JSON.stringify(leafCategories.map((c) => ({ id: c.id, name: c.name, type: c.type })))}

Gợi ý danh mục phù hợp hơn (nếu cần) và emoji cho giao dịch này.`;

  let result: z.infer<typeof SuggestSchema>;
  try {
    result = await runAIObject({
      schema: SuggestSchema,
      system: SYSTEM_PROMPT,
      prompt,
      traceName: "transaction-suggest",
      userId,
    });
  } catch (err) {
    console.error("AI transaction suggest error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message, code: "AI_ERROR" }, { status: 502 });
  }

  // Validate that suggested category ID exists and belongs to a leaf
  const validCategoryId =
    result.suggested_category_id !== null && leafIds.has(result.suggested_category_id)
      ? result.suggested_category_id
      : null;

  // If suggesting the same category, treat as no change
  const categoryId = validCategoryId === txn.category_id ? null : validCategoryId;
  const categoryReason = categoryId !== null ? result.category_reason : null;

  const suggestedCat = categoryId !== null ? allCategories.find((c) => c.id === categoryId) : null;

  return Response.json({
    suggested_category_id: categoryId,
    suggested_category_name: suggestedCat?.name ?? null,
    category_reason: categoryReason,
    emoji: result.emoji,
  });
}
