import { formatVND } from "@/components/atoms/CurrencyDisplay";
import { Badge } from "@/components/atoms/Badge";

type BudgetProgressBarProps = {
  budget: number;
  spent: number;
  remaining: number;
  pacePct: number;
  dark?: boolean;
  creditCardSpend?: number;
  overuse?: boolean;
};

export function BudgetProgressBar({
  budget, spent, remaining, pacePct, dark = false, creditCardSpend = 0, overuse = false,
}: BudgetProgressBarProps) {
  const budgetPct = Math.min((spent / budget) * 100, 100);
  const isOver = remaining < 0;
  const barColor = isOver ? "var(--danger)" : "var(--primary)";

  const textColor = dark ? "var(--body-muted)" : "var(--ink-muted-48)";
  const accentColor = isOver ? "var(--danger)" : "var(--success)";

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: textColor, fontFamily: "var(--font-body)" }}>
          Ngân sách {formatVND(budget)}₫
        </span>
        <span style={{ fontSize: 12, fontFamily: "var(--font-body)", fontWeight: 600, color: accentColor }}>
          {isOver ? "Vượt " : "Còn "}{formatVND(Math.abs(remaining))}₫
        </span>
      </div>
      {(creditCardSpend > 0 || overuse) && (
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 6, marginBottom: 8, marginTop: -4 }}>
          {creditCardSpend > 0 && (
            <span style={{ fontSize: 11, color: textColor, fontFamily: "var(--font-body)" }}>
              trong đó {formatVND(creditCardSpend)}₫ chưa trừ (thẻ tín dụng)
            </span>
          )}
          {overuse && <Badge label="Dùng thẻ nhiều" variant="danger" />}
        </div>
      )}
      <div style={{ position: "relative", height: 4, borderRadius: 2, background: dark ? "rgba(255,255,255,0.08)" : "var(--hairline)", overflow: "hidden" }}>
        <div style={{
          position: "absolute", inset: 0,
          width: `${pacePct}%`,
          background: dark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.08)",
          borderRadius: 2,
        }} />
        <div style={{
          position: "absolute", inset: 0,
          width: `${budgetPct}%`,
          background: barColor,
          borderRadius: 2,
          transition: "width 0.6s ease",
        }} />
      </div>
    </div>
  );
}
