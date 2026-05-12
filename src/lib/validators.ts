import { isHoliday } from "@/lib/holidays";

export function parseAmount(val: unknown): number | null {
  const n = Number(val);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

export function parseDate(val: unknown): string | null {
  if (typeof val !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) return null;
  const d = new Date(val + "T00:00:00Z");
  if (isNaN(d.getTime())) return null;
  return val;
}

export function parseMonth(val: unknown): string | null {
  if (typeof val !== "string") return null;
  if (!/^\d{4}-\d{2}$/.test(val)) return null;
  return val;
}

export function getMonthFromDate(date: string): string {
  return date.substring(0, 7);
}

export function currentMonth(): string {
  return new Date().toISOString().substring(0, 7);
}

export function currentDate(): string {
  return new Date().toISOString().substring(0, 10);
}

export function lastWorkingDay(year: number, month: number): string {
  const d = new Date(Date.UTC(year, month, 0));
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6 || isHoliday(d.toISOString().substring(0, 10))) {
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return d.toISOString().substring(0, 10);
}

export function getBudgetMonthForDate(dateStr: string): string {
  const [y, m] = dateStr.substring(0, 7).split("-").map(Number);
  if (dateStr >= lastWorkingDay(y, m)) {
    return new Date(Date.UTC(y, m, 1)).toISOString().substring(0, 7);
  }
  return dateStr.substring(0, 7);
}

export function getBudgetPeriod(budgetMonth: string): { start: string; end: string } {
  const [y, m] = budgetMonth.split("-").map(Number);
  const prevFirst = new Date(Date.UTC(y, m - 2, 1));
  const start = lastWorkingDay(prevFirst.getUTCFullYear(), prevFirst.getUTCMonth() + 1);
  const end = lastWorkingDay(y, m);
  return { start, end };
}

export function getBudgetPeriodInclusive(budgetMonth: string): { start_date: string; end_date: string } {
  const { start, end } = getBudgetPeriod(budgetMonth);
  const endDay = new Date(end + "T00:00:00Z");
  endDay.setUTCDate(endDay.getUTCDate() - 1);
  return { start_date: start, end_date: endDay.toISOString().substring(0, 10) };
}

export function currentBudgetMonth(): string {
  return getBudgetMonthForDate(currentDate());
}

