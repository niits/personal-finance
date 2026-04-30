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

// Returns the last working day (Mon-Fri, non-holiday per VN public calendar) of the given month.
export function lastWorkingDay(year: number, month: number): string {
  const d = new Date(Date.UTC(year, month, 0)); // last calendar day of month
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6 || isHoliday(d.toISOString().substring(0, 10))) {
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return d.toISOString().substring(0, 10);
}

// Maps a transaction date to its budget month (YYYY-MM).
// If date >= lastWorkingDay(calendarMonth), it belongs to the NEXT budget month.
export function getBudgetMonthForDate(dateStr: string): string {
  const [y, m] = dateStr.substring(0, 7).split("-").map(Number);
  if (dateStr >= lastWorkingDay(y, m)) {
    return new Date(Date.UTC(y, m, 1)).toISOString().substring(0, 7);
  }
  return dateStr.substring(0, 7);
}

// Returns the half-open date interval [start, end) for a budget month.
// Transactions with start <= date < end belong to this budget month.
export function getBudgetPeriod(budgetMonth: string): { start: string; end: string } {
  const [y, m] = budgetMonth.split("-").map(Number);
  const prevFirst = new Date(Date.UTC(y, m - 2, 1));
  const start = lastWorkingDay(prevFirst.getUTCFullYear(), prevFirst.getUTCMonth() + 1);
  const end = lastWorkingDay(y, m);
  return { start, end };
}

export function currentBudgetMonth(): string {
  return getBudgetMonthForDate(currentDate());
}

export async function isLeafCategory(
  db: D1Database,
  categoryId: number,
  userId: string,
): Promise<boolean> {
  const row = await db
    .prepare("SELECT COUNT(*) as cnt FROM category WHERE parent_id = ? AND user_id = ?")
    .bind(categoryId, userId)
    .first<{ cnt: number }>();
  return (row?.cnt ?? 0) === 0;
}
