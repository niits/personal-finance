import type {
  EventKind,
  MovePositionCommand,
  NormalEventKind,
  PositionAction,
  PositionKind,
} from "./types";
import { assertCanonicalDate } from "./date";

export const positionActionMatrix = {
  term_deposit: { fund: "cash_to_position", withdraw: "position_to_cash" },
  personal_receivable: { lend: "cash_to_position", collect: "position_to_cash" },
  credit_card: { pay: "cash_to_position" },
  personal_payable: { borrow: "position_to_cash", repay: "cash_to_position" },
} as const satisfies Record<PositionKind, Partial<Record<PositionAction, NormalEventKind>>>;

export type PositionStatus = "open" | "overdue" | "settled" | "closed";
export type PositionGroupCode = "creditCards" | "owedToMe" | "iOwe" | "termDeposits";
export type PositionCashEffect = "pay" | "receive" | "none";

export type PositionSummary = {
  id: string;
  name: string;
  kind: PositionKind;
  kindLabel: string;
  counterparty: string | null;
  dueDate: string | null;
  note: string | null;
  balance: number;
  status: PositionStatus;
  latestActivityDate: string | null;
  closedAt: string | null;
};

export type PositionGroup = {
  code: PositionGroupCode;
  label: string;
  normalTotal: number;
  oppositeSignTotal: number;
  count: number;
  positions: PositionSummary[];
};

export type PositionListResponse = {
  groups: PositionGroup[];
  closedHistory: PositionSummary[];
};

export type PositionAvailableAction = {
  code: PositionAction | "close";
  label: string;
  cashEffect: PositionCashEffect;
  maxAmount: number | null;
};

export type PositionActivityCode =
  | "openingBalance"
  | "cardPurchase"
  | "purchaseRefund"
  | "cardPayment"
  | "moneyLent"
  | "principalCollected"
  | "moneyBorrowed"
  | "principalRepaid"
  | "depositFunded"
  | "depositWithdrawn"
  | "balanceAdjustment"
  | "correction"
  | "closeSettlement";

export type PositionFinancialActivity = {
  type: "financial";
  id: string;
  code: PositionActivityCode;
  label: string;
  date: string;
  amount: number;
  cashChange: number;
  positionChange: number;
  note: string | null;
  category: { id: number; name: string; emoji: string | null } | null;
  allocations: Array<{ customBudgetId: string; name: string; amount: number }>;
  reversal: { reversesActivityId: string | null; reversedByActivityId: string | null };
  isCloseSettlement: boolean;
};

export type PositionLifecycleActivity = {
  type: "lifecycle";
  id: string;
  code: "positionClosed" | "positionCloseReversed";
  label: string;
  date: string;
  recordedAt: number;
  closureId: string;
  settlementActivityId: string | null;
  reversalActivityId: string | null;
};

export type PositionActivity = PositionFinancialActivity | PositionLifecycleActivity;

export type PositionDetailResponse = {
  position: PositionSummary;
  closure: { id: string; date: string; settlementActivityId: string | null } | null;
  activities: PositionActivity[];
  actions: PositionAvailableAction[];
};

export const positionKindLabels: Record<PositionKind, string> = {
  term_deposit: "Tiền gửi kỳ hạn",
  personal_receivable: "Khoản phải thu",
  credit_card: "Thẻ tín dụng",
  personal_payable: "Khoản phải trả",
};

export const positionGroupDefinitions: ReadonlyArray<{
  code: PositionGroupCode;
  label: string;
  kind: PositionKind;
  expectedSign: 1 | -1;
}> = [
  { code: "creditCards", label: "Thẻ tín dụng", kind: "credit_card", expectedSign: -1 },
  { code: "owedToMe", label: "Người khác nợ tôi", kind: "personal_receivable", expectedSign: 1 },
  { code: "iOwe", label: "Tôi đang nợ", kind: "personal_payable", expectedSign: -1 },
  { code: "termDeposits", label: "Tiền gửi kỳ hạn", kind: "term_deposit", expectedSign: 1 },
];

