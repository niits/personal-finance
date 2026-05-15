type EmojiIconProps = {
  emoji: string | null;
  fallback?: string;
  colorScheme?: "expense" | "income" | "neutral";
  size?: "sm" | "md";
};

const colorMap = {
  expense: { bg: "rgba(255,69,58,0.08)", text: "#ff453a" },
  income:  { bg: "rgba(48,209,88,0.08)",  text: "#30d158" },
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
    <div style={{
      width: dims.outer,
      height: dims.outer,
      borderRadius: "50%",
      flexShrink: 0,
      background: colors.bg,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: emoji ? dims.fontSize : dims.fallbackSize,
      ...(emoji ? {} : {
        fontFamily: "var(--font-display)",
        fontWeight: 600,
        color: colors.text,
      }),
    }}>
      {emoji ? emoji + "️" : fallback}
    </div>
  );
}
