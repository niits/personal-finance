const _fmt = new Intl.NumberFormat("vi-VN");

export function formatVND(amount: number): string {
  return _fmt.format(amount);
}
