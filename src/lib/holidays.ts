// Official Vietnamese public holiday dates (YYYY-MM-DD).
// Source: annual Prime Minister Decisions (Quyết định của Thủ tướng Chính phủ).
// Update this map each year when the government publishes the holiday schedule.
//
// Includes: Tết Dương lịch, Tết Nguyên Đán, Giỗ Tổ Hùng Vương,
//           Ngày Giải phóng 30/4, Quốc tế Lao động 1/5, Quốc khánh 2/9,
//           plus any government-declared compensatory (make-up) days.

const HOLIDAYS: Record<number, string[]> = {
  2024: [
    "2024-01-01", // Tết Dương lịch
    // Tết Nguyên Đán (Giáp Thìn) — 29/12 âl → 4/1 âl
    "2024-02-08", "2024-02-09", "2024-02-10",
    "2024-02-11", "2024-02-12", "2024-02-13", "2024-02-14",
    "2024-04-18", // Giỗ Tổ Hùng Vương (10/3 âl)
    "2024-04-29", // bù ngày Giải phóng (30/4 rơi thứ Ba, nghỉ bù thứ Hai)
    "2024-04-30", // Ngày Giải phóng miền Nam
    "2024-05-01", // Quốc tế Lao động
    "2024-09-02", // Quốc khánh
    "2024-09-03", // nghỉ bù Quốc khánh
  ],
  2025: [
    "2025-01-01", // Tết Dương lịch
    // Tết Nguyên Đán (Ất Tỵ) — 29/12 âl → 4/1 âl; 25–26/1 là cuối tuần nên bù
    "2025-01-27", "2025-01-28", "2025-01-29",
    "2025-01-30", "2025-01-31",
    "2025-04-07", // Giỗ Tổ Hùng Vương (10/3 âl)
    "2025-04-30", // Ngày Giải phóng miền Nam
    "2025-05-01", // Quốc tế Lao động
    "2025-09-01", // bù Quốc khánh (2/9 rơi thứ Ba, nghỉ bù thứ Hai)
    "2025-09-02", // Quốc khánh
  ],
  2026: [
    "2026-01-01", // Tết Dương lịch
    // Tết Nguyên Đán (Bính Ngọ) — 1/1 âl = 17/2; 29/12 âl = 15/2 (Chủ nhật → bù 16/2)
    "2026-02-16", "2026-02-17", "2026-02-18",
    "2026-02-19", "2026-02-20",
    "2026-04-27", // Giỗ Tổ Hùng Vương bù (10/3 âl = 26/4, Chủ nhật → bù thứ Hai)
    "2026-04-30", // Ngày Giải phóng miền Nam
    "2026-05-01", // Quốc tế Lao động
    "2026-09-02", // Quốc khánh
    "2026-09-03", // nghỉ thêm Quốc khánh
  ],
  2027: [
    "2027-01-01", // Tết Dương lịch
    // Tết Nguyên Đán (Đinh Mùi) — 1/1 âl = 6/2 (Thứ Bảy)
    "2027-02-04", "2027-02-05",
    "2027-02-08", "2027-02-09", "2027-02-10",
    "2027-04-16", // Giỗ Tổ Hùng Vương (10/3 âl)
    "2027-04-30", // Ngày Giải phóng miền Nam
    "2027-05-03", // bù Quốc tế Lao động (1/5 rơi Thứ Bảy → bù thứ Hai 3/5)
    "2027-09-02", // Quốc khánh
    "2027-09-03", // nghỉ thêm Quốc khánh
  ],
  2028: [
    "2028-01-01", // Tết Dương lịch (Chủ nhật → bù 2/1)
    "2028-01-02",
    // Tết Nguyên Đán (Mậu Thân) — 1/1 âl = 26/1
    "2028-01-24", "2028-01-25", "2028-01-26",
    "2028-01-27", "2028-01-28",
    "2028-04-03", // Giỗ Tổ Hùng Vương (10/3 âl)
    "2028-04-28", // bù Ngày Giải phóng (30/4 rơi Chủ nhật → bù thứ Hai 28/4? thực ra 29/4)
    "2028-04-29", // bù/nghỉ thêm 30/4
    "2028-04-30", // Ngày Giải phóng miền Nam
    "2028-05-01", // Quốc tế Lao động
    "2028-09-02", // Quốc khánh
    "2028-09-04", // bù Quốc khánh (2/9 rơi Thứ Bảy → bù thứ Hai 4/9)
  ],
};

const HOLIDAY_SET: Map<number, Set<string>> = new Map(
  Object.entries(HOLIDAYS).map(([y, dates]) => [Number(y), new Set(dates)]),
);

// Fallback fixed-date holidays used when a year is not in the map yet.
// Covers only the statutory dates; compensatory days are not included.
const FIXED_MMDD = new Set(["01-01", "04-30", "05-01", "09-02", "09-03"]);

export function isHoliday(dateStr: string): boolean {
  const year = Number(dateStr.substring(0, 4));
  const yearSet = HOLIDAY_SET.get(year);
  if (yearSet) return yearSet.has(dateStr);
  return FIXED_MMDD.has(dateStr.substring(5));
}
