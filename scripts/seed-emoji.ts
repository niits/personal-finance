// One-off script: generate emojis for all categories and transactions that have none.
// Run: npx wrangler dev -c wrangler-seed.jsonc --port 9998 --remote
// Then:  curl http://localhost:9998/

import { generateText } from "ai";
import { createWorkersAI } from "workers-ai-provider";

const MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";
const BATCH = 25;

type Item = { id: number; label: string };

// Ask the model to return one "id:emoji" pair per line — avoids JSON schema issues.
async function assignEmojis(
  workersai: ReturnType<typeof createWorkersAI>,
  items: Item[],
): Promise<Map<number, string>> {
  const list = items.map((i) => `${i.id}: ${i.label}`).join("\n");

  const { text } = await generateText({
    model: workersai(MODEL),
    system: `Bạn là trợ lý tài chính. Hãy gán đúng 1 emoji phù hợp nhất cho mỗi mục tài chính.
Chỉ trả về danh sách theo định dạng: <id>: <emoji>
Mỗi dòng một mục. Không giải thích, không dùng cờ quốc gia.`,
    prompt: `Gán emoji cho từng mục sau:\n${list}`,
  });

  const map = new Map<number, string>();
  for (const line of text.split("\n")) {
    const m = line.match(/^(\d+)\s*:\s*(\p{Emoji_Presentation}|\p{Extended_Pictographic})/u);
    if (m) map.set(Number(m[1]), m[2]);
  }

  // Fallback: any line with "id: <something>" where something has emoji chars
  if (map.size < items.length * 0.5) {
    for (const line of text.split("\n")) {
      const m = line.match(/^(\d+)[^\d]+([\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27BF}])/u);
      if (m && !map.has(Number(m[1]))) map.set(Number(m[1]), m[2]);
    }
  }

  return map;
}

export default {
  async fetch(_req: Request, env: { AI: Ai; DB: D1Database }) {
    const workersai = createWorkersAI({ binding: env.AI });
    const log: string[] = [];

    // ── Categories ──────────────────────────────────────────
    const { results: cats } = await env.DB.prepare(
      `SELECT id, name FROM category WHERE emoji IS NULL ORDER BY id`,
    ).all<{ id: number; name: string }>();

    log.push(`Found ${cats.length} categories without emoji`);

    for (let i = 0; i < cats.length; i += BATCH) {
      const batch = cats.slice(i, i + BATCH);
      const items: Item[] = batch.map((c) => ({ id: c.id, label: c.name }));
      const map = await assignEmojis(workersai, items);

      if (map.size > 0) {
        const stmt = env.DB.prepare(`UPDATE category SET emoji = ? WHERE id = ?`);
        await env.DB.batch([...map.entries()].map(([id, emoji]) => stmt.bind(emoji, id)));
      }
      log.push(`  cats batch ${i}–${i + batch.length - 1}: updated ${map.size}/${batch.length}`);
    }

    // ── Transactions ─────────────────────────────────────────
    const { results: txns } = await env.DB.prepare(
      `SELECT t.id,
              COALESCE(t.note, '') AS note,
              c.name              AS cat_name
       FROM "transaction" t
       JOIN category c ON t.category_id = c.id
       WHERE t.emoji IS NULL
       ORDER BY t.id`,
    ).all<{ id: number; note: string; cat_name: string }>();

    log.push(`Found ${txns.length} transactions without emoji`);

    for (let i = 0; i < txns.length; i += BATCH) {
      const batch = txns.slice(i, i + BATCH);
      const items: Item[] = batch.map((t) => ({
        id: t.id,
        label: t.note ? `${t.note} (${t.cat_name})` : t.cat_name,
      }));
      const map = await assignEmojis(workersai, items);

      if (map.size > 0) {
        const stmt = env.DB.prepare(`UPDATE "transaction" SET emoji = ? WHERE id = ?`);
        await env.DB.batch([...map.entries()].map(([id, emoji]) => stmt.bind(emoji, id)));
      }
      log.push(`  txns batch ${i}–${i + batch.length - 1}: updated ${map.size}/${batch.length}`);
    }

    return Response.json({ ok: true, log });
  },
};
