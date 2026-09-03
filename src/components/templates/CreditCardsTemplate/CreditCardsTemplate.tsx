"use client";

import { useState } from "react";
import { formatVND } from "@/components/atoms/CurrencyDisplay";
import { ConfirmationSheet } from "@/components/organisms/ConfirmationSheet";

export type CardStatement = {
  id: string;
  period_start: string;
  period_end: string;
  status: "unpaid" | "paid";
  paid_at: string | null;
  amount: number;
  purchases: { id: number; amount: number; date: string; note: string | null }[];
};

export type CardGroup = {
  id: string;
  name: string;
  statement_close_day: number;
  statements: CardStatement[];
};

export type FinanceAccount = {
  id: string;
  type: "debt" | "savings";
  name: string;
  debt_direction: "lend" | "borrow" | null;
  note: string | null;
  balance: number;
  transactions: { id: number; amount: number; type: "income" | "expense"; date: string; note: string | null }[];
};

type GroupInput = { name: string; statement_close_day: number };
type MutationResult = Promise<string | null>;
type Mode = "debt" | "savings" | "cards";

export type CreditCardsTemplateProps = {
  groups: CardGroup[];
  accounts: FinanceAccount[];
  groupsLoading?: boolean;
  accountsLoading?: boolean;
  groupsError?: string | null;
  accountsError?: string | null;
  payingStatementId: string | null;
  onRetryGroups?: () => void;
  onRetryAccounts?: () => void;
  onPay: (statementId: string, paidAt: string) => MutationResult;
  onCreateGroup: (input: GroupInput) => MutationResult;
  onUpdateGroup: (id: string, input: GroupInput) => MutationResult;
  onDeleteGroup: (id: string) => MutationResult;
  onUpdateFinanceAccount: (id: string, input: { name: string; note: string }) => MutationResult;
  onDeleteFinanceAccount: (id: string) => MutationResult;
};

const today = () => new Date().toISOString().slice(0, 10);

function signedAmount(type: "income" | "expense", amount: number) {
  return `${type === "expense" ? "−" : "+"}${formatVND(amount)}₫`;
}

function accountMeaning(account: FinanceAccount) {
  if (account.type === "savings") {
    return account.balance > 0
      ? { label: "Đã rút vượt", amount: account.balance }
      : { label: "Đang để dành", amount: -account.balance };
  }
  if (account.debt_direction === "lend") {
    return account.balance > 0
      ? { label: "Đã nhận dư", amount: account.balance }
      : { label: "Còn được nhận", amount: -account.balance };
  }
  return account.balance < 0
    ? { label: "Đã trả dư", amount: -account.balance }
    : { label: "Còn phải trả", amount: account.balance };
}

