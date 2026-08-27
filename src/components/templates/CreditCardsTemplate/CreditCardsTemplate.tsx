"use client";

import { useState } from "react";
import { formatVND } from "@/components/atoms/CurrencyDisplay";

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
type FinanceAccountInput = { type: "debt" | "savings"; name: string; note: string; debt_direction?: "lend" | "borrow" };
type FinanceAccountUpdate = Pick<FinanceAccountInput, "name" | "note">;

type CreditCardsTemplateProps = {
  groups: CardGroup[];
  accounts: FinanceAccount[];
  payingStatementId: string | null;
  onPay: (statementId: string, paidAt: string) => void;
  onCreateGroup: (input: GroupInput) => void;
  onUpdateGroup: (id: string, input: GroupInput) => void;
  onDeleteGroup: (id: string) => void;
  onCreateFinanceAccount: (input: FinanceAccountInput) => Promise<string | null>;
  onUpdateFinanceAccount: (id: string, input: FinanceAccountUpdate) => Promise<string | null>;
  onDeleteFinanceAccount: (id: string) => Promise<string | null>;
};

export function CreditCardsTemplate({ groups, accounts, payingStatementId, onPay, onCreateGroup, onUpdateGroup, onDeleteGroup, onCreateFinanceAccount, onUpdateFinanceAccount, onDeleteFinanceAccount }: CreditCardsTemplateProps) {
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState("");
  const [closeDay, setCloseDay] = useState("15");
  const [paymentDates, setPaymentDates] = useState<Record<string, string>>({});
  const [accountFormType, setAccountFormType] = useState<"debt" | "savings" | null>(null);
  const [editingAccount, setEditingAccount] = useState<FinanceAccount | null>(null);
  const [accountName, setAccountName] = useState("");
  const [accountNote, setAccountNote] = useState("");
  const [debtDirection, setDebtDirection] = useState<"lend" | "borrow">("borrow");
  const [accountError, setAccountError] = useState<string | null>(null);
  const [savingAccount, setSavingAccount] = useState(false);

  const debts = accounts.filter((account) => account.type === "debt");
  const savings = accounts.filter((account) => account.type === "savings");

  function resetAccountForm() {
    setAccountFormType(null); setEditingAccount(null); setAccountName(""); setAccountNote(""); setDebtDirection("borrow"); setAccountError(null);
  }

  function beginAccountCreate(type: "debt" | "savings") {
    resetAccountForm(); setAccountFormType(type);
  }

  function beginAccountEdit(account: FinanceAccount) {
    setAccountFormType(account.type); setEditingAccount(account); setAccountName(account.name); setAccountNote(account.note ?? ""); setDebtDirection(account.debt_direction ?? "borrow"); setAccountError(null);
  }

  function submitGroup(event: React.FormEvent) {
    event.preventDefault();
    const statementCloseDay = Number(closeDay);
    if (!groupName.trim() || !Number.isInteger(statementCloseDay) || statementCloseDay < 1 || statementCloseDay > 31) return;
    const input = { name: groupName.trim(), statement_close_day: statementCloseDay };
    if (editingGroupId) onUpdateGroup(editingGroupId, input);
    else onCreateGroup(input);
    setGroupName(""); setCloseDay("15"); setEditingGroupId(null); setShowGroupForm(false);
  }

  async function submitAccount(event: React.FormEvent) {
    event.preventDefault();
    if (!accountFormType || !accountName.trim()) return;
    setSavingAccount(true); setAccountError(null);
    const error = editingAccount
      ? await onUpdateFinanceAccount(editingAccount.id, { name: accountName.trim(), note: accountNote })
      : await onCreateFinanceAccount({ type: accountFormType, name: accountName.trim(), note: accountNote, ...(accountFormType === "debt" ? { debt_direction: debtDirection } : {}) });
    setSavingAccount(false);
    if (error) setAccountError(error);
    else resetAccountForm();
  }

  async function deleteAccount(account: FinanceAccount) {
    if (!window.confirm(`Xóa tài khoản “${account.name}”?`)) return;
    setAccountError(null);
    const error = await onDeleteFinanceAccount(account.id);
    if (error) setAccountError(error);
  }

  return (
    <main className="min-h-dvh bg-canvas-parchment pb-24">
      <section className="bg-canvas px-5 py-12 text-center sm:px-8">
        <p className="m-0 font-body text-sm text-ink-muted-48">Quản lý dòng tiền</p>
        <h1 className="mt-2 font-display text-[40px] font-semibold tracking-[-0.5px] text-ink">Tài chính</h1>
        <p className="mx-auto mt-3 max-w-xl font-body text-[17px] text-ink-muted-80">Theo dõi thẻ, các khoản nợ và mục tiêu tiết kiệm ở một nơi.</p>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
        <div className="flex items-end justify-between gap-md"><div><p className="m-0 font-body text-xs font-semibold uppercase tracking-[0.5px] text-ink-muted-48">Thanh toán</p><h2 className="mt-1 font-display text-[28px] font-semibold tracking-[-0.3px] text-ink">Nhóm thẻ</h2></div><button type="button" onClick={() => { setEditingGroupId(null); setGroupName(""); setCloseDay("15"); setShowGroupForm((shown) => !shown); }} className="min-h-11 rounded-pill border-none bg-primary px-[22px] font-body text-[17px] text-on-primary">{showGroupForm && !editingGroupId ? "Đóng" : "Thêm nhóm"}</button></div>
        <p className="mt-xs font-body text-sm text-ink-muted-48">Mỗi nhóm có một ngày chốt sao kê.</p>

        {showGroupForm && <form className="mt-lg rounded-lg border border-hairline bg-canvas p-lg" onSubmit={submitGroup}><h3 className="font-display text-[21px] font-semibold tracking-[-0.2px] text-ink">{editingGroupId ? "Sửa nhóm thẻ" : "Nhóm thẻ mới"}</h3><div className="mt-md grid gap-sm sm:grid-cols-[1fr_140px]"><label className="font-body text-sm text-ink">Tên nhóm<input aria-label="Tên nhóm thẻ" value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="Ví dụ: Chi tiêu gia đình" className="mt-xs min-h-11 w-full rounded-sm border border-hairline bg-canvas-parchment px-sm font-body text-[17px] text-ink" /></label><label className="font-body text-sm text-ink">Ngày chốt<input aria-label="Ngày chốt sao kê" value={closeDay} onChange={(event) => setCloseDay(event.target.value)} inputMode="numeric" className="mt-xs min-h-11 w-full rounded-sm border border-hairline bg-canvas-parchment px-sm font-body text-[17px] text-ink" /></label></div><div className="mt-lg flex gap-sm"><button type="submit" className="min-h-11 rounded-pill border-none bg-primary px-[22px] font-body text-[17px] text-on-primary">{editingGroupId ? "Lưu" : "Tạo nhóm"}</button><button type="button" onClick={() => { setShowGroupForm(false); setEditingGroupId(null); }} className="min-h-11 rounded-pill border border-primary bg-canvas px-[22px] font-body text-[17px] text-primary">Hủy</button></div></form>}

        <div className="mt-lg">{groups.length === 0 ? <p className="text-center font-body text-[17px] text-ink-muted-48">Chưa có nhóm thẻ nào.</p> : groups.map((group) => <article key={group.id} className="mb-lg rounded-lg border border-hairline bg-canvas p-lg"><div className="flex items-start justify-between gap-md"><div><h3 className="font-body text-[21px] font-semibold tracking-[-0.2px] text-ink">{group.name}</h3><p className="mt-xs font-body text-sm text-ink-muted-48">Chốt sao kê ngày {group.statement_close_day}</p></div><div className="flex shrink-0 gap-sm"><button type="button" onClick={() => { setEditingGroupId(group.id); setGroupName(group.name); setCloseDay(String(group.statement_close_day)); setShowGroupForm(true); }} className="min-h-11 rounded-pill border border-primary bg-canvas px-sm font-body text-sm text-primary">Sửa</button><button type="button" onClick={() => { if (window.confirm(`Xóa nhóm “${group.name}”?`)) onDeleteGroup(group.id); }} className="min-h-11 rounded-pill border border-hairline bg-canvas px-sm font-body text-sm text-ink">Xóa</button></div></div><div className="mt-lg border-t border-hairline pt-md"><h4 className="font-body text-sm font-semibold uppercase tracking-[0.5px] text-ink-muted-48">Sao kê</h4>{group.statements.length === 0 ? <p className="mt-sm font-body text-sm text-ink-muted-48">Chưa có sao kê.</p> : group.statements.map((statement) => <div key={statement.id} className="mt-md border-t border-hairline pt-sm first:border-t-0 first:pt-0"><div className="flex flex-wrap items-center justify-between gap-sm"><div><p className="font-body text-[17px] font-semibold text-ink">{formatVND(statement.amount)}₫</p><p className="mt-1 font-body text-xs text-ink-muted-48">{statement.period_start} đến {statement.period_end}</p></div>{statement.status === "paid" ? <span className="font-body text-sm text-ink-muted-48">Đã thanh toán {statement.paid_at}</span> : <div className="flex items-center gap-xs"><input aria-label={`Ngày thanh toán ${statement.id}`} type="date" value={paymentDates[statement.id] ?? ""} onChange={(event) => setPaymentDates((current) => ({ ...current, [statement.id]: event.target.value }))} className="min-h-11 rounded-sm border border-hairline px-xs font-body text-sm" /><button type="button" disabled={payingStatementId === statement.id || !paymentDates[statement.id]} onClick={() => onPay(statement.id, paymentDates[statement.id])} className="min-h-11 rounded-pill border-none bg-primary px-sm font-body text-sm text-on-primary disabled:opacity-50">{payingStatementId === statement.id ? "Đang lưu" : "Thanh toán"}</button></div>}</div>{statement.purchases.map((purchase) => <p key={purchase.id} className="mt-xs font-body text-xs text-ink-muted-48">{purchase.date} · {purchase.note || "Chi tiêu"} · {formatVND(purchase.amount)}₫</p>)}</div>)}</div></article>)}</div>
      </section>

      <section className="bg-canvas px-5 py-8 sm:px-8"><div className="mx-auto max-w-3xl"><FinanceSection title="Nợ" description="Khoản cho vay và đi vay." accounts={debts} type="debt" onCreate={beginAccountCreate} onEdit={beginAccountEdit} onDelete={deleteAccount} /><FinanceSection title="Tiết kiệm" description="Các khoản tiền dành riêng." accounts={savings} type="savings" onCreate={beginAccountCreate} onEdit={beginAccountEdit} onDelete={deleteAccount} />
        {accountFormType && <form className="mt-lg rounded-lg border border-hairline bg-canvas-parchment p-lg" onSubmit={submitAccount}><h3 className="font-display text-[21px] font-semibold tracking-[-0.2px] text-ink">{editingAccount ? "Sửa tài khoản" : accountFormType === "debt" ? "Khoản nợ mới" : "Khoản tiết kiệm mới"}</h3><div className="mt-md grid gap-sm sm:grid-cols-2"><label className="font-body text-sm text-ink">Tên<input aria-label="Tên tài khoản" value={accountName} onChange={(event) => setAccountName(event.target.value)} placeholder={accountFormType === "debt" ? "Ví dụ: Minh" : "Ví dụ: Quỹ du lịch"} className="mt-xs min-h-11 w-full rounded-sm border border-hairline bg-canvas px-sm font-body text-[17px] text-ink" /></label>{accountFormType === "debt" && !editingAccount && <label className="font-body text-sm text-ink">Loại nợ<select aria-label="Loại nợ" value={debtDirection} onChange={(event) => setDebtDirection(event.target.value as "lend" | "borrow")} className="mt-xs min-h-11 w-full rounded-sm border border-hairline bg-canvas px-sm font-body text-[17px] text-ink"><option value="borrow">Đi vay</option><option value="lend">Cho vay</option></select></label>}<label className="font-body text-sm text-ink sm:col-span-2">Ghi chú<input aria-label="Ghi chú tài khoản" value={accountNote} onChange={(event) => setAccountNote(event.target.value)} placeholder="Không bắt buộc" className="mt-xs min-h-11 w-full rounded-sm border border-hairline bg-canvas px-sm font-body text-[17px] text-ink" /></label></div>{accountError && <p role="alert" className="mt-sm font-body text-sm text-ink">{accountError}</p>}<div className="mt-lg flex gap-sm"><button type="submit" disabled={savingAccount} className="min-h-11 rounded-pill border-none bg-primary px-[22px] font-body text-[17px] text-on-primary disabled:opacity-50">{savingAccount ? "Đang lưu" : "Lưu"}</button><button type="button" onClick={resetAccountForm} className="min-h-11 rounded-pill border border-primary bg-canvas px-[22px] font-body text-[17px] text-primary">Hủy</button></div></form>}
        {accountError && !accountFormType && <p role="alert" className="mt-md font-body text-sm text-ink">{accountError}</p>}</div></section>
    </main>
  );
}

