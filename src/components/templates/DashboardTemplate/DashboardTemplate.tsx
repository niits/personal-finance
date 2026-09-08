"use client";

import { useState } from "react";
import { TransactionForm } from "@/components/organisms/TransactionForm";
import { OrganizeReviewSheet } from "@/components/organisms/OrganizeReviewSheet";
import type { OrganizePreview, OrganizeSelection } from "@/components/organisms/OrganizeReviewSheet";

export type DashboardData = {
  month: string;
  period_start: string;
  period_end: string;
  total_expense: number;
  unpaid_card_spend: number;
  total_income: number;
  savings: number;
  monthly_budget: { id: number; amount: number; remaining: number } | null;
  days_in_period: number;
  days_elapsed: number;
  days_remaining: number;
  pace_status: "under" | "over" | "no_budget";
  daily_expenses: { date: string; amount: number }[];
};

export type Transaction = {
  id: number;
  amount: number;
  linked_amount: number | null;
  type: "expense" | "income";
  emoji: string | null;
  category: { id: number; name: string; emoji: string | null; path: string } | null;
  root_category_name: string;
  debt_id: string | null;
  finance_account_id: string | null;
  credit_card_group_id: string | null;
  debt_party: string | null;
  debt_type: "lend" | "borrow" | null;
  note: string | null;
  date: string;
  custom_budgets: { id: number; name: string }[];
  created_at: number;
  updated_at: number;
};

export type DashboardTemplateProps = {
  data: DashboardData | null;
  transactions: Transaction[];
  loading: boolean;
  selectedMonth: string;
  currentMonth: string;
  deleting: boolean;
  actionTxn: Transaction | null;
  formOpen: boolean;
  editTxn: Transaction | undefined;
  onSelectMonth: (month: string) => void;
  onSetActionTxn: (txn: Transaction | null) => void;
  onOpenForm: (txn?: Transaction) => void;
  onCloseForm: () => void;
  onSaved: () => void;
  onDelete: (txn: Transaction) => void;
  organizeState: "idle" | "loading" | "review" | "applying";
  organizePreview: OrganizePreview | null;
  onOrganize: () => void;
  onOrganizeApply: (selection: OrganizeSelection) => void;
  onOrganizeClose: () => void;
  summaryError?: string | null;
  ledgerError?: string | null;
  deleteError?: string | null;
  onRetrySummary?: () => void;
  onRetryLedger?: () => void;
};

const vndFormatter = new Intl.NumberFormat("vi-VN");
const WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function formatVND(amount: number) {
  return `${vndFormatter.format(amount)}₫`;
}

function formatMonth(value: string) {
  const [year, month] = value.split("-");
  return `Tháng ${Number(month)}/${year}`;
}

function recentMonths(current: string, count = 24): string[] {
  const [year, month] = current.split("-").map(Number);
  const months: string[] = [];
  for (let index = 0; index < count; index++) {
    const date = new Date(year, month - 1 - index, 1);
    months.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

function formatDateHeader(value: string) {
  const today = new Date();
  const todayValue = today.toISOString().substring(0, 10);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (value === todayValue) return "Hôm nay";
  if (value === yesterday.toISOString().substring(0, 10)) return "Hôm qua";
  const date = new Date(`${value}T00:00:00`);
  return `${WEEKDAYS[date.getDay()]}, ${date.getDate()}/${date.getMonth() + 1}`;
}

function groupByDate(transactions: Transaction[]) {
  const groups: Record<string, Transaction[]> = {};
  for (const transaction of transactions) {
    (groups[transaction.date] ??= []).push(transaction);
  }
  return groups;
}

function transactionName(transaction: Transaction) {
  return transaction.note?.trim() || transaction.category?.name || "Khoản nợ";
}

function TransactionIcon({ transaction }: { transaction: Transaction }) {
  const displayEmoji = transaction.emoji ?? transaction.category?.emoji;
  return (
    <span
      aria-hidden="true"
      className={`flex size-8 shrink-0 items-center justify-center rounded-full bg-canvas-parchment ${displayEmoji ? "text-[17px]" : "font-display text-sm font-semibold"}`}
    >
      {displayEmoji ?? (transaction.category?.name || "G").charAt(0).toUpperCase()}
    </span>
  );
}

function RetryMessage({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-md border border-hairline bg-surface-pearl p-md">
      <p className="font-body text-sm text-ink">{message}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="mt-xs min-h-11 border-none bg-transparent font-body text-sm font-semibold text-primary">
          Thử lại
        </button>
      ) : null}
    </div>
  );
}

