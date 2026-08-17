export type EventKind =
  | "opening_cash"
  | "opening_position"
  | "income_cash"
  | "expense_cash"
  | "expense_position"
  | "refund_cash"
  | "refund_position"
  | "cash_to_position"
  | "position_to_cash"
  | "cash_adjustment"
  | "position_adjustment"
  | "reversal";

export type NormalEventKind = Exclude<EventKind, "reversal">;

export type EventEffects = {
  cash: number;
  position: number;
  income: number;
  expense: number;
  equity: number;
};

export type PaymentMedium =
  | { medium: "cash" }
  | { medium: "position"; positionId: string };

type DatedCommand = { date: string };
type PositiveAmountCommand = DatedCommand & { amount: number };

export type MovePositionCommand = PositiveAmountCommand & {
  type: "move_position";
  positionId: string;
  direction: "cash_to_position" | "position_to_cash";
};

export type NormalSemanticCommand =
  | (PositiveAmountCommand & { type: "open_cash" })
  | (DatedCommand & {
      type: "open_position";
      positionId: string;
      balance: number;
    })
  | (PositiveAmountCommand & {
      type: "record_income";
      categoryId: number;
      note?: string;
    })
  | (PositiveAmountCommand & {
      type: "record_expense";
      categoryId: number;
      budgetPeriodId: number;
      payment: PaymentMedium;
      note?: string;
    })
  | (PositiveAmountCommand & {
      type: "record_refund";
      originalExpense: RecordedLedgerEvent;
      priorRefundTotal: number;
      note?: string;
    })
  | MovePositionCommand
  | (PositiveAmountCommand & {
      type: "adjust_cash";
      direction: "increase" | "decrease";
      note: string;
    })
  | (PositiveAmountCommand & {
      type: "adjust_position";
      positionId: string;
      direction: "increase" | "decrease";
      note: string;
    });

export type LedgerEvent = {
  kind: EventKind;
  amount: number;
  date: string;
  effects: EventEffects;
  positionId: string | null;
  categoryId: number | null;
  budgetPeriodId: number | null;
  relatedEventId: string | null;
  refundPriorTotal: number | null;
  reversalOfEventId: string | null;
  note: string | null;
};

export type RecordedLedgerEvent = LedgerEvent & { id: string };

export type PositionKind =
  | "term_deposit"
  | "personal_receivable"
  | "credit_card"
  | "personal_payable";

export type PositionAction =
  | "fund"
  | "withdraw"
  | "lend"
  | "collect"
  | "pay"
  | "borrow"
  | "repay";
