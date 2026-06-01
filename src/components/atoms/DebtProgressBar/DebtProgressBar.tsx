import { formatVND } from "@/components/atoms/CurrencyDisplay";

type DebtProgressBarProps = {
  openingAmount: number;
  totalRepaid: number;
  variant?: "lend" | "borrow";  // lend=blue, borrow=amber
};

export function DebtProgressBar({ openingAmount, totalRepaid, variant = "lend" }: DebtProgressBarProps) {
  const pct = openingAmount > 0 ? Math.min((totalRepaid / openingAmount) * 100, 100) : 0;
  const remaining = openingAmount - totalRepaid;
  const settled = remaining <= 0;
  const color = settled ? "var(--success)" : variant === "borrow" ? "#ff9f0a" : "var(--primary)";

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--ink-muted-48)" }}>
          Đã trả {formatVND(totalRepaid)}₫
        </span>
        <span style={{ fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 600, color: settled ? "var(--success)" : "var(--ink-muted-80)" }}>
          {settled ? "Tất toán" : `Còn ${formatVND(remaining)}₫`}
        </span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: "var(--hairline)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 2, transition: "width 0.5s ease" }} />
      </div>
    </div>
  );
}
