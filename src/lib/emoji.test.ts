import { describe, expect, it } from "vitest";
import { isUnicodeEmoji } from "./emoji";

describe("Unicode emoji validation", () => {
  it.each(["🪼", "🧑🏽‍🚀", "🏳️‍🌈", "🇻🇳", "1️⃣", "❤️", "👨‍👩‍👧‍👦"])("accepts %s without a catalog", (emoji) => {
    expect(isUnicodeEmoji(emoji)).toBe(true);
  });
  it.each(["", "abc", "1", "🍜🍔", "🪼 text", "🏽", "🇻"])("rejects non-emoji or multiple graphemes: %s", (value) => {
    expect(isUnicodeEmoji(value)).toBe(false);
  });
});
