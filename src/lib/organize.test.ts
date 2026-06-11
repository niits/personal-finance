import { describe, it, expect } from "vitest";
import { resolveEmojiReassignments, type EmojiTxn } from "./organize";

const txns: EmojiTxn[] = [
  { id: 1, note: "mua thuốc cảm", emoji: null, cat_emoji: "🛒" }, // inherits category emoji
  { id: 2, note: "cà phê sáng", emoji: "🍜", cat_emoji: "🍜" }, // own emoji
  { id: 3, note: "ăn trưa", emoji: null, cat_emoji: null }, // no emoji at all
];

describe("resolveEmojiReassignments", () => {
  it("assigns an emoji to a transaction that has none", () => {
    const out = resolveEmojiReassignments(
      [{ transaction_id: 3, emoji: "🍔", reason: "ăn trưa" }],
      txns,
    );
    expect(out).toEqual([
      { transaction_id: 3, note: "ăn trưa", current_emoji: null, emoji: "🍔", reason: "ăn trưa" },
    ]);
  });

  it("replaces an inherited category emoji based on the note", () => {
    const out = resolveEmojiReassignments(
      [{ transaction_id: 1, emoji: "💊", reason: "thuốc" }],
      txns,
    );
    expect(out[0].current_emoji).toBe("🛒"); // the inherited emoji is reported as current
    expect(out[0].emoji).toBe("💊");
  });

  it("drops a no-op where the suggestion equals the displayed emoji", () => {
    // tx 2 already shows 🍜 (its own emoji); suggesting 🍜 again is a no-op
    const out = resolveEmojiReassignments(
      [{ transaction_id: 2, emoji: "🍜", reason: "x" }],
      txns,
    );
    expect(out).toEqual([]);
  });

  it("drops a no-op against the inherited category emoji", () => {
    // tx 1 inherits 🛒; suggesting 🛒 changes nothing
    const out = resolveEmojiReassignments(
      [{ transaction_id: 1, emoji: "🛒", reason: "x" }],
      txns,
    );
    expect(out).toEqual([]);
  });

  it("ignores unknown transactions and empty emoji", () => {
    const out = resolveEmojiReassignments(
      [
        { transaction_id: 999, emoji: "🎬", reason: "unknown" },
        { transaction_id: 3, emoji: "  ", reason: "blank" },
      ],
      txns,
    );
    expect(out).toEqual([]);
  });
});
