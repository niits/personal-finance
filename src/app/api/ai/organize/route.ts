import type { NextRequest } from "next/server";
import { z } from "zod";
import { getDB } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { Errors } from "@/lib/errors";
import { getOpenAIModel } from "@/lib/llm";
import { generateObject } from "ai";

type CategoryRow = { id: number; name: string; type: "income" | "expense"; level: number; emoji: string | null };
type TransactionRow = { id: number; note: string; type: "income" | "expense"; category_id: number; cat_name: string };

const OrganizeSchema = z.object({
  new_categories: z.array(z.object({
    temp_id: z.string().describe("Định danh tạm thời, ví dụ: 'new:0', 'new:1'"),
    name: z.string().describe("Tên danh mục tiếng Việt, ngắn gọn 1-4 từ"),
    type: z.enum(["income", "expense"]),
    parent_category_id: z.number().nullable().describe("ID từ danh sách hiện tại hoặc null"),
    example_notes: z.array(z.string()).max(3).describe("Tối đa 3 ghi chú thực từ giao dịch"),
  })),
  emoji_assignments: z.array(z.object({
    category_id: z.number().int().describe("ID danh mục cần gán emoji"),
    emoji: z.string().describe("Một emoji Unicode duy nhất"),
  })),
  recategorizations: z.array(z.object({
    transaction_id: z.number().int(),
    suggested_category_id: z.union([z.number().int(), z.string()]).describe("ID danh mục hiện có hoặc temp_id của danh mục mới"),
    reason: z.string().describe("Lý do ngắn gọn tiếng Việt"),
  })),
});

const SYSTEM_PROMPT = `Bạn là trợ lý tài chính cá nhân phân tích giao dịch của người dùng Việt Nam.

Nhiệm vụ: Phân tích toàn bộ dữ liệu và trả về 3 loại gợi ý trong một lần:

1. new_categories: Danh mục MỚI nên thêm (chưa tồn tại). Chỉ gợi ý khi có ≥3 giao dịch tương tự. Tên tiếng Việt ngắn gọn.
2. emoji_assignments: Gán emoji cho các danh mục CHƯA có emoji (emoji = null hoặc rỗng).
3. recategorizations: Giao dịch đang phân loại sai — chuyển sang danh mục phù hợp hơn (có thể là danh mục mới với temp_id).

Quy tắc:
- parent_category_id phải là ID thực từ danh sách, hoặc null
- temp_id dùng định dạng "new:0", "new:1", ...
- suggested_category_id có thể là số (ID hiện có) hoặc chuỗi temp_id (danh mục mới)
- Không tự tạo ghi chú — chỉ dùng dữ liệu thực`;

export async function POST(request: NextRequest) {
  const session = await requireSession(request);
  if (!session) return Errors.unauthorized();

  const db = await getDB();
  const userId = session.user.id;

  const [{ results: categories }, { results: transactions }] = await Promise.all([
    db
      .prepare("SELECT id, name, type, level, emoji FROM category WHERE user_id = ? ORDER BY level, id")
      .bind(userId)
      .all<CategoryRow>(),
    db
      .prepare(`SELECT t.id, t.note, t.type, t.category_id, c.name as cat_name
                FROM "transaction" t JOIN category c ON t.category_id = c.id
                WHERE t.user_id = ? AND t.note IS NOT NULL AND t.note != ''
                ORDER BY t.updated_at DESC LIMIT 300`)
      .bind(userId)
      .all<TransactionRow>(),
  ]);

  if (transactions.length === 0) {
    return Response.json({ new_categories: [], emoji_assignments: [], recategorizations: [] });
  }

  const catMap = new Map(categories.map((c) => [c.id, c]));
  const categoriesWithoutEmoji = categories.filter((c) => !c.emoji);

  const userContent = `Danh mục hiện tại:
${JSON.stringify(categories.map((c) => ({ id: c.id, name: c.name, type: c.type, level: c.level, has_emoji: !!c.emoji })))}

Danh mục chưa có emoji (cần gán): ${JSON.stringify(categoriesWithoutEmoji.map((c) => ({ id: c.id, name: c.name })))}

Giao dịch:
${JSON.stringify(transactions.map((t) => ({ id: t.id, note: t.note, type: t.type, category: t.cat_name, category_id: t.category_id })))}`;

  let result: z.infer<typeof OrganizeSchema>;
  try {
    const model = await getOpenAIModel();
    const { object } = await generateObject({ model, schema: OrganizeSchema, system: SYSTEM_PROMPT, prompt: userContent, maxOutputTokens: 4096 });
    result = object;
  } catch (err) {
    console.error("[ai/organize] AI error:", err);
    return Response.json({ error: "AI_ERROR" }, { status: 502 });
  }

  const validCategoryIds = new Set(categories.map((c) => c.id));
  const tempIds = new Set(result.new_categories.map((c) => c.temp_id));

  // Validate and resolve display names for recategorizations
  const recategorizations = result.recategorizations
    .filter((r) => {
      const sid = r.suggested_category_id;
      return typeof sid === "string" ? tempIds.has(sid) : validCategoryIds.has(sid);
    })
    .map((r) => {
      const txn = transactions.find((t) => t.id === r.transaction_id);
      if (!txn) return null;
      const sid = r.suggested_category_id;
      const suggestedName = typeof sid === "string"
        ? (result.new_categories.find((c) => c.temp_id === sid)?.name ?? sid)
        : (catMap.get(sid as number)?.name ?? String(sid));
      return {
        transaction_id: r.transaction_id,
        note: txn.note,
        current_category_id: txn.category_id,
        current_category_name: txn.cat_name,
        suggested_category_id: r.suggested_category_id,
        suggested_category_name: suggestedName,
        reason: r.reason,
      };
    })
    .filter(Boolean);

  return Response.json({
    new_categories: result.new_categories,
    emoji_assignments: result.emoji_assignments.filter((a) => validCategoryIds.has(a.category_id)),
    recategorizations,
  });
}
