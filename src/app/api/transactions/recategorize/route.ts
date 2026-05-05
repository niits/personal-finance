import type { NextRequest } from "next/server";
import { generateObject } from "ai";
import { z } from "zod";
import { getDB } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { Errors } from "@/lib/errors";
import { getModel } from "@/lib/llm";

type CategoryRow = { id: number; name: string; type: "income" | "expense" };
type TransactionRow = { id: number; note: string; type: "income" | "expense"; category_id: number; cat_name: string };
type RunRow = { id: number; from_tx_id: number | null; up_to_tx_id: number };

const RecategorizeSchema = z.object({
  recategorizations: z.array(
    z.object({
      transaction_id: z.number().int().describe("ID của giao dịch cần đổi danh mục"),
      suggested_category_id: z.number().int().describe("ID danh mục lá phù hợp hơn từ danh sách"),
      reason: z.string().describe("Lý do ngắn gọn bằng tiếng Việt (1 câu)"),
    }),
  ),
});

export type RecategorizeSuggestion = {
  transaction_id: number;
  note: string;
  current_category_id: number;
  current_category_name: string;
  suggested_category_id: number;
  suggested_category_name: string;
  reason: string;
};

const SYSTEM_PROMPT = `Bạn là trợ lý tài chính. Phân tích các giao dịch và gợi ý đổi danh mục khi danh mục hiện tại không phù hợp.

Danh mục được cung cấp đều là danh mục lá (leaf) — chỉ được chọn từ danh sách này.

Quy tắc:
1. Chỉ gợi ý khi có danh mục RÕ RÀNG phù hợp hơn trong danh sách
2. suggested_category_id PHẢI là ID từ danh sách danh mục lá đã cung cấp
3. Không gợi ý nếu danh mục hiện tại đã phù hợp
4. reason ngắn gọn, 1 câu tiếng Việt
5. Trả về danh sách rỗng nếu mọi danh mục đã phù hợp`;

export async function POST(request: NextRequest) {
  const session = await requireSession(request);
  if (!session) return Errors.unauthorized();

  const db = await getDB();
  const userId = session.user.id;

  const run = await db
    .prepare(
      "SELECT id, from_tx_id, up_to_tx_id FROM ai_suggestion_run WHERE user_id = ? AND status = 'available' ORDER BY id DESC LIMIT 1",
    )
    .bind(userId)
    .first<RunRow>();

  if (!run) return Errors.notFound("Không tìm thấy phiên gợi ý đã áp dụng");

  const { results: leafCategories } = await db
    .prepare(
      `SELECT c.id, c.name, c.type FROM category c
       WHERE c.user_id = ?
       AND NOT EXISTS (SELECT 1 FROM category ch WHERE ch.parent_id = c.id)
       ORDER BY c.id`,
    )
    .bind(userId)
    .all<CategoryRow>();

  const txQuery =
    run.from_tx_id === null
      ? `SELECT t.id, t.note, t.type, t.category_id, c.name as cat_name
         FROM "transaction" t JOIN category c ON t.category_id = c.id
         WHERE t.user_id = ? AND t.id <= ? AND t.note IS NOT NULL AND t.note != ''
         ORDER BY t.id DESC`
      : `SELECT t.id, t.note, t.type, t.category_id, c.name as cat_name
         FROM "transaction" t JOIN category c ON t.category_id = c.id
         WHERE t.user_id = ? AND t.id > ? AND t.id <= ? AND t.note IS NOT NULL AND t.note != ''
         ORDER BY t.id DESC`;

  const txBinds = run.from_tx_id === null ? [userId, run.up_to_tx_id] : [userId, run.from_tx_id, run.up_to_tx_id];
  const { results: transactions } = await db.prepare(txQuery).bind(...txBinds).all<TransactionRow>();

  // Mark run as done before LLM call — window is now committed
  await db
    .prepare("UPDATE ai_suggestion_run SET status = 'done' WHERE id = ?")
    .bind(run.id)
    .run();

  if (transactions.length === 0) {
    return Response.json({ suggestions: [] });
  }

  const leafCategoryIdSet = new Set(leafCategories.map((c) => c.id));
  const categoryNameMap = new Map(leafCategories.map((c) => [c.id, c.name]));
  const txMap = new Map(transactions.map((t) => [t.id, t]));

  const userContent = `Danh mục lá hiện có:
${JSON.stringify(leafCategories.map((c) => ({ id: c.id, name: c.name, type: c.type })))}

Giao dịch cần xem xét:
${JSON.stringify(transactions.map((t) => ({ id: t.id, note: t.note, type: t.type, current_category_id: t.category_id, current_category: t.cat_name })))}

Gợi ý đổi danh mục cho các giao dịch có danh mục chưa phù hợp.`;

  let output: z.infer<typeof RecategorizeSchema>;
  try {
    const model = await getModel();
    const { object } = await generateObject({
      model,
      schema: RecategorizeSchema,
      system: SYSTEM_PROMPT,
      prompt: userContent,
    });
    output = object;
  } catch (err) {
    console.error("AI recategorize error:", err);
    return Response.json({ error: "Không thể phân tích lúc này. Thử lại sau.", code: "AI_ERROR" }, { status: 502 });
  }

  const suggestions: RecategorizeSuggestion[] = (output.recategorizations ?? [])
    .filter((r) => {
      const tx = txMap.get(r.transaction_id);
      if (!tx) return false;
      if (!leafCategoryIdSet.has(r.suggested_category_id)) return false;
      if (r.suggested_category_id === tx.category_id) return false;
      return true;
    })
    .map((r) => {
      const tx = txMap.get(r.transaction_id)!;
      return {
        transaction_id: r.transaction_id,
        note: tx.note,
        current_category_id: tx.category_id,
        current_category_name: tx.cat_name,
        suggested_category_id: r.suggested_category_id,
        suggested_category_name: categoryNameMap.get(r.suggested_category_id) ?? "",
        reason: r.reason,
      };
    });

  return Response.json({ suggestions });
}
