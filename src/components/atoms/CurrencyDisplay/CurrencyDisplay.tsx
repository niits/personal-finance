import { formatVND } from "./format";

type CurrencyDisplayProps = {
  amount: number;
  signed?: boolean;
  signType?: "expense" | "income";
  size?: "sm" | "md" | "lg" | "xl";
  muted?: boolean;
};

const sizes: Record<NonNullable<CurrencyDisplayProps["size"]>, React.CSSProperties> = {
  sm: { fontSize: 13, fontWeight: 500, letterSpacing: -0.1 },
  md: { fontSize: 15, fontWeight: 600, letterSpacing: -0.2 },
  lg: { fontSize: 22, fontWeight: 600, letterSpacing: -0.3 },
  xl: { fontSize: 38, fontWeight: 600, letterSpacing: -0.5, lineHeight: 1.1 },
};

export function CurrencyDisplay({ amount, signed, signType, size = "md", muted }: CurrencyDisplayProps) {
  const prefix = signed ? (signType === "income" ? "+" : "−") : "";
  const color = muted
    ? "var(--ink-muted-48)"
    : signed
    ? signType === "income"
      ? "#30d158"
      : "#ff453a"
    : "inherit";

  return (
    <span style={{
      fontFamily: "var(--font-display)",
      color,
      ...sizes[size],
    }}>
      {prefix}{formatVND(amount)}₫
    </span>
  );
}
