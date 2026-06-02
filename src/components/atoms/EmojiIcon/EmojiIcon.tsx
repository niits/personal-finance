type EmojiIconProps = {
  emoji: string | null;
  fallback?: string;
  colorScheme?: "expense" | "income" | "neutral";
  size?: "sm" | "md";
};

const colorMap = {
  expense: { bg: "rgba(255,59,48,0.08)", text: "var(--danger)" },
  income:  { bg: "rgba(52,199,89,0.08)",  text: "var(--success)" },
  neutral: { bg: "var(--canvas-parchment)", text: "var(--ink-muted-48)" },
};

const sizeMap = {
  sm: { outer: 28, fontSize: 14, fallbackSize: 11 },
  md: { outer: 32, fontSize: 17, fallbackSize: 13 },
};

export function EmojiIcon({ emoji, fallback = "?", colorScheme = "neutral", size = "md" }: EmojiIconProps) {
  const colors = colorMap[colorScheme];
  const dims = sizeMap[size];

  return (
    <div
      className="rounded-full shrink-0 flex items-center justify-center"
      style={{
        width: dims.outer,
        height: dims.outer,
        background: colors.bg,
        fontSize: emoji ? dims.fontSize : dims.fallbackSize,
        ...(emoji ? {} : {
          fontFamily: "var(--font-display)",
          fontWeight: 600,
          color: colors.text,
        }),
      }}
    >
      {emoji ? emoji + "️" : fallback}
    </div>
  );
}
