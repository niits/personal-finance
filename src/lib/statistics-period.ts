/** Return the last date available to a report without exceeding its stored period. */
export function reportEndDate(periodEnd: string, today: string): string {
  return periodEnd < today ? periodEnd : today;
}
