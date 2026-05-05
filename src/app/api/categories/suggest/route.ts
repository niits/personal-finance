import type { NextRequest } from "next/server";
import { generateObject } from "ai";
import { z } from "zod";
import { getDB } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { Errors } from "@/lib/errors";
import { getModel } from "@/lib/llm";

type CategoryRow = { id: number; name: string; type: "income" | "expense"; level: number };
type TransactionRow = { note: string; type: "income" | "expense"; cat_name: string };
type RunRow = { up_to_tx_id: number };
type MaxTxRow = { max_id: number | null };

const SuggestionSchema = z.object({
  suggestions: z.array(
    z.object({
      name: z.string().describe("Tên danh mục bằng tiếng Việt, ngắn gọn 1-4 từ"),
      type: z.enum(["income", "expense"]),
      parent_category_id: z.number().nullable().describe("ID từ danh sách danh mục hiện tại, hoặc null nếu là danh mục gốc"),
      example_notes: z.array(z.string()).max(3).describe("2-3 ghi chú thực từ danh sách giao dịch"),
      transaction_count: z.number().int().describe("Số giao dịch tương tự"),
    }),
  ),
});

type Suggestion = {
  name: string;
  type: "income" | "expense";
  parent_category_id: number | null;
  parent_category_name: string | null;
  example_notes: string[];
  transaction_count: number;
};

const SYSTEM_PROMPT = `Bạn là trợ lý tài chính cá nhân phân tích lịch sử giao dịch người dùng Việt Nam.

Nhiệm vụ: Gợi ý các danh mục MỚI nên thêm vào để phân loại chi tiêu tốt hơn.

Quy tắc:
1. Chỉ gợi ý danh mục CHƯA tồn tại trong danh sách hiện tại
2. Nếu là danh mục con, parent_category_id PHẢI là ID từ danh sách đã cung cấp (không được tự đặt)
3. Nếu là danh mục gốc, parent_category_id = null
4. Tên danh mục bằng tiếng Việt, ngắn gọn (1–4 từ)
5. example_notes phải là ghi chú thực từ danh sách giao dịch, không tự tạo
6. Gom nhóm theo hành vi chi tiêu, không theo tên thương hiệu
7. Chỉ gợi ý khi có ít nhất 3 giao dịch tương tự
8. Trả về danh sách rỗng nếu không tìm thấy gợi ý phù hợp`;

export async function POST(request: NextRequest) {
  const session = await requireSession(request);
  if (!session) return Errors.unauthorized();

  const db = await getDB();
  const userId = session.user.id;

  const [lastDoneRun, maxTxRow] = await Promise.all([
    db
      .prepare("SELECT up_to_tx_id FROM ai_suggestion_run WHERE user_id = ? AND status = 'done' ORDER BY id DESC LIMIT 1")
      .bind(userId)
      .first<RunRow>(),
    db
      .prepare(`SELECT MAX(id) as max_id FROM "transaction" WHERE user_id = ?`)
      .bind(userId)
      .first<MaxTxRow>(),
  ]);

  const fromTxId = lastDoneRun?.up_to_tx_id ?? null;
  const upToTxId = maxTxRow?.max_id ?? 0;

  const { results: categories } = await db
    .prepare("SELECT id, name, type, level FROM category WHERE user_id = ? ORDER BY level, id")
    .bind(userId)
    .all<CategoryRow>();

  const txQuery =
    fromTxId === null
      ? `SELECT t.note, t.type, c.name as cat_name
         FROM "transaction" t JOIN category c ON t.category_id = c.id
         WHERE t.user_id = ? AND t.note IS NOT NULL AND t.note != ''
         ORDER BY t.id DESC`
      : `SELECT t.note, t.type, c.name as cat_name
         FROM "transaction" t JOIN category c ON t.category_id = c.id
         WHERE t.user_id = ? AND t.id > ? AND t.id <= ? AND t.note IS NOT NULL AND t.note != ''
         ORDER BY t.id DESC`;

  const txBinds = fromTxId === null ? [userId] : [userId, fromTxId, upToTxId];
  const { results: transactions } = await db.prepare(txQuery).bind(...txBinds).all<TransactionRow>();

  const { meta } = await db
    .prepare("INSERT INTO ai_suggestion_run (user_id, from_tx_id, up_to_tx_id, status) VALUES (?, ?, ?, ?)")
    .bind(userId, fromTxId, upToTxId, transactions.length === 0 ? "done" : "pending")
    .run();
  const runId = meta.last_row_id as number;

  if (transactions.length === 0) {
    return Response.json({ suggestions: [], run_id: runId });
  }

  const categoryList = categories.map((c) => ({ id: c.id, name: c.name, type: c.type, level: c.level }));
  const categoryIdSet = new Set(categories.map((c) => c.id));

  const userContent = `Danh mục hiện tại:
${JSON.stringify(categoryList)}

Giao dịch (ghi chú + danh mục hiện tại):
${JSON.stringify(transactions.map((t) => ({ note: t.note, type: t.type, category: t.cat_name })))}

Gợi ý các danh mục mới nên thêm để tổ chức tốt hơn.`;

  let output: z.infer<typeof SuggestionSchema>;
  try {
    const model = await getModel();
    const { object } = await generateObject({
      model,
      schema: SuggestionSchema,
      system: SYSTEM_PROMPT,
      prompt: userContent,
    });
    output = object;
  } catch (err) {
    console.error("AI suggest error:", err);
    await db.prepare("DELETE FROM ai_suggestion_run WHERE id = ?").bind(runId).run();
    return Response.json({ error: err, code: "AI_ERROR" }, { status: 502 });
  }

  const catMap = new Map(categories.map((c) => [c.id, c.name]));

  const suggestions: Suggestion[] = (output.suggestions ?? [])
    .filter((s) => {
      if (s.parent_category_id !== null && !categoryIdSet.has(s.parent_category_id)) return false;
      return true;
    })
    .map((s) => ({
      name: s.name,
      type: s.type,
      parent_category_id: s.parent_category_id,
      parent_category_name: s.parent_category_id !== null ? (catMap.get(s.parent_category_id) ?? null) : null,
      example_notes: s.example_notes.slice(0, 3),
      transaction_count: s.transaction_count,
    }));

  return Response.json({ suggestions, run_id: runId });
}
