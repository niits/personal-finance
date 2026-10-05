import type { NextRequest } from "next/server";
import { z } from "zod";
import { getDB } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { Errors } from "@/lib/errors";
import { getOpenAIModel } from "@/lib/llm";
import { resolveEmojiReassignments } from "@/lib/organize";
import { OrganizePatchSchema, loadOrganizePatchState, validateOrganizePatch } from "@/lib/organize-patch";
import { startAITrace } from "@/lib/telemetry";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { generateObject } from "ai";

const EmojiSchema = z.object({
  assignments: z.array(z.object({
    category_id: z.number().int(),
    emoji: z.string().trim().min(1),
  })),
});

type CategoryRow = {
  id: number; name: string; type: "income" | "expense"; parent_id: number | null;
  level: number; emoji: string | null; system_kind: string | null;
  budget_behavior: string; child_count: number; transaction_count: number;
};
type TransactionRow = { id: number; note: string; type: "income" | "expense"; category_id: number; cat_name: string; emoji: string | null; cat_emoji: string | null; updated_at: number };

const OrganizeSchema = z.object({
  new_categories: z.array(z.object({
    temp_id: z.string().describe("Định danh tạm thời, ví dụ: 'new:0', 'new:1'"),
    name: z.string().describe("Tên danh mục tiếng Việt, ngắn gọn 1-4 từ"),
    type: z.enum(["income", "expense"]),
    parent_category_id: z.number().nullable().describe("ID từ danh sách hiện tại hoặc null"),
    emoji: z.string().trim().min(1).describe("Một emoji Unicode phù hợp với danh mục mới"),
    example_notes: z.array(z.string()).max(3).describe("Tối đa 3 ghi chú thực từ giao dịch"),
  })),
  recategorizations: z.array(z.object({
    transaction_id: z.number().int(),
    suggested_category_id: z.union([z.number().int(), z.string()]).describe("ID danh mục hiện có hoặc temp_id của danh mục mới"),
    reason: z.string().describe("Lý do ngắn gọn tiếng Việt"),
  })),
  emoji_reassignments: z.array(z.object({
    transaction_id: z.number().int(),
    emoji: z.string().describe("Một emoji Unicode duy nhất, phù hợp hơn với ghi chú"),
    reason: z.string().describe("Lý do ngắn gọn tiếng Việt"),
  })),
});

const SYSTEM_PROMPT = `Bạn là trợ lý tài chính cá nhân phân tích giao dịch của người dùng Việt Nam.

Nhiệm vụ: Phân tích giao dịch và trả về 3 loại gợi ý:

1. new_categories: Danh mục MỚI nên thêm (chưa tồn tại). Chỉ gợi ý khi có ≥3 giao dịch tương tự. Tên tiếng Việt ngắn gọn và một emoji phù hợp.
2. recategorizations: Giao dịch đang phân loại sai — chuyển sang danh mục phù hợp hơn (có thể là danh mục mới với temp_id).
3. emoji_reassignments: Dựa trên GHI CHÚ của giao dịch, gán emoji riêng phù hợp hơn cho giao dịch đó. Emoji này KHÔNG nhất thiết kế thừa từ danh mục — ưu tiên nội dung ghi chú (ví dụ ghi chú "cà phê" → ☕, "mua thuốc" → 💊). Chỉ gợi ý khi emoji mới khác và phù hợp hơn emoji hiện tại của giao dịch.

Quy tắc:
- Tên danh mục và lý do phải dùng tiếng Việt trang trọng, thông dụng, rõ nghĩa. Tránh từ viết tắt, tiếng lóng và cách diễn đạt văn hoa.
- parent_category_id phải là ID thực từ danh sách, hoặc null
- temp_id dùng định dạng "new:0", "new:1", ...
- suggested_category_id có thể là số (ID hiện có) hoặc chuỗi temp_id (danh mục mới)
- emoji_reassignments.emoji là đúng 1 emoji Unicode, không kèm chữ/số
- Không tự tạo ghi chú — chỉ dùng dữ liệu thực`;

