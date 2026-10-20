import { isUnicodeEmoji } from "./emoji";

// Pure helpers for the AI "organize" flow. No Next.js / Cloudflare imports so
// this stays unit-testable in plain Node (see organize.test.ts).

export type EmojiTxn = {
  id: number;
  note: string;
  emoji: string | null;
  cat_emoji: string | null;
};

export type EmojiSuggestion = {
  transaction_id: number;
  emoji: string;
  reason: string;
};

export type ResolvedEmojiReassignment = {
  transaction_id: number;
  note: string;
  current_emoji: string | null;
  emoji: string;
  reason: string;
};

/**
 * Validate per-transaction emoji suggestions from the model:
 * - drop suggestions for unknown transactions,
 * - drop empty emoji,
 * - drop no-ops where the suggested emoji equals what the transaction already
 *   shows (its own emoji, or the inherited category emoji when it has none).
 * The transaction's displayed emoji is `emoji ?? cat_emoji`, matching the UI.
 */
export function resolveEmojiReassignments(
  suggestions: EmojiSuggestion[],
  transactions: EmojiTxn[],
): ResolvedEmojiReassignment[] {
  return suggestions.flatMap((s) => {
    const txn = transactions.find((t) => t.id === s.transaction_id);
    const emoji = s.emoji.trim();
    if (!txn || !isUnicodeEmoji(emoji)) return [];
    const currentEmoji = txn.emoji ?? txn.cat_emoji;
    if (emoji === currentEmoji) return []; // no-op
    return [{
      transaction_id: s.transaction_id,
      note: txn.note,
      current_emoji: currentEmoji,
      emoji,
      reason: s.reason,
    }];
  });
}
