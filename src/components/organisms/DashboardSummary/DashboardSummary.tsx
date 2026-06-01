import { MonthStepper } from "@/components/molecules/MonthStepper";
import { BudgetProgressBar } from "@/components/molecules/BudgetProgressBar";
import { CurrencyDisplay } from "@/components/atoms/CurrencyDisplay";

type MonthlyBudget = { id: number; amount: number; remaining: number };

type DashboardSummaryProps = {
  month: string;
  isLatestMonth: boolean;
  periodStart: string;
  periodEnd: string;
  totalExpense: number;
  totalIncome: number;
  savings: number;
  monthlyBudget: MonthlyBudget | null;
  daysElapsed: number;
  daysInPeriod: number;
  loading?: boolean;
  onPrevMonth: () => void;
  onNextMonth: () => void;
};

function fmtPeriodDate(s: string) {
  const [, m, d] = s.split("-");
  return `${parseInt(d)}/${parseInt(m)}`;
}

export function DashboardSummary({
  month,
  isLatestMonth,
  periodStart,
  periodEnd,
  totalExpense,
  totalIncome,
  savings,
  monthlyBudget,
  daysElapsed,
  daysInPeriod,
  loading,
  onPrevMonth,
  onNextMonth,
}: DashboardSummaryProps) {
  const pacePct = Math.min((daysElapsed / daysInPeriod) * 100, 100);

  return (
    <div style={{ background: "var(--surface-black)", color: "var(--on-dark)", flexShrink: 0, padding: "28px 20px 24px" }}>
      <MonthStepper
        month={month}
        isLatest={isLatestMonth}
        onPrev={onPrevMonth}
        onNext={onNextMonth}
        dark
      />

      <p style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--body-muted)", letterSpacing: -0.1, margin: "4px 0 10px" }}>
        {fmtPeriodDate(periodStart)} – {fmtPeriodDate(periodEnd)}
      </p>

      <p style={{ fontFamily: "var(--font-display)", fontSize: 38, fontWeight: 600, lineHeight: 1.1, letterSpacing: -0.5 }}>
        {loading ? "—" : <CurrencyDisplay amount={totalExpense} size="xl" />}
      </p>
      <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--body-muted)", marginTop: "var(--space-xs)", letterSpacing: -0.224 }}>
        đã chi tháng này
      </p>

      {monthlyBudget && (
        <div style={{ marginTop: 18 }}>
          <BudgetProgressBar
            budget={monthlyBudget.amount}
            spent={totalExpense}
            remaining={monthlyBudget.remaining}
            pacePct={pacePct}
            dark
          />
        </div>
      )}

      {totalIncome > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, marginTop: "var(--space-md)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
          <div style={{ background: "rgba(255,255,255,0.07)", padding: "12px 14px" }}>
            <p style={{ fontSize: 12, color: "var(--body-muted)", fontFamily: "var(--font-body)", marginBottom: "var(--space-xs)", letterSpacing: -0.12 }}>Thu nhập</p>
            <CurrencyDisplay amount={totalIncome} signed signType="income" size="md" />
          </div>
          <div style={{ background: "rgba(255,255,255,0.07)", padding: "12px 14px" }}>
            <p style={{ fontSize: 12, color: "var(--body-muted)", fontFamily: "var(--font-body)", marginBottom: "var(--space-xs)", letterSpacing: -0.12 }}>Tiết kiệm</p>
            <CurrencyDisplay amount={savings} signed signType={savings >= 0 ? "income" : "expense"} size="md" />
          </div>
        </div>
      )}
    </div>
  );
}