function FinanceSection({ title, description, accounts, type, onCreate, onEdit, onDelete }: { title: string; description: string; accounts: FinanceAccount[]; type: "debt" | "savings"; onCreate: (type: "debt" | "savings") => void; onEdit: (account: FinanceAccount) => void; onDelete: (account: FinanceAccount) => void }) {
  return <section className="border-t border-hairline py-8 first:border-t-0 first:pt-0"><div className="flex items-end justify-between gap-md"><div><h2 className="font-display text-[28px] font-semibold tracking-[-0.3px] text-ink">{title}</h2><p className="mt-1 font-body text-sm text-ink-muted-48">{description}</p></div><button type="button" onClick={() => onCreate(type)} className="min-h-11 rounded-pill border border-primary bg-canvas px-sm font-body text-sm text-primary">Thêm</button></div>{accounts.length === 0 ? <p className="mt-lg font-body text-sm text-ink-muted-48">Chưa có tài khoản.</p> : <div className="mt-lg space-y-sm">{accounts.map((account) => <article key={account.id} className="rounded-lg border border-hairline bg-canvas-parchment p-md"><div className="flex items-start justify-between gap-sm"><div><h3 className="font-body text-[17px] font-semibold text-ink">{account.name}</h3><p className="mt-1 font-body text-xs text-ink-muted-48">{account.type === "debt" ? account.debt_direction === "lend" ? "Cho vay" : "Đi vay" : "Tiền gửi"}{account.note ? ` · ${account.note}` : ""}</p></div><p className="font-display text-lg font-semibold text-ink">{formatVND(Math.abs(account.balance))}₫</p></div><div className="mt-sm border-t border-hairline pt-xs">{account.transactions.length === 0 ? <p className="font-body text-xs text-ink-muted-48">Chưa có giao dịch.</p> : account.transactions.map((transaction) => <p key={transaction.id} className="mt-1 font-body text-xs text-ink-muted-48">{transaction.date} · {transaction.note || "Giao dịch"} · {transaction.type === "expense" ? "−" : "+"}{formatVND(transaction.amount)}₫</p>)}</div><div className="mt-sm flex gap-sm"><button type="button" onClick={() => onEdit(account)} className="min-h-11 rounded-pill border border-primary bg-canvas px-sm font-body text-sm text-primary">Sửa</button><button type="button" onClick={() => onDelete(account)} className="min-h-11 rounded-pill border border-hairline bg-canvas px-sm font-body text-sm text-ink">Xóa</button></div></article>)}</div>}</section>;
}
