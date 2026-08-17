import type { BudgetPeriodDto, FinancialEventDto } from "./contracts";

export type LedgerCategoryNode = {
  id: number;
  name: string;
  emoji: string | null;
  type: "income" | "expense";
  children?: LedgerCategoryNode[];
};

export type LedgerLeafCategory = Omit<LedgerCategoryNode, "children"> & { label: string };

type PlanValues = BudgetPeriodDto["effective"];
type PlanTarget = "planned_income" | "savings_target" | "spending_limit";

function canonicalDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

export function flattenLeafCategories(
  nodes: LedgerCategoryNode[],
  ancestors: string[] = [],
): LedgerLeafCategory[] {
  return nodes.flatMap((node) => {
    const path = [...ancestors, node.name];
    if (node.children?.length) return flattenLeafCategories(node.children, path);
    return [{ id: node.id, name: node.name, label: path.join(" › "), emoji: node.emoji, type: node.type }];
  });
}

function validatePlan(values: PlanValues): string | null {
  const amounts = [values.plannedIncome, values.savingsTarget, values.spendingLimit];
  if (amounts.some((value) => !Number.isSafeInteger(value))) {
    return "Các giá trị kế hoạch phải là số nguyên hợp lệ.";
  }
  if (amounts.some((value) => value < 0)) {
    return "Các giá trị kế hoạch phải không âm.";
  }
  if (BigInt(values.spendingLimit) + BigInt(values.savingsTarget) > BigInt(values.plannedIncome)) {
    return "Giới hạn chi tiêu và mục tiêu tiết kiệm không được vượt thu nhập dự kiến.";
  }
  return null;
}

export function validatePeriodDraft(draft: PlanValues & {
  label: string;
  startDate: string;
  endDate: string;
  objective: string | null;
}): string | null {
  if (!draft.label.trim()) return "Tên kỳ ngân sách là bắt buộc.";
  if (!canonicalDate(draft.startDate) || !canonicalDate(draft.endDate) || draft.startDate > draft.endDate) {
    return "Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.";
  }
  return validatePlan(draft);
}

export function validatePeriodAdjustment(
  effective: PlanValues,
  target: PlanTarget,
  delta: number,
): string | null {
  if (!Number.isSafeInteger(delta) || delta === 0) return "Mức điều chỉnh phải là số nguyên khác 0.";
  const key = target === "planned_income"
    ? "plannedIncome"
    : target === "savings_target"
      ? "savingsTarget"
      : "spendingLimit";
  return validatePlan({ ...effective, [key]: effective[key] + delta });
}

export function mergeEventPage(
  current: FinancialEventDto[],
  incoming: FinancialEventDto[],
): FinancialEventDto[] {
  const seen = new Set(current.map((event) => event.id));
  return incoming.reduce((events, event) => {
    if (!seen.has(event.id)) {
      seen.add(event.id);
      events.push(event);
    }
    return events;
  }, [...current]);
}

export function calendarMonthDefaults(date = new Date()): {
  label: string;
  start: string;
  end: string;
} {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const monthText = String(month).padStart(2, "0");
  const lastDay = new Date(year, month, 0).getDate();
  return {
    label: `Tháng ${month}/${year}`,
    start: `${year}-${monthText}-01`,
    end: `${year}-${monthText}-${String(lastDay).padStart(2, "0")}`,
  };
}
