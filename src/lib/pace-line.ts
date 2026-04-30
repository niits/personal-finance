export function getDaysInMonth(year: number, month: number): number {
  // month is 1-based
  return new Date(year, month, 0).getDate();
}

export function idealBudgetAtDay({
  budget,
  daysInMonth,
  day,
}: {
  budget: number;
  daysInMonth: number;
  day: number;
}): number {
  if (day <= 0) return 0;
  return Math.round((budget / daysInMonth) * day);
}

export function isOverPace({
  actual,
  ideal,
}: {
  actual: number;
  ideal: number;
}): boolean {
  return actual > ideal;
}

export function buildIdealLine(
  budget: number,
  daysInMonth: number,
): { day: number; amount: number }[] {
  return Array.from({ length: daysInMonth }, (_, i) => ({
    day: i + 1,
    amount: idealBudgetAtDay({ budget, daysInMonth, day: i + 1 }),
  }));
}

export function buildActualLine(
  dailyExpenses: Map<number, number>,
  todayDay: number,
): { day: number; amount: number }[] {
  const result: { day: number; amount: number }[] = [];
  let cumulative = 0;
  for (let d = 1; d <= todayDay; d++) {
    cumulative += dailyExpenses.get(d) ?? 0;
    result.push({ day: d, amount: cumulative });
  }
  return result;
}
