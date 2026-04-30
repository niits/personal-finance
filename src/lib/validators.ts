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
