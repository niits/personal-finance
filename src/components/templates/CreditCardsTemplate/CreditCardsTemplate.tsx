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
  cards: { id: string; name: string }[];
  statements: CardStatement[];
};

type CreditCardsTemplateProps = {
  groups: CardGroup[];
  payingStatementId: string | null;
  onPay: (statementId: string, paidAt: string) => void;
  onCreateGroup: (name: string, closeDay: number) => void;
  onCreateCard: (groupId: string, name: string) => void;
};

export function CreditCardsTemplate({ groups, payingStatementId, onPay, onCreateGroup, onCreateCard }: CreditCardsTemplateProps) {
  const [groupName, setGroupName] = useState("");
  const [closeDay, setCloseDay] = useState("15");
  const [cardNames, setCardNames] = useState<Record<string, string>>({});
  const [paymentDates, setPaymentDates] = useState<Record<string, string>>({});
  return (
    <div className="min-h-dvh bg-canvas-parchment px-5 pt-5 pb-24">
      <h1 className="m-0 font-display text-[28px] font-semibold tracking-[-0.5px] text-ink">Thẻ tín dụng</h1>
      <form className="mt-4 flex flex-wrap gap-2 rounded-lg border border-hairline bg-canvas p-sm" onSubmit={(event) => { event.preventDefault(); const day = Number(closeDay); if (groupName.trim() && Number.isInteger(day) && day >= 1 && day <= 31) { onCreateGroup(groupName.trim(), day); setGroupName(""); } }}>
        <input aria-label="Tên nhóm thẻ" value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="Tên nhóm thẻ" className="min-w-0 flex-1 rounded-sm border border-hairline bg-canvas-parchment px-sm py-xs font-body text-sm text-ink" />
        <input aria-label="Ngày chốt sao kê" value={closeDay} onChange={(event) => setCloseDay(event.target.value)} inputMode="numeric" className="w-16 rounded-sm border border-hairline bg-canvas-parchment px-sm py-xs font-body text-sm text-ink" />
        <button type="submit" className="rounded-pill border-none bg-primary px-sm py-xs font-body text-sm text-on-primary">Thêm nhóm</button>
      </form>
      {groups.length === 0 ? <p className="mt-4 font-body text-sm text-ink-muted-48">Chưa có nhóm thẻ nào.</p> : groups.map((group) => (
        <section key={group.id} className="mt-5 rounded-lg border border-hairline bg-canvas p-lg">
          <div className="flex items-start justify-between gap-sm">
            <div>
              <h2 className="m-0 font-body text-[17px] font-semibold text-ink">{group.name}</h2>
              <p className="mt-1 font-body text-xs text-ink-muted-48">Chốt sao kê ngày {group.statement_close_day} · {group.cards.map((card) => card.name).join(", ") || "Chưa có thẻ"}</p>
            </div>
          </div>
          <form className="mt-sm flex gap-2" onSubmit={(event) => { event.preventDefault(); const name = cardNames[group.id]?.trim(); if (name) { onCreateCard(group.id, name); setCardNames((current) => ({ ...current, [group.id]: "" })); } }}>
            <input aria-label={`Tên thẻ ${group.name}`} value={cardNames[group.id] ?? ""} onChange={(event) => setCardNames((current) => ({ ...current, [group.id]: event.target.value }))} placeholder="Thêm thẻ" className="min-w-0 flex-1 rounded-sm border border-hairline bg-canvas-parchment px-sm py-xs font-body text-sm text-ink" />
            <button type="submit" className="rounded-pill border-none bg-primary px-sm py-xs font-body text-sm text-on-primary">Thêm thẻ</button>
          </form>
          {group.statements.length === 0 ? <p className="mb-0 mt-md font-body text-sm text-ink-muted-48">Chưa có sao kê.</p> : group.statements.map((statement) => (
            <article key={statement.id} className="mt-md border-t border-hairline pt-sm">
              <div className="flex items-center justify-between gap-sm">
                <div>
                  <p className="m-0 font-body text-sm font-semibold text-ink">{formatVND(statement.amount)}₫</p>
                  <p className="mt-1 font-body text-xs text-ink-muted-48">{statement.period_start} đến {statement.period_end}</p>
                </div>
                {statement.status === "paid" ? <span className="font-body text-xs text-ink-muted-48">Đã thanh toán {statement.paid_at}</span> : <div className="flex items-center gap-1"><input aria-label={`Ngày thanh toán ${statement.id}`} type="date" max={new Date().toISOString().slice(0, 10)} value={paymentDates[statement.id] ?? ""} onChange={(event) => setPaymentDates((current) => ({ ...current, [statement.id]: event.target.value }))} className="w-28 font-body text-xs" /><button type="button" disabled={payingStatementId === statement.id || !paymentDates[statement.id]} onClick={() => onPay(statement.id, paymentDates[statement.id])} className="rounded-pill border-none bg-primary px-sm py-xs font-body text-xs text-on-primary">{payingStatementId === statement.id ? "Đang lưu" : "Thanh toán đủ"}</button></div>}
              </div>
              {statement.purchases.map((purchase) => <p key={purchase.id} className="mb-0 mt-xs font-body text-xs text-ink-muted-48">{purchase.date} · {purchase.note || "Chi tiêu"} · {formatVND(purchase.amount)}₫</p>)}
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}