export async function POST(request: NextRequest) {
  const session = await requireSession(request);
  if (!session) return Errors.unauthorized();

  const db = await getDB();
  const userId = session.user.id;

  const [{ results: categories }, { results: transactions }] = await Promise.all([
    db
      .prepare(`SELECT c.id, c.name, c.type, c.parent_id, c.level, c.emoji,
                c.system_kind, c.budget_behavior,
                (SELECT COUNT(*) FROM category child WHERE child.parent_id = c.id AND child.user_id = c.user_id) AS child_count,
                (SELECT COUNT(*) FROM "transaction" t WHERE t.category_id = c.id AND t.user_id = c.user_id) AS transaction_count
                FROM category c WHERE c.user_id = ? ORDER BY c.level, c.id`)
      .bind(userId)
      .all<CategoryRow>(),
    db
      .prepare(`SELECT t.id, t.note, t.type, t.category_id, t.emoji, t.updated_at, c.name as cat_name, c.emoji as cat_emoji
                FROM "transaction" t JOIN category c ON t.category_id = c.id
                WHERE t.user_id = ? AND t.note IS NOT NULL AND t.note != ''
                ORDER BY t.updated_at DESC LIMIT 300`)
      .bind(userId)
      .all<TransactionRow>(),
  ]);

  const catMap = new Map(categories.map((c) => [c.id, c]));
  const categoriesWithoutEmoji = categories.filter((c) => !c.emoji);
  if (transactions.length === 0 && categoriesWithoutEmoji.length === 0) {
    return Response.json({ new_categories: [], emoji_assignments: [], recategorizations: [], emoji_reassignments: [] });
  }

  const userContent = `Danh mục hiện tại:
${JSON.stringify(categories.map((c) => ({ id: c.id, name: c.name, type: c.type, level: c.level, has_emoji: !!c.emoji })))}

Giao dịch (emoji là emoji hiện tại của giao dịch — null nghĩa là đang kế thừa emoji danh mục):
${JSON.stringify(transactions.map((t) => ({ id: t.id, note: t.note, type: t.type, category: t.cat_name, category_id: t.category_id, emoji: t.emoji ?? t.cat_emoji })))}`;

  let result: z.infer<typeof OrganizeSchema> | null = null;
  let emojiAssignments: z.infer<typeof EmojiSchema>["assignments"] = [];
  const { env, ctx } = await getCloudflareContext({ async: true });
  const trace = startAITrace(env as Cloudflare.Env, { name: "organize", userId });
  try {
    const model = await getOpenAIModel();
    const [organizeResult, emojiResult] = await Promise.all([
      transactions.length > 0
        ? generateObject({ model, schema: OrganizeSchema, system: SYSTEM_PROMPT, prompt: userContent, maxOutputTokens: 4096, experimental_telemetry: trace.telemetry })
        : Promise.resolve(null),
      categoriesWithoutEmoji.length > 0
        ? generateObject({
          model,
          schema: EmojiSchema,
          system: "Bạn gán một emoji Unicode phù hợp cho từng danh mục tài chính được cung cấp. Trả về đúng một mục cho mỗi ID, không bỏ sót hoặc thêm ID.",
          prompt: JSON.stringify(categoriesWithoutEmoji.map((c) => ({ category_id: c.id, name: c.name, type: c.type }))),
          maxOutputTokens: Math.max(1024, categoriesWithoutEmoji.length * 40),
          experimental_telemetry: trace.telemetry,
        })
        : Promise.resolve(null),
    ]);
    result = organizeResult?.object ?? null;
    emojiAssignments = emojiResult?.object.assignments ?? [];
  } catch (err) {
    console.error("[ai/organize] AI error:", err);
    return Response.json({ error: "Không thể tạo đề xuất phân loại. Vui lòng thử lại.", code: "AI_ERROR" }, { status: 502 });
  } finally {
    ctx.waitUntil(trace.flush());
  }

  const validCategoryIds = new Set(categories.map((c) => c.id));
  const proposedNames = new Set<string>();
  const proposedIds = new Set<string>();
  const validNewCategories = (result?.new_categories ?? []).map((c) => ({
    ...c, name: c.name.trim(),
    parent_category_name: c.parent_category_id === null ? null : catMap.get(c.parent_category_id)?.name ?? null,
  })).filter((c) => {
    const parent = c.parent_category_id === null ? null : catMap.get(c.parent_category_id);
    const key = `${c.type}:${c.parent_category_id ?? "root"}:${c.name.trim().toLocaleLowerCase("vi")}`;
    const valid = /^new:\d+$/.test(c.temp_id) && !proposedIds.has(c.temp_id) &&
      c.name.trim().length > 0 && c.name.trim().length <= 100 && !proposedNames.has(key) &&
      !categories.some((existing) => existing.type === c.type &&
        existing.parent_id === c.parent_category_id &&
        existing.name.toLocaleLowerCase("vi") === c.name.trim().toLocaleLowerCase("vi")) &&
      (c.parent_category_id === null || (parent && parent.type === c.type &&
        parent.level < 3 && !parent.system_kind && parent.transaction_count === 0));
    if (valid) {
      proposedNames.add(key);
      proposedIds.add(c.temp_id);
    }
    return valid;
  });
  const tempIds = new Set(validNewCategories.map((c) => c.temp_id));

  // Validate and resolve display names for recategorizations
  const seenMoves = new Set<number>();
  const recategorizations = (result?.recategorizations ?? [])
    .filter((r) => {
      const sid = r.suggested_category_id;
      return typeof sid === "string" ? tempIds.has(sid) : validCategoryIds.has(sid);
    })
    .flatMap((r) => {
      const sid = r.suggested_category_id;
      const txn = transactions.find((t) => t.id === r.transaction_id);
      if (!txn || txn.category_id === sid) return [];
      const target = typeof sid === "number" ? catMap.get(sid) : validNewCategories.find((c) => c.temp_id === sid);
      if (!target || target.type !== txn.type) return [];
      if ("id" in target && (target.child_count > 0 || target.system_kind ||
          target.budget_behavior !== "consumption" ||
          validNewCategories.some((c) => c.parent_category_id === target.id))) return [];
      const suggestedName = typeof sid === "string"
        ? (validNewCategories.find((c) => c.temp_id === sid)?.name ?? sid)
        : (catMap.get(sid as number)?.name ?? String(sid));
      return [{
        transaction_id: r.transaction_id,
        note: txn.note,
        current_category_id: txn.category_id,
        current_category_name: txn.cat_name,
        current_updated_at: txn.updated_at,
        suggested_category_id: r.suggested_category_id,
        suggested_category_name: suggestedName,
        reason: r.reason,
      }];
    })
    .filter((move) => {
      if (seenMoves.has(move.transaction_id)) return false;
      seenMoves.add(move.transaction_id);
      return true;
    });

  const transactionById = new Map(transactions.map((transaction) => [transaction.id, transaction]));
  const seenEmojiTransactions = new Set<number>();
  const emoji_reassignments = resolveEmojiReassignments(result?.emoji_reassignments ?? [], transactions)
    .flatMap((assignment) => {
      if (seenEmojiTransactions.has(assignment.transaction_id)) return [];
      const transaction = transactionById.get(assignment.transaction_id);
      seenEmojiTransactions.add(assignment.transaction_id);
      return transaction ? [{ ...assignment, current_updated_at: transaction.updated_at }] : [];
    });

  const emojiById = new Map<number, string>();
  for (const assignment of emojiAssignments) {
    if (categoriesWithoutEmoji.some((c) => c.id === assignment.category_id)) {
      emojiById.set(assignment.category_id, assignment.emoji.trim());
    }
  }
  if (emojiById.size !== categoriesWithoutEmoji.length) {
    return Response.json({ error: "Không thể gợi ý emoji cho toàn bộ danh mục. Vui lòng thử lại.", code: "AI_INCOMPLETE" }, { status: 502 });
  }

  const proposal = {
    new_categories: validNewCategories,
    emoji_assignments: categoriesWithoutEmoji.flatMap((c) => {
      const emoji = emojiById.get(c.id);
      return emoji ? [{ category_id: c.id, category_name: c.name, current_emoji: c.emoji || null, emoji }] : [];
    }),
    recategorizations,
    emoji_reassignments,
  };
  const parsed = OrganizePatchSchema.safeParse(proposal);
  if (!parsed.success) {
    return Response.json({
      error: "Không thể tạo một đề xuất hợp lệ. Vui lòng thử lại.",
      code: "AI_INVALID_PATCH",
    }, { status: 502 });
  }
  const currentState = await loadOrganizePatchState(db, userId, parsed.data);
  if (!validateOrganizePatch(parsed.data, currentState.categories, currentState.transactions)) {
    return Response.json({
      error: "Dữ liệu đã thay đổi trong lúc tạo đề xuất. Vui lòng tạo lại đề xuất.",
      code: "STALE_PROPOSAL",
    }, { status: 409 });
  }
  return Response.json(parsed.data);
}