export function availablePositionActions(
  kind: PositionKind,
  balance: number,
  closed: boolean,
): PositionAvailableAction[] {
  if (closed) return [];
  const actions: PositionAvailableAction[] = [];
  if (kind === "term_deposit" && balance >= 0) {
    actions.push({ code: "fund", label: "Gửi thêm", cashEffect: "pay", maxAmount: null });
    if (balance > 0) actions.push({ code: "withdraw", label: "Rút tiền", cashEffect: "receive", maxAmount: balance });
  }
  if (kind === "personal_receivable" && balance >= 0) {
    actions.push({ code: "lend", label: "Cho vay thêm", cashEffect: "pay", maxAmount: null });
    if (balance > 0) actions.push({ code: "collect", label: "Thu hồi", cashEffect: "receive", maxAmount: balance });
  }
  if (kind === "credit_card" && balance < 0) {
    actions.push({ code: "pay", label: "Thanh toán thẻ", cashEffect: "pay", maxAmount: Math.abs(balance) });
  }
  if (kind === "personal_payable" && balance <= 0) {
    actions.push({ code: "borrow", label: "Vay thêm", cashEffect: "receive", maxAmount: null });
    if (balance < 0) actions.push({ code: "repay", label: "Trả nợ", cashEffect: "pay", maxAmount: Math.abs(balance) });
  }
  actions.push({
    code: "close",
    label: "Tất toán",
    cashEffect: balance > 0 ? "receive" : balance < 0 ? "pay" : "none",
    maxAmount: Math.abs(balance),
  });
  return actions;
}

export function positionActivityPresentation(
  kind: PositionKind,
  eventKind: EventKind,
  isCloseSettlement: boolean,
): { code: PositionActivityCode; label: string } {
  if (isCloseSettlement) return { code: "closeSettlement", label: "Tất toán vị thế" };
  if (eventKind === "opening_position") return { code: "openingBalance", label: "Số dư ban đầu" };
  if (eventKind === "expense_position") return { code: "cardPurchase", label: "Chi tiêu bằng thẻ" };
  if (eventKind === "refund_position") return { code: "purchaseRefund", label: "Hoàn tiền thẻ" };
  if (eventKind === "position_adjustment") return { code: "balanceAdjustment", label: "Điều chỉnh số dư" };
  if (eventKind === "reversal") return { code: "correction", label: "Bút toán điều chỉnh" };
  if (eventKind === "cash_to_position") {
    if (kind === "credit_card") return { code: "cardPayment", label: "Đã thanh toán thẻ" };
    if (kind === "personal_payable") return { code: "principalRepaid", label: "Đã trả nợ" };
    if (kind === "personal_receivable") return { code: "moneyLent", label: "Đã cho vay" };
    return { code: "depositFunded", label: "Đã gửi tiền" };
  }
  if (kind === "personal_payable") return { code: "moneyBorrowed", label: "Đã vay" };
  if (kind === "personal_receivable") return { code: "principalCollected", label: "Đã thu hồi" };
  return { code: "depositWithdrawn", label: "Đã rút tiền" };
}

export function positionActionEventKind(
  positionKind: PositionKind,
  action: PositionAction,
): "cash_to_position" | "position_to_cash" {
  const eventKind = (positionActionMatrix[positionKind] as Partial<Record<PositionAction, NormalEventKind>>)[
    action
  ];
  if (eventKind !== "cash_to_position" && eventKind !== "position_to_cash") {
    throw new Error(`Action ${action} is not valid for ${positionKind}`);
  }
  return eventKind;
}

export function closePosition(
  positionId: string,
  balance: number,
  date: string,
): MovePositionCommand | null {
  assertCanonicalDate(date, "Event date");
  if (!Number.isSafeInteger(balance)) {
    throw new Error("Position balance must be a safe integer");
  }
  if (balance === 0) return null;

  return {
    type: "move_position",
    amount: Math.abs(balance),
    positionId,
    direction: balance > 0 ? "position_to_cash" : "cash_to_position",
    date,
  };
}
