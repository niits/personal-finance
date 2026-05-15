import type { NextRequest } from "next/server";
import { z } from "zod";
import { getDB } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { Errors } from "@/lib/errors";
import { runAIObject } from "@/lib/llm";

type CategoryRow = { id: number; name: string; type: "income" | "expense"; level: number };

const FillEmojiSchema = z.object({
  assignments: z.array(
    z.object({
      id: z.number().int().describe("ID danh mục"),
      emoji: z.string().describe("Một emoji Unicode duy nhất đại diện cho danh mục này"),
    }),
  ),
});

const SYSTEM_PROMPT = `Bạn là trợ lý gán emoji cho danh mục tài chính cá nhân tiếng Việt.

Quy tắc:
1. Mỗi danh mục nhận đúng 1 emoji Unicode
2. Emoji phải đại diện trực quan cho danh mục (ví dụ: Ăn uống → 🍜, Di chuyển → 🚗, Lương → 💰)
3. Ưu tiên emoji phổ biến, dễ nhận diện trên iPhone
4. Không dùng chữ cái, số, hay ký tự đặc biệt — chỉ emoji`;

export async function POST(request: NextRequest) {
  const session = await requireSession(request);
  if (!session) return Errors.unauthorized();

  const db = await getDB();
  const userId = session.user.id;

  const { results: missing } = await db
    .prepare(
      `SELECT id, name, type, level FROM category
       WHERE user_id = ? AND (emoji IS NULL OR emoji = '')
       ORDER BY level, id`,
    )
    .bind(userId)
    .all<CategoryRow>();

  if (missing.length === 0) {
    return Response.json({ updated: 0 });
  }

  const prompt = `Gán emoji cho các danh mục tài chính sau:
${JSON.stringify(missing.map((c) => ({ id: c.id, name: c.name, type: c.type })))}`;

  let result: z.infer<typeof FillEmojiSchema>;
  try {
    result = await runAIObject({
      schema: FillEmojiSchema,
      system: SYSTEM_PROMPT,
      prompt,
      traceName: "fill-emoji",
      userId,
    });
  } catch (err) {
    console.error("AI fill-emoji error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message, code: "AI_ERROR" }, { status: 502 });
  }

  const missingIds = new Set(missing.map((c) => c.id));
  const valid = result.assignments.filter(
    (a) => missingIds.has(a.id) && typeof a.emoji === "string" && a.emoji.trim().length > 0,
  );

  // Batch update using individual statements (D1 doesn't support bulk UPDATE with CASE)
  await Promise.all(
    valid.map((a) =>
      db
        .prepare(`UPDATE category SET emoji = ? WHERE id = ? AND user_id = ?`)
        .bind(a.emoji.trim(), a.id, userId)
        .run(),
    ),
  );

  return Response.json({ updated: valid.length, assignments: valid });
}
