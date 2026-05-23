import { formatVND } from "@/components/atoms/CurrencyDisplay";

type DebtProgressBarProps = {
  principal: number;
  repaid: number;
};

export function DebtProgressBar({ principal, repaid }: DebtProgressBarProps) {
  const pct = Math.min((repaid / principal) * 100, 100);
  const remaining = Math.max(0, principal - repaid);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--ink-muted-48)" }}>
          Đã trả {formatVND(repaid)}₫
        </span>
        <span style={{ fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 600, color: remaining === 0 ? "#30d158" : "var(--ink-muted-80)" }}>
          {remaining === 0 ? "Tất toán" : `Còn ${formatVND(remaining)}₫`}
        </span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: "var(--hairline)", overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: `${pct}%`,
          background: remaining === 0 ? "#30d158" : "var(--primary)",
          borderRadius: 2,
          transition: "width 0.5s ease",
        }} />
      </div>
    </div>
  );
}