export function DashboardTemplate({
  data,
  transactions,
  loading,
  selectedMonth,
  currentMonth,
  deleting,
  actionTxn,
  formOpen,
  editTxn,
  onSelectMonth,
  onSetActionTxn,
  onOpenForm,
  onCloseForm,
  onSaved,
  onDelete,
  organizeState,
  organizePreview,
  onOrganize,
  onOrganizeApply,
  onOrganizeClose,
  summaryError,
  ledgerError,
  deleteError,
  onRetrySummary,
  onRetryLedger,
}: DashboardTemplateProps) {
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<number | null>(null);
  const organizeBusy = organizeState === "loading" || organizeState === "applying";
  const isCurrentMonth = selectedMonth === currentMonth;
  const months = recentMonths(currentMonth);
  const groups = groupByDate(transactions);
  const dates = Object.keys(groups).toSorted((a, b) => b.localeCompare(a));
  const budget = data?.monthly_budget;
  const isOverBudget = Boolean(budget && budget.remaining < 0);
  const budgetPercent = data && budget
    ? Math.min(Math.max((data.total_expense / budget.amount) * 100, 0), 100)
    : 0;
  const confirmingDelete = Boolean(actionTxn && deleteConfirmationId === actionTxn.id);

  function closeActionSheet() {
    if (deleting) return;
    setDeleteConfirmationId(null);
    onSetActionTxn(null);
  }

  return (
    <div className="min-h-[calc(100svh-44px-72px)] bg-canvas-parchment pb-lg">
      <div className="mx-auto w-full max-w-[720px]">
        <div className="sticky top-0 z-40 border-b border-hairline bg-canvas">
          <div className="mx-auto w-full max-w-[720px] px-5 pt-xs">
            <div className="flex min-h-11 items-center justify-between gap-sm">
              <div className="relative inline-flex items-center">
                <select
                  aria-label="Chọn tháng"
                  value={selectedMonth}
                  onChange={(event) => onSelectMonth(event.target.value)}
                  className="min-h-11 appearance-none border-none bg-transparent py-0 pr-md font-display text-[21px] font-semibold text-ink"
                >
                  {months.map((month) => (
                    <option key={month} value={month}>{formatMonth(month)}</option>
                  ))}
                </select>
                <span aria-hidden="true" className="pointer-events-none absolute right-xs font-body text-xs text-ink-muted-48">▾</span>
              </div>
              {isCurrentMonth ? (
                <button
                  type="button"
                  onClick={onOrganize}
                  disabled={organizeState !== "idle"}
                  aria-label="AI sắp xếp"
                  aria-busy={organizeBusy}
                  className="min-h-11 rounded-pill border border-primary bg-transparent px-md font-body text-xs font-semibold text-primary disabled:opacity-50"
                >
                  {organizeBusy ? "Đang tổ chức…" : "AI sắp xếp ✦"}
                </button>
              ) : null}
            </div>
          </div>
          <section aria-labelledby="monthly-outcome" className="mx-auto w-full max-w-[720px] px-5 pb-md pt-xs">
            {summaryError && !data ? (
              <RetryMessage message={summaryError} onRetry={onRetrySummary} />
            ) : (
              <>
                {summaryError ? <div className="mb-sm"><RetryMessage message={summaryError} onRetry={onRetrySummary} /></div> : null}
                <p className="whitespace-nowrap font-display text-[34px] font-semibold leading-[38px] tracking-[-0.5px] text-ink tabular-nums max-[374px]:text-[28px]">
                  {loading && !data ? "—" : formatVND(data?.total_expense ?? 0)}
                </p>
                {budget ? (
                  <>
                    <p id="monthly-outcome" className="mt-xxs font-body text-sm text-ink-muted-48">
                      Đã tiêu dùng · hạn mức <span className="font-semibold text-ink">{formatVND(budget.amount)}</span>
                    </p>
                    <div className="mt-sm h-1 overflow-hidden rounded-pill bg-hairline" role="progressbar" aria-label={`Đã dùng ${Math.round(budgetPercent)}% ngân sách`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(budgetPercent)}>
                      <div className="flex h-full" style={{ width: `${budgetPercent}%` }}>
                        <div className={`h-full ${isOverBudget ? "bg-danger" : "bg-primary"}`} style={{ flex: Math.max((data?.total_expense ?? 0) - (data?.unpaid_card_spend ?? 0), 0) }} />
                        {(data?.unpaid_card_spend ?? 0) > 0 ? <div className="h-full bg-warning" style={{ flex: data?.unpaid_card_spend }} /> : null}
                      </div>
                    </div>
                    {isOverBudget ? (
                      <p className="mt-xs font-body text-sm font-semibold text-danger">Vượt hạn mức kỳ này</p>
                    ) : null}
                  </>
                ) : data ? (
                  <p id="monthly-outcome" className="mt-xxs font-body text-sm text-ink-muted-80">
                    Chưa có ngân sách kỳ này — <a href="/budget" className="font-semibold text-primary">tạo ngay</a>
                  </p>
                ) : (
                  <p id="monthly-outcome" className="mt-xxs font-body text-sm text-ink-muted-48">Đang tải tổng quan kỳ này…</p>
                )}
                {data && data.unpaid_card_spend > 0 ? (
                  <p className="mt-sm font-body text-sm text-ink-muted-80">
                    Dư nợ thẻ tín dụng <span className="font-semibold text-ink">{formatVND(data.unpaid_card_spend)}</span>
                  </p>
                ) : null}
              </>
            )}
          </section>
        </div>

        <section aria-labelledby="transaction-ledger" className="pt-lg">
          <h2 id="transaction-ledger" className="px-5 pb-sm font-display text-[21px] font-semibold text-ink">Giao dịch</h2>
          {ledgerError ? <div className="mx-5 mb-md"><RetryMessage message={ledgerError} onRetry={onRetryLedger} /></div> : null}
          {loading && transactions.length === 0 ? (
            <div className="bg-canvas px-5 py-xxl font-body text-sm text-ink-muted-48">Đang tải giao dịch…</div>
          ) : transactions.length === 0 && !ledgerError ? (
            <div className="bg-canvas px-5 py-xl text-center">
              <p className="font-body text-sm text-ink-muted-48">Chưa có giao dịch trong kỳ này</p>
            </div>
          ) : (
            <div className="bg-canvas">
              {dates.map((date, dateIndex) => (
                <div key={date} className={dateIndex > 0 ? "border-t border-hairline" : undefined}>
                  <div className="flex items-baseline justify-between gap-sm bg-canvas-parchment px-5 py-xs">
                    <h3 className="font-body text-sm font-semibold text-ink">{formatDateHeader(date)}</h3>
                    <p className="font-body text-xs text-ink-muted-48 tabular-nums">
                      {formatVND(groups[date].reduce((total, transaction) => total + (transaction.type === "expense" ? -transaction.amount : transaction.amount), 0))}
                    </p>
                  </div>
                  {groups[date].map((transaction, index) => {
                    const name = transactionName(transaction);
                    const context = transaction.category?.path ?? (transaction.debt_party ? `${transaction.debt_type === "lend" ? "Cho vay" : "Đi vay"} · ${transaction.debt_party}` : "Giao dịch tài chính");
                    return (
                      <button
                        type="button"
                        key={transaction.id}
                        onClick={() => onSetActionTxn(transaction)}
                        aria-label={`${name}, ${transaction.type === "expense" ? "chi" : "thu"} ${formatVND(transaction.amount)}, ${formatDateHeader(transaction.date)}`}
                        className={`flex min-h-11 w-full items-center gap-sm border-x-0 border-b-0 bg-canvas px-5 py-sm text-left ${index > 0 ? "border-t border-hairline" : "border-t-0"}`}
                      >
                        <TransactionIcon transaction={transaction} />
                        <span className="min-w-0 flex-1">
                          <span className="block whitespace-normal break-words font-body text-[15px] text-ink">{name}</span>
                          <span className="mt-xxs block whitespace-normal break-words font-body text-xs text-ink-muted-48">{context}</span>
                          {transaction.custom_budgets.length > 0 ? (
                            <span className="mt-xxs block font-body text-xs text-primary">{transaction.custom_budgets.map((budgetItem) => budgetItem.name).join(" · ")}</span>
                          ) : null}
                        </span>
                        <span className={`shrink-0 whitespace-nowrap font-display text-[15px] font-semibold tabular-nums ${transaction.type === "expense" ? "text-danger" : "text-success"}`}>
                          {transaction.type === "expense" ? "−" : "+"}{formatVND(transaction.amount)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="pointer-events-none fixed inset-0 z-50">
        <div className="mx-auto flex h-full w-full max-w-[720px] items-end justify-end px-5 pb-[calc(72px+env(safe-area-inset-bottom)+16px)]">
          <button
            type="button"
            onClick={() => onOpenForm()}
            aria-label="Ghi giao dịch"
            className="pointer-events-auto flex size-11 items-center justify-center rounded-full border-none bg-primary text-on-primary transition-transform active:scale-95"
          >
            <svg viewBox="0 0 24 24" fill="none" className="size-lg stroke-current" aria-hidden="true">
              <path d="M12 5v14M5 12h14" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {actionTxn ? (
        <div className="fixed inset-0 z-[300] flex items-end justify-center" role="dialog" aria-modal="true" aria-labelledby="transaction-action-title">
          <button type="button" aria-label="Đóng" onClick={closeActionSheet} disabled={deleting} className="absolute inset-0 border-none bg-surface-black/50" />
          <div className="relative w-full max-w-[560px] rounded-t-[24px] bg-canvas pb-[max(var(--space-lg),env(safe-area-inset-bottom))] shadow-xl">
            <div className="flex justify-end px-md pt-sm">
              <button type="button" onClick={closeActionSheet} disabled={deleting} aria-label="Đóng bảng thao tác" className="flex size-11 items-center justify-center rounded-full border-none bg-canvas-parchment font-body text-[20px] text-ink">×</button>
            </div>
            {confirmingDelete ? (
              <div className="px-5 pb-md">
                <h2 id="transaction-action-title" className="font-display text-[21px] font-semibold text-ink">Xoá “{transactionName(actionTxn)}”?</h2>
                <p className="mt-xs font-display text-[17px] font-semibold text-ink tabular-nums">{actionTxn.type === "expense" ? "−" : "+"}{formatVND(actionTxn.amount)}</p>
                <p className="mt-sm font-body text-sm text-ink-muted-80">Giao dịch sẽ bị xoá khỏi sổ và các tổng liên quan. Thao tác này không thể hoàn tác.</p>
                {deleteError ? <p role="alert" className="mt-sm font-body text-sm font-semibold text-danger">{deleteError}</p> : null}
                <div className="mt-lg flex gap-sm max-[374px]:flex-col">
                  <button type="button" onClick={() => setDeleteConfirmationId(null)} disabled={deleting} className="min-h-11 flex-1 rounded-md border border-hairline bg-canvas font-body text-[17px] font-semibold text-ink disabled:opacity-50">Huỷ</button>
                  <button type="button" onClick={() => onDelete(actionTxn)} disabled={deleting} aria-label="Xác nhận xoá" className="min-h-11 flex-1 rounded-md border-none bg-danger font-body text-[17px] font-semibold text-on-primary disabled:opacity-60">
                    {deleting ? "Đang xoá…" : "Xác nhận xoá"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="px-5 pb-md">
                <p className="font-body text-sm text-ink-muted-48">{actionTxn.category?.path ?? "Giao dịch tài chính"}</p>
                <h2 id="transaction-action-title" className="mt-xxs whitespace-normal break-words font-display text-[21px] font-semibold text-ink">{transactionName(actionTxn)}</h2>
                <p className={`mt-xs font-display text-[24px] font-semibold tabular-nums ${actionTxn.type === "expense" ? "text-danger" : "text-success"}`}>
                  {actionTxn.type === "expense" ? "−" : "+"}{formatVND(actionTxn.amount)}
                </p>
                <div className="mt-lg flex flex-col gap-sm">
                  <button type="button" onClick={() => { onOpenForm(actionTxn); closeActionSheet(); }} className="min-h-11 w-full rounded-md border-none bg-primary font-body text-[17px] font-semibold text-on-primary">Sửa giao dịch</button>
                  <button type="button" onClick={() => setDeleteConfirmationId(actionTxn.id)} className="min-h-11 w-full rounded-md border border-hairline bg-canvas font-body text-[17px] font-semibold text-ink">Xoá</button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      <TransactionForm
        key={editTxn?.id ?? "create"}
        open={formOpen}
        onClose={onCloseForm}
        onSaved={onSaved}
        mode={editTxn ? {
          kind: "edit",
          transaction: {
            id: editTxn.id,
            amount: editTxn.amount,
            linked_amount: editTxn.linked_amount,
            type: editTxn.type,
            emoji: editTxn.emoji,
            category: editTxn.category,
            debt_id: editTxn.debt_id,
            finance_account_id: editTxn.finance_account_id,
            credit_card_group_id: editTxn.credit_card_group_id,
            debt_party: editTxn.debt_party,
            debt_type: editTxn.debt_type,
            is_opening_tx: false,
            note: editTxn.note,
            date: editTxn.date,
            custom_budgets: editTxn.custom_budgets,
          },
        } : { kind: "create" }}
      />

      <OrganizeReviewSheet
        open={organizeState === "review" || organizeState === "applying"}
        preview={organizePreview}
        applying={organizeState === "applying"}
        onApply={onOrganizeApply}
        onClose={onOrganizeClose}
      />
    </div>
  );
}
