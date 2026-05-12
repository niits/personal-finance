// Derive the same dashboard summary the old /api/dashboard route returned,
// from a list of transactions + the monthly budget. Pure function for testability.
import { getBudgetPeriod, getBudgetPeriodInclusive, currentBudgetMonth } from "@/lib/validators";
import { idealBudgetAtDay } from "@/lib/pace-line";
import type { MonthlyBudget, Transaction, Adjustment } from "@/lib/schema";

export type DashboardData = {
  month: string;
  period_start: string;
  period_end: string;
  total_expense: number;
  total_income: number;
  savings: number;
  monthly_budget: { id: string; amount: number; remaining: number } | null;
  days_in_period: number;
  days_elapsed: number;
  days_remaining: number;
  pace_status: "under" | "over" | "no_budget";
  daily_expenses: { date: string; amount: number }[];
};

export function deriveDashboard(opts: {
  month: string;
  budget: MonthlyBudget | null;
  adjustments: Adjustment[];
  transactions: Transaction[];
  today?: Date;
}): DashboardData {
  const { month, budget, adjustments, transactions } = opts;
  const today = opts.today ?? new Date();
  const isCurrentBudgetMonth = month === currentBudgetMonth();

  const computed = getBudgetPeriod(month);
  const computedInclusive = getBudgetPeriodInclusive(month);
  const useStored = budget && budget.startDate && budget.endDate;
  const periodStart = useStored ? budget.startDate! : computed.start;
  const periodEnd = useStored ? budget.endDate! : computedInclusive.end_date;
  const periodEndExclusive = useStored
    ? (() => {
        const d = new Date(periodEnd + "T00:00:00Z");
        d.setUTCDate(d.getUTCDate() + 1);
        return d.toISOString().substring(0, 10);
      })()
    : computed.end;

  const periodDays = Math.round(
    (new Date(periodEndExclusive + "T00:00:00Z").getTime() -
      new Date(periodStart + "T00:00:00Z").getTime()) /
      86_400_000,
  );

  const todayStr = today.toISOString().substring(0, 10);
  const daysElapsed = isCurrentBudgetMonth
    ? Math.min(
        Math.round(
          (new Date(todayStr + "T00:00:00Z").getTime() -
            new Date(periodStart + "T00:00:00Z").getTime()) /
            86_400_000,
        ) + 1,
        periodDays,
      )
    : periodDays;
  const daysRemaining = periodDays - daysElapsed;

  // Filter transactions in period (inclusive on both ends — same as old route).
  const inPeriod = transactions.filter(
    (t) => t.date >= periodStart && t.date <= periodEnd,
  );

  let totalExpense = 0;
  let totalIncome = 0;
  const dailyMap = new Map<string, number>();
  for (const t of inPeriod) {
    if (t.type === "expense") {
      totalExpense += t.amount;
      dailyMap.set(t.date, (dailyMap.get(t.date) ?? 0) + t.amount);
    } else {
      totalIncome += t.amount;
    }
  }
  const daily_expenses = [...dailyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amount]) => ({ date, amount }));

  let monthly_budget: DashboardData["monthly_budget"] = null;
  let pace_status: DashboardData["pace_status"] = "no_budget";
  if (budget) {
    const adjustedAmount =
      budget.amount + adjustments.reduce((s, a) => s + a.delta, 0);
    // The budget doc itself already reflects adjustments (we increment on PATCH),
    // so use budget.amount directly to match the old behavior.
    void adjustedAmount;
    const remaining = budget.amount - totalExpense;
    monthly_budget = { id: budget.id, amount: budget.amount, remaining };
    const ideal = idealBudgetAtDay({
      budget: budget.amount,
      daysInMonth: periodDays,
      day: daysElapsed,
    });
    pace_status = totalExpense > ideal ? "over" : "under";
  }

  return {
    month,
    period_start: periodStart,
    period_end: periodEnd,
    total_expense: totalExpense,
    total_income: totalIncome,
    savings: totalIncome - totalExpense,
    monthly_budget,
    days_in_period: periodDays,
    days_elapsed: daysElapsed,
    days_remaining: daysRemaining,
    pace_status,
    daily_expenses,
  };
}

// Build the "category path" string used in the UI (e.g., "Ăn uống > Ăn ngoài").
export function buildCategoryPath(
  categoryId: string,
  catMap: Map<string, { name: string; parentId: string | null }>,
): string {
  const parts: string[] = [];
  let current: string | null = categoryId;
  let safety = 5;
  while (current && safety-- > 0) {
    const c = catMap.get(current);
    if (!c) break;
    parts.unshift(c.name);
    current = c.parentId;
  }
  return parts.join(" > ");
}

export function getRootCategoryName(
  categoryId: string,
  catMap: Map<string, { name: string; parentId: string | null }>,
): string {
  let current: string | null = categoryId;
  let safety = 5;
  let lastName = "";
  while (current && safety-- > 0) {
    const c = catMap.get(current);
    if (!c) break;
    lastName = c.name;
    if (!c.parentId) return c.name;
    current = c.parentId;
  }
  return lastName;
}
