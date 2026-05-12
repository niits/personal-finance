import type { NextRequest } from "next/server";
import { Schema } from "firebase/ai";
import { z } from "zod";
import { Timestamp } from "firebase-admin/firestore";
import { Errors } from "@/lib/errors";
import { getModel } from "@/lib/llm";
import { requireUid } from "@/lib/server-auth";
import { aiRunCol, categoryCol, txCol } from "@/lib/firestore";

type CategoryRow = { id: string; name: string; type: "income" | "expense" };
type TransactionRow = { id: string; note: string; type: "income" | "expense"; categoryId: string; cat_name: string };

const RecategorizeResponseSchema = Schema.object({
  properties: {
    recategorizations: Schema.array({
      items: Schema.object({
        properties: {
          transaction_id: Schema.string({ description: "ID của giao dịch cần đổi danh mục" }),
          suggested_category_id: Schema.string({ description: "ID danh mục lá phù hợp hơn từ danh sách" }),
          reason: Schema.string({ description: "Lý do ngắn gọn bằng tiếng Việt (1 câu)" }),
        },
        required: ["transaction_id", "suggested_category_id", "reason"],
      }),
    }),
  },
  required: ["recategorizations"],
});

// Zod schema for post-parse validation.
const RecategorizeSchema = z.object({
  recategorizations: z.array(
    z.object({
      transaction_id: z.string(),
      suggested_category_id: z.string(),
      reason: z.string(),
    }),
  ),
});

export type RecategorizeSuggestion = {
  transaction_id: string;
  note: string;
  current_category_id: string;
  current_category_name: string;
  suggested_category_id: string;
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
  const uid = await requireUid(request);
  if (!uid) return Errors.unauthorized();

  // Latest 'available' run is what we recategorize against.
  const runSnap = await aiRunCol(uid)
    .where("status", "==", "available")
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();
  if (runSnap.empty) return Errors.notFound("Không tìm thấy phiên gợi ý đã áp dụng");
  const runRef = runSnap.docs[0].ref;
  const run = runSnap.docs[0].data();
  const fromUpdatedAt: Timestamp | null = (run.fromUpdatedAt as Timestamp | null) ?? null;
  const upToUpdatedAt: Timestamp = run.upToUpdatedAt as Timestamp;

  // Build leaf-category list (no children).
  type CatData = { name: string; parentId: string | null; type: "income" | "expense" };
  const allCatsSnap = await categoryCol(uid).get();
  const allCats = allCatsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as CatData) }));
  const childParentSet = new Set(allCats.map((c) => c.parentId).filter(Boolean) as string[]);
  const leafCategories: CategoryRow[] = allCats
    .filter((c) => !childParentSet.has(c.id))
    .map((c) => ({ id: c.id, name: c.name, type: c.type }));
  const leafIdSet = new Set(leafCategories.map((c) => c.id));
  const leafNameMap = new Map(leafCategories.map((c) => [c.id, c.name]));

  // Fetch transactions in run's window.
  let txQuery = txCol(uid).where("updatedAt", "<=", upToUpdatedAt);
  if (fromUpdatedAt) txQuery = txQuery.where("updatedAt", ">", fromUpdatedAt);
  const txSnap = await txQuery.orderBy("updatedAt", "desc").get();

  const allCatNameMap = new Map(allCats.map((c) => [c.id, c.name]));
  const transactions: TransactionRow[] = [];
  for (const t of txSnap.docs) {
    const data = t.data();
    if (!data.note || data.note === "") continue;
    transactions.push({
      id: t.id,
      note: data.note,
      type: data.type,
      categoryId: data.categoryId,
      cat_name: allCatNameMap.get(data.categoryId) ?? "(unknown)",
    });
  }

  // Mark run as done before LLM call — window is committed.
  await runRef.update({ status: "done" });

  if (transactions.length === 0) {
    return Response.json({ suggestions: [] });
  }

  const txMap = new Map(transactions.map((t) => [t.id, t]));

  const userContent = `Danh mục lá hiện có:
${JSON.stringify(leafCategories.map((c) => ({ id: c.id, name: c.name, type: c.type })))}

Giao dịch cần xem xét:
${JSON.stringify(transactions.map((t) => ({ id: t.id, note: t.note, type: t.type, current_category_id: t.categoryId, current_category: t.cat_name })))}

Gợi ý đổi danh mục cho các giao dịch có danh mục chưa phù hợp.`;

  let output: z.infer<typeof RecategorizeSchema>;
  try {
    const model = getModel({ systemInstruction: SYSTEM_PROMPT, responseSchema: RecategorizeResponseSchema });
    const result = await model.generateContent(userContent);
    output = RecategorizeSchema.parse(JSON.parse(result.response.text()));
  } catch (err) {
    console.error("AI recategorize error:", err);
    return Response.json(
      { error: "Không thể phân tích lúc này. Thử lại sau.", code: "AI_ERROR" },
      { status: 502 },
    );
  }

  const suggestions: RecategorizeSuggestion[] = (output.recategorizations ?? [])
    .filter((r) => {
      const tx = txMap.get(r.transaction_id);
      if (!tx) return false;
      if (!leafIdSet.has(r.suggested_category_id)) return false;
      if (r.suggested_category_id === tx.categoryId) return false;
      return true;
    })
    .map((r) => {
      const tx = txMap.get(r.transaction_id)!;
      return {
        transaction_id: r.transaction_id,
        note: tx.note,
        current_category_id: tx.categoryId,
        current_category_name: tx.cat_name,
        suggested_category_id: r.suggested_category_id,
        suggested_category_name: leafNameMap.get(r.suggested_category_id) ?? "",
        reason: r.reason,
      };
    });

  return Response.json({ suggestions });
}