export function CreditCardsTemplate(props: CreditCardsTemplateProps) {
  const [mode, setMode] = useState<Mode>("debt");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [groupForm, setGroupForm] = useState<CardGroup | "new" | null>(null);
  const [groupName, setGroupName] = useState("");
  const [closeDay, setCloseDay] = useState("15");
  const [editingAccount, setEditingAccount] = useState<FinanceAccount | null>(null);
  const [accountName, setAccountName] = useState("");
  const [accountNote, setAccountNote] = useState("");
  const [pending, setPending] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ kind: "group" | "account"; id: string; name: string } | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<CardStatement | null>(null);
  const [paymentDate, setPaymentDate] = useState(today);

  const debts = props.accounts.filter((account) => account.type === "debt");
  const savings = props.accounts.filter((account) => account.type === "savings");
  const visibleAccounts = mode === "debt" ? debts : savings;
  const accountLoading = props.accountsLoading;
  const accountError = props.accountsError;

  const debtTotals = debts.reduce((totals, account) => {
    const meaning = accountMeaning(account);
    if (meaning.label === "Còn được nhận") totals.receivable += meaning.amount;
    if (meaning.label === "Còn phải trả") totals.payable += meaning.amount;
    return totals;
  }, { receivable: 0, payable: 0 });
  const savingsTotal = savings.reduce((total, account) => total - account.balance, 0);
  const unpaidTotal = props.groups.flatMap((group) => group.statements)
    .filter((statement) => statement.status === "unpaid")
    .reduce((total, statement) => total + statement.amount, 0);

  async function submitGroup(event: React.FormEvent) {
    event.preventDefault();
    const day = Number(closeDay);
    if (!groupName.trim() || !Number.isInteger(day) || day < 1 || day > 31) {
      setMutationError("Nhập tên nhóm và ngày chốt từ 1 đến 31.");
      return;
    }
    setPending(true); setMutationError(null);
    const input = { name: groupName.trim(), statement_close_day: day };
    const error = groupForm === "new"
      ? await props.onCreateGroup(input)
      : await props.onUpdateGroup((groupForm as CardGroup).id, input);
    setPending(false);
    if (error) setMutationError(error);
    else setGroupForm(null);
  }

  async function submitAccount(event: React.FormEvent) {
    event.preventDefault();
    if (!editingAccount || !accountName.trim()) return;
    setPending(true); setMutationError(null);
    const error = await props.onUpdateFinanceAccount(editingAccount.id, { name: accountName.trim(), note: accountNote.trim() });
    setPending(false);
    if (error) setMutationError(error);
    else setEditingAccount(null);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setPending(true); setMutationError(null);
    const error = deleteTarget.kind === "group"
      ? await props.onDeleteGroup(deleteTarget.id)
      : await props.onDeleteFinanceAccount(deleteTarget.id);
    setPending(false);
    if (error) setMutationError(error);
    else setDeleteTarget(null);
  }

  async function confirmPayment() {
    if (!paymentTarget || !paymentDate) return;
    setPending(true); setMutationError(null);
    const error = await props.onPay(paymentTarget.id, paymentDate);
    setPending(false);
    if (error) setMutationError(error);
    else setPaymentTarget(null);
  }

  return (
    <main className="mx-auto min-h-svh w-full max-w-[720px] bg-canvas px-5 pb-section pt-lg">
      <header>
        <p className="font-body text-[13px] text-ink-muted-48">Nợ, tiền gửi và chi thẻ</p>
        <h1 className="mt-xxs font-display text-[28px] font-semibold leading-[33px] text-ink">Tài chính</h1>
      </header>

      <div role="tablist" aria-label="Nội dung tài chính" className="mt-lg grid grid-cols-3 gap-xxs rounded-md bg-canvas-parchment p-xxs">
        {([['debt', 'Nợ'], ['savings', 'Tiền gửi'], ['cards', 'Chi thẻ']] as const).map(([value, label]) => (
          <button key={value} role="tab" aria-selected={mode === value} type="button" onClick={() => { setMode(value); setExpandedId(null); setMutationError(null); }} className={`min-h-11 rounded-sm border font-body text-[15px] font-semibold ${mode === value ? "border-hairline bg-canvas text-primary" : "border-transparent bg-transparent text-ink-muted-48"}`}>
            {label}
          </button>
        ))}
      </div>

      <section className="border-b border-hairline py-xl">
        {(mode === "cards" ? props.groupsLoading || props.groupsError : accountLoading || accountError) ? (
          <><p className="font-body text-[13px] text-ink-muted-48">Số dư</p><p className="mt-xxs font-display text-[21px] font-semibold text-ink-muted-48">Chưa xác định</p></>
        ) : mode === "debt" ? (
          <><p className="font-body text-[13px] text-ink-muted-48">Còn phải trả</p><p className="mt-xxs font-display text-[34px] font-semibold leading-[38px] text-ink">{formatVND(debtTotals.payable)}₫</p>{debtTotals.receivable > 0 ? <p className="mt-xs font-body text-[15px] text-ink-muted-80">Còn được nhận {formatVND(debtTotals.receivable)}₫</p> : null}</>
        ) : mode === "savings" ? (
          <><p className="font-body text-[13px] text-ink-muted-48">{savingsTotal < 0 ? "Đã rút vượt" : "Đang để dành"}</p><p className="mt-xxs font-display text-[34px] font-semibold leading-[38px] text-ink">{formatVND(Math.abs(savingsTotal))}₫</p></>
        ) : (
          <><p className="font-body text-[13px] text-ink-muted-48">Chưa thanh toán</p><p className="mt-xxs font-display text-[34px] font-semibold leading-[38px] text-ink">{formatVND(unpaidTotal)}₫</p><p className="mt-xs font-body text-[15px] text-ink-muted-80">Đã được tính trong chi tiêu.</p></>
        )}
      </section>

      {mutationError ? <p role="alert" className="mt-md rounded-md bg-canvas-parchment p-md font-body text-[15px] text-danger">{mutationError}</p> : null}

      {mode !== "cards" ? (
        <section className="py-lg">
          {accountLoading ? <LoadingState label="Đang tải tài khoản…" /> : accountError ? <ErrorState message={accountError} onRetry={props.onRetryAccounts} /> : visibleAccounts.length === 0 ? <EmptyState>{mode === "debt" ? "Chưa có khoản nợ. Hãy ghi một giao dịch nợ từ Tổng quan để tạo tài khoản ngay trong biểu mẫu." : "Chưa có khoản tiền gửi. Hãy ghi giao dịch tiền gửi từ Tổng quan."}</EmptyState> : (
            <div className="divide-y divide-divider-soft">
              {visibleAccounts.map((account) => {
                const meaning = accountMeaning(account);
                const expanded = expandedId === account.id;
                return <article key={account.id} className="py-md first:pt-0">
                  <button type="button" onClick={() => setExpandedId(expanded ? null : account.id)} aria-expanded={expanded} className="flex min-h-11 w-full items-start justify-between gap-md border-0 bg-transparent text-left">
                    <span className="min-w-0"><span className="block break-words font-body text-[17px] font-semibold text-ink">{account.name}</span><span className="mt-xxs block font-body text-[13px] text-ink-muted-48">{account.type === "debt" ? account.debt_direction === "lend" ? "Cho vay" : "Đi vay" : "Tiền gửi"}{account.note ? ` · ${account.note}` : ""}</span></span>
                    <span className="shrink-0 text-right"><span className="block font-display text-[17px] font-semibold text-ink">{formatVND(meaning.amount)}₫</span><span className="block font-body text-[13px] text-ink-muted-48">{meaning.label}</span></span>
                  </button>
                  {expanded ? <div className="mt-md border-t border-divider-soft pt-md">
                    <p className="font-body text-[13px] font-semibold uppercase tracking-[0.5px] text-ink-muted-48">Lịch sử dòng tiền</p>
                    {account.transactions.length === 0 ? <p className="mt-sm font-body text-[15px] text-ink-muted-48">Tài khoản đã tạo nhưng chưa có giao dịch.</p> : account.transactions.map((transaction) => <div key={transaction.id} className="flex justify-between gap-sm border-b border-divider-soft py-sm last:border-0"><span className="min-w-0"><span className="block break-words font-body text-[15px] text-ink">{transaction.note || "Giao dịch"}</span><span className="font-body text-[13px] text-ink-muted-48">{transaction.date}</span></span><span className={`shrink-0 font-body text-[15px] font-semibold ${transaction.type === "expense" ? "text-danger" : "text-success"}`}>{signedAmount(transaction.type, transaction.amount)}</span></div>)}
                    <div className="mt-md flex gap-xs"><button type="button" onClick={() => { setEditingAccount(account); setAccountName(account.name); setAccountNote(account.note ?? ""); setMutationError(null); }} className="min-h-11 rounded-sm border border-hairline bg-canvas px-md font-body text-[15px] text-primary">Sửa thông tin</button><button type="button" onClick={() => setDeleteTarget({ kind: "account", id: account.id, name: account.name })} className="min-h-11 rounded-sm border border-hairline bg-canvas px-md font-body text-[15px] text-danger">Xóa</button></div>
                  </div> : null}
                </article>;
              })}
            </div>
          )}
        </section>
      ) : (
        <section className="py-lg">
          <div className="flex items-center justify-between gap-md"><h2 className="font-display text-[21px] font-semibold text-ink">Nhóm thẻ</h2><button type="button" onClick={() => { setGroupForm("new"); setGroupName(""); setCloseDay("15"); setMutationError(null); }} className="min-h-11 rounded-pill border border-primary bg-canvas px-md font-body text-[15px] text-primary">Thêm nhóm thẻ</button></div>
          {props.groupsLoading ? <LoadingState label="Đang tải nhóm thẻ…" /> : props.groupsError ? <ErrorState message={props.groupsError} onRetry={props.onRetryGroups} /> : props.groups.length === 0 ? <EmptyState>Chưa có nhóm thẻ. Tạo một nhóm để theo dõi kỳ sao kê.</EmptyState> : <div className="mt-md divide-y divide-divider-soft">{props.groups.map((group) => {
            const unpaid = group.statements.filter((statement) => statement.status === "unpaid").reduce((sum, statement) => sum + statement.amount, 0);
            const expanded = expandedId === group.id;
            return <article key={group.id} className="py-md first:pt-0"><button type="button" onClick={() => setExpandedId(expanded ? null : group.id)} aria-expanded={expanded} className="flex min-h-11 w-full items-start justify-between gap-md border-0 bg-transparent text-left"><span><span className="block font-body text-[17px] font-semibold text-ink">{group.name}</span><span className="font-body text-[13px] text-ink-muted-48">Chốt ngày {group.statement_close_day}</span></span><span className="text-right"><span className="block font-display text-[17px] font-semibold text-ink">{formatVND(unpaid)}₫</span><span className="font-body text-[13px] text-ink-muted-48">Chưa thanh toán</span></span></button>{expanded ? <div className="mt-md border-t border-divider-soft pt-md">{group.statements.length === 0 ? <p className="font-body text-[15px] text-ink-muted-48">Nhóm thẻ chưa có giao dịch hoặc sao kê.</p> : group.statements.map((statement) => <div key={statement.id} className="border-b border-divider-soft py-sm last:border-0"><div className="flex justify-between gap-sm"><span><span className="block font-body text-[15px] font-semibold text-ink">{statement.period_start} đến {statement.period_end}</span><span className="font-body text-[13px] text-ink-muted-48">{statement.status === "paid" ? `Đã thanh toán ${statement.paid_at}` : `${statement.purchases.length} giao dịch`}</span></span><span className="font-body text-[15px] font-semibold text-ink">{formatVND(statement.amount)}₫</span></div>{statement.purchases.length > 0 ? <div className="mt-sm divide-y divide-divider-soft">{statement.purchases.map((purchase) => <div key={purchase.id} className="flex justify-between gap-sm py-xs font-body text-[13px]"><span className="min-w-0"><span className="block break-words text-ink">{purchase.note || "Giao dịch thẻ"}</span><span className="text-ink-muted-48">{purchase.date}</span></span><span className="shrink-0 text-ink">{formatVND(purchase.amount)}₫</span></div>)}</div> : null}{statement.status === "unpaid" ? <button type="button" onClick={() => { setPaymentTarget(statement); setPaymentDate(today()); setMutationError(null); }} disabled={props.payingStatementId === statement.id} className="mt-sm min-h-11 rounded-sm border border-primary bg-canvas px-md font-body text-[15px] text-primary disabled:opacity-60">Ghi nhận đã thanh toán</button> : null}</div>)}<div className="mt-md flex gap-xs"><button type="button" onClick={() => { setGroupForm(group); setGroupName(group.name); setCloseDay(String(group.statement_close_day)); setMutationError(null); }} className="min-h-11 rounded-sm border border-hairline bg-canvas px-md font-body text-[15px] text-primary">Sửa nhóm</button><button type="button" onClick={() => setDeleteTarget({ kind: "group", id: group.id, name: group.name })} className="min-h-11 rounded-sm border border-hairline bg-canvas px-md font-body text-[15px] text-danger">Xóa nhóm</button></div></div> : null}</article>;
          })}</div>}
        </section>
      )}

      {groupForm ? <form onSubmit={submitGroup} className="fixed inset-x-0 bottom-0 z-[70] rounded-t-2xl border-t border-hairline bg-canvas px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-lg"><h2 className="font-display text-[21px] font-semibold text-ink">{groupForm === "new" ? "Nhóm thẻ mới" : "Sửa nhóm thẻ"}</h2><label className="mt-md block font-body text-[15px] text-ink">Tên nhóm<input value={groupName} onChange={(event) => setGroupName(event.target.value)} className="mt-xs min-h-11 w-full rounded-md border border-hairline bg-surface-pearl px-md text-[17px]" /></label><label className="mt-md block font-body text-[15px] text-ink">Ngày chốt<input value={closeDay} onChange={(event) => setCloseDay(event.target.value)} inputMode="numeric" className="mt-xs min-h-11 w-full rounded-md border border-hairline bg-surface-pearl px-md text-[17px]" /></label>{groupForm !== "new" ? <p className="mt-xs font-body text-[13px] text-ink-muted-48">Ngày chốt mới chỉ áp dụng cho các kỳ được tạo sau thay đổi này.</p> : null}<div className="mt-lg flex gap-xs"><button type="button" onClick={() => setGroupForm(null)} className="min-h-11 flex-1 rounded-md border border-hairline bg-canvas text-ink">Hủy</button><button type="submit" disabled={pending} className="min-h-11 flex-[2] rounded-md border-0 bg-primary text-on-primary disabled:opacity-60">{pending ? "Đang lưu…" : "Lưu"}</button></div></form> : null}

      {editingAccount ? <form onSubmit={submitAccount} className="fixed inset-x-0 bottom-0 z-[70] rounded-t-2xl border-t border-hairline bg-canvas px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-lg"><h2 className="font-display text-[21px] font-semibold text-ink">Sửa thông tin</h2><label className="mt-md block font-body text-[15px] text-ink">Tên<input value={accountName} onChange={(event) => setAccountName(event.target.value)} className="mt-xs min-h-11 w-full rounded-md border border-hairline bg-surface-pearl px-md text-[17px]" /></label><label className="mt-md block font-body text-[15px] text-ink">Ghi chú<input value={accountNote} onChange={(event) => setAccountNote(event.target.value)} className="mt-xs min-h-11 w-full rounded-md border border-hairline bg-surface-pearl px-md text-[17px]" /></label><div className="mt-lg flex gap-xs"><button type="button" onClick={() => setEditingAccount(null)} className="min-h-11 flex-1 rounded-md border border-hairline bg-canvas">Hủy</button><button type="submit" disabled={pending} className="min-h-11 flex-[2] rounded-md border-0 bg-primary text-on-primary disabled:opacity-60">{pending ? "Đang lưu…" : "Lưu"}</button></div></form> : null}

      {paymentTarget ? <div className="fixed inset-x-0 bottom-0 z-[70] rounded-t-2xl border-t border-hairline bg-canvas px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-lg"><h2 className="font-display text-[21px] font-semibold text-ink">Ghi nhận thanh toán</h2><p className="mt-xs font-body text-[15px] text-ink-muted-80">Thao tác này chỉ cập nhật trạng thái sao kê {formatVND(paymentTarget.amount)}₫. Không tạo thêm chi phí hoặc thay đổi ngân sách cũ.</p><label className="mt-md block font-body text-[15px] text-ink">Ngày thanh toán<input type="date" max={today()} value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} className="mt-xs min-h-11 w-full rounded-md border border-hairline bg-surface-pearl px-md text-[17px]" /></label><div className="mt-lg flex gap-xs"><button type="button" onClick={() => setPaymentTarget(null)} className="min-h-11 flex-1 rounded-md border border-hairline bg-canvas">Hủy</button><button type="button" onClick={confirmPayment} disabled={pending || !paymentDate} className="min-h-11 flex-[2] rounded-md border-0 bg-primary text-on-primary disabled:opacity-60">{pending ? "Đang lưu…" : "Xác nhận"}</button></div></div> : null}

      <ConfirmationSheet open={Boolean(deleteTarget)} title={deleteTarget ? `Xóa “${deleteTarget.name}”?` : "Xóa?"} consequence={deleteTarget?.kind === "group" ? "Chỉ có thể xóa nhóm chưa có giao dịch. Không thể hoàn tác thao tác này." : "Chỉ có thể xóa tài khoản chưa có giao dịch. Không thể hoàn tác thao tác này."} confirmLabel="Xóa" pending={pending} pendingLabel="Đang xóa…" error={deleteTarget ? mutationError : null} onConfirm={confirmDelete} onCancel={() => { setDeleteTarget(null); setMutationError(null); }} />
    </main>
  );
}

function LoadingState({ label }: { label: string }) {
  return <div role="status" className="mt-lg"><p className="font-body text-[15px] text-ink-muted-48">{label}</p><div className="mt-sm h-24 animate-pulse rounded-md bg-divider-soft" /></div>;
}

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div role="alert" className="mt-lg"><p className="font-body text-[15px] text-danger">{message}</p>{onRetry ? <button type="button" onClick={onRetry} className="mt-sm min-h-11 rounded-sm border border-primary bg-canvas px-md font-body text-[15px] text-primary">Thử lại</button> : null}</div>;
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="mt-lg rounded-md bg-canvas-parchment p-lg font-body text-[15px] leading-[21px] text-ink-muted-80">{children}</p>;
}
