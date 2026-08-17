export function assertCanonicalDate(value: string, label: string): void {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new Error(`${label} must be a real canonical YYYY-MM-DD date: ${value}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  if (year === 0 || month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1]) {
    throw new Error(`${label} must be a real canonical YYYY-MM-DD date: ${value}`);
  }
}
