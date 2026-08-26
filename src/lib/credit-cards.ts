export function statementPeriodForDate(date: string, closeDay: number): { start: string; end: string } {
  const [year, month, day] = date.split("-").map(Number);
  const closeThisMonth = new Date(Date.UTC(year, month - 1, Math.min(closeDay, new Date(Date.UTC(year, month, 0)).getUTCDate())));
  const transactionDate = new Date(`${date}T00:00:00Z`);
  const end = transactionDate >= closeThisMonth
    ? new Date(Date.UTC(year, month, Math.min(closeDay, new Date(Date.UTC(year, month + 1, 0)).getUTCDate())))
    : closeThisMonth;
  const start = new Date(end);
  start.setUTCMonth(start.getUTCMonth() - 1);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export function isPaidStatement(status: "unpaid" | "paid", paidAt: string | null): boolean {
  return status === "paid" && paidAt !== null;
}
