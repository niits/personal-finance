import { formatVND } from "@/components/atoms/CurrencyDisplay";

type BudgetProgressBarProps = {
  budget: number;
  spent: number;
  remaining: number;
  pacePct: number;
  dark?: boolean;
};

export function BudgetProgressBar({ budget, spent, remaining, pacePct, dark = false }: BudgetProgressBarProps) {
  const budgetPct = Math.min((spent / budget) * 100, 100);
  const isOver = remaining < 0;
  const barColor = isOver ? "#ff453a" : "var(--primary)";

  const textColor = dark ? "rgba(255,255,255,0.5)" : "var(--ink-muted-48)";
  const accentColor = isOver ? "#ff453a" : "#30d158";

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
