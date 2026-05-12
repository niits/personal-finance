import type { NextRequest } from "next/server";
import { Schema } from "firebase/ai";
import { z } from "zod";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { Errors } from "@/lib/errors";
import { getModel } from "@/lib/llm";
import { requireUid } from "@/lib/server-auth";
import { aiRunCol, categoryCol, txCol } from "@/lib/firestore";

type CategoryRow = { id: string; name: string; type: "income" | "expense"; level: number };
type TransactionRow = { note: string; type: "income" | "expense"; cat_name: string };

const SuggestionResponseSchema = Schema.object({
  properties: {
    suggestions: Schema.array({
      items: Schema.object({
        properties: {
          name: Schema.string({ description: "Tên danh mục bằng tiếng Việt, ngắn gọn 1-4 từ" }),
          type: Schema.enumString({ enum: ["income", "expense"] }),
          parent_category_id: Schema.string({
            nullable: true,
            description: "ID từ danh sách danh mục hiện tại, hoặc null nếu là danh mục gốc",
          }),
          example_notes: Schema.array({
            items: Schema.string(),
            description: "2-3 ghi chú thực từ danh sách giao dịch",
          }),
          transaction_count: Schema.integer({ description: "Số giao dịch tương tự" }),
        },
        required: ["name", "type", "parent_category_id", "example_notes", "transaction_count"],
      }),
    }),
  },
  required: ["suggestions"],
});

// Zod schema for post-parse validation.
const SuggestionSchema = z.object({
  suggestions: z.array(
    z.object({
      name: z.string(),
      type: z.enum(["income", "expense"]),
      parent_category_id: z.string().nullable(),
      example_notes: z.array(z.string()).max(3),
      transaction_count: z.number().int(),
    }),
  ),
});

type Suggestion = {
  name: string;
  type: "income" | "expense";
  parent_category_id: string | null;
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
  const uid = await requireUid(request);
  if (!uid) return Errors.unauthorized();

  // Find the high-water mark from the last 'done' run.
  const lastDoneSnap = await aiRunCol(uid)
    .where("status", "==", "done")
    .orderBy("upToUpdatedAt", "desc")
    .limit(1)
    .get();
  const fromUpdatedAt: Timestamp | null = lastDoneSnap.empty
    ? null
    : (lastDoneSnap.docs[0].data().upToUpdatedAt as Timestamp);

  // Most recent transaction updatedAt → window upper bound.
  const maxSnap = await txCol(uid).orderBy("updatedAt", "desc").limit(1).get();
  const upToUpdatedAt: Timestamp = maxSnap.empty
    ? Timestamp.fromMillis(0)
    : (maxSnap.docs[0].data().updatedAt as Timestamp);

  const catSnap = await categoryCol(uid).get();
  const categories: CategoryRow[] = catSnap.docs.map((d) => {
    const data = d.data();
    return { id: d.id, name: data.name, type: data.type, level: data.level };
  });
  const catMap = new Map(categories.map((c) => [c.id, c.name]));
  const categoryIdSet = new Set(categories.map((c) => c.id));

  // Read transactions in the window [fromUpdatedAt, upToUpdatedAt] with non-empty notes.
  let txQuery = txCol(uid).where("updatedAt", "<=", upToUpdatedAt);
  if (fromUpdatedAt) txQuery = txQuery.where("updatedAt", ">", fromUpdatedAt);
  const txSnap = await txQuery.orderBy("updatedAt", "desc").get();
  const transactions: TransactionRow[] = [];
  for (const t of txSnap.docs) {
    const data = t.data();
    if (!data.note || data.note === "") continue;
    transactions.push({
      note: data.note,
      type: data.type,
      cat_name: catMap.get(data.categoryId) ?? "(unknown)",
    });
  }

  // Record the run.
  const runRef = aiRunCol(uid).doc();
  await runRef.set({
    fromUpdatedAt: fromUpdatedAt ?? null,
    upToUpdatedAt,
    status: transactions.length === 0 ? "done" : "pending",
    createdAt: FieldValue.serverTimestamp(),
  });

  if (transactions.length === 0) {
    return Response.json({ suggestions: [], run_id: runRef.id });
  }

  const userContent = `Danh mục hiện tại:
${JSON.stringify(categories.map((c) => ({ id: c.id, name: c.name, type: c.type, level: c.level })))}

Giao dịch (ghi chú + danh mục hiện tại):
${JSON.stringify(transactions.map((t) => ({ note: t.note, type: t.type, category: t.cat_name })))}

Gợi ý các danh mục mới nên thêm để tổ chức tốt hơn.`;

  let parsedOutput: z.infer<typeof SuggestionSchema>;
  try {
    const model = getModel({ systemInstruction: SYSTEM_PROMPT, responseSchema: SuggestionResponseSchema });
    const result = await model.generateContent(userContent);
    parsedOutput = SuggestionSchema.parse(JSON.parse(result.response.text()));
  } catch (err) {
    console.error("AI suggest error:", err);
    await runRef.delete();
    return Response.json({ error: String(err), code: "AI_ERROR" }, { status: 502 });
  }

  const suggestions: Suggestion[] = (parsedOutput.suggestions ?? [])
    .filter((s) => s.parent_category_id === null || categoryIdSet.has(s.parent_category_id))
    .map((s) => ({
      name: s.name,
      type: s.type,
      parent_category_id: s.parent_category_id,
      parent_category_name: s.parent_category_id ? catMap.get(s.parent_category_id) ?? null : null,
      example_notes: s.example_notes.slice(0, 3),
      transaction_count: s.transaction_count,
    }));

  return Response.json({ suggestions, run_id: runRef.id });
}
