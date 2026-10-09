/** Accept one Unicode emoji grapheme without restricting it to a picker catalog. */
export function isUnicodeEmoji(value: string): boolean {
  const segments = [...new Intl.Segmenter("und", { granularity: "grapheme" }).segment(value)];
  if (segments.length !== 1) return false;
  return (/\p{Extended_Pictographic}/u.test(value) &&
    /^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|\u200d|\ufe0f)+$/u.test(value)) ||
    /^\p{Regional_Indicator}{2}$/u.test(value) || /^[0-9#*]\ufe0f?\u20e3$/u.test(value);
}
