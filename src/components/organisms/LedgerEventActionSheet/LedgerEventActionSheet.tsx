"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/atoms/Button";
import { CurrencyDisplay } from "@/components/atoms/CurrencyDisplay";
import { useModalFocus } from "@/hooks/useModalFocus";
import type { FinancialEventDto } from "@/lib/ledger/contracts";

export type LedgerEventActionIntent = {
  mode: "reverse" | "refund";
  amount?: number;
  date?: string;
  note?: string | null;
};

type Props = {
  event: FinancialEventDto | null;
  mode: "reverse" | "refund" | null;
  submitting: boolean;
  error: string | null;
  onSubmit: (intent: LedgerEventActionIntent) => void;
  onClose: () => void;
};

const field = "mt-xxs min-h-11 w-full rounded-md border border-hairline bg-canvas px-sm font-body text-[16px] text-ink";
const vietnamToday = () => new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);

export function LedgerEventActionSheet({ event, mode, submitting, error, onSubmit, onClose }: Props) {
  const [today] = useState(vietnamToday);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const dialogRef = useRef<HTMLElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const open = event !== null && mode !== null;

  useModalFocus({
    open,
    containerRef: dialogRef,
    initialFocusRef: mode === "refund" ? amountRef : titleRef,
    onClose,
    closeDisabled: submitting,
  });

  if (!event || !mode) return null;
  const refundableAmount = event.remainingRefundableAmount ?? 0;
  const numericAmount = Number(amount);
  const valid = mode === "reverse"
    || Number.isSafeInteger(numericAmount) && numericAmount > 0 && numericAmount <= refundableAmount && !!date;

  return <>
    <button data-modal-backdrop="true" type="button" tabIndex={-1} aria-hidden="true" onClick={submitting ? undefined : onClose} className="fixed inset-0 z-[100] border-0 bg-surface-black/40" />
    <section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="event-action-title" className="fixed inset-x-0 bottom-0 z-[101] max-h-[88dvh] touch-pan-y overflow-y-auto overscroll-contain rounded-t-lg bg-canvas px-lg pb-[max(24px,env(safe-area-inset-bottom))] pt-md md:left-1/2 md:max-w-lg md:-translate-x-1/2">
      <div className="mx-auto mb-md h-1 w-9 rounded-pill bg-hairline" />
      <h2 ref={titleRef} tabIndex={-1} id="event-action-title" className="font-display text-[21px] font-semibold text-ink">{mode === "refund" ? "Ghi nhận hoàn tiền" : "Đảo bút toán"}</h2>
      <p className="mt-xs font-body text-[14px] text-ink-muted-48">{event.activity.label} · <CurrencyDisplay amount={event.amount} size="sm" /></p>
      <form className="mt-lg space-y-md" onSubmit={(formEvent) => {
        formEvent.preventDefault();
        if (!valid) return;
        onSubmit(mode === "reverse" ? { mode } : { mode, amount: numericAmount, date, note: note.trim() || null });
      }}>
        {mode === "refund" ? <>
          <label className="block font-body text-[13px] text-ink-muted-48">Số tiền hoàn<input ref={amountRef} required inputMode="numeric" type="number" min="1" max={refundableAmount} step="1" value={amount} onChange={(changeEvent) => setAmount(changeEvent.target.value)} className={`${field} font-display text-[24px] font-semibold`} /><span className="mt-xxs block">Có thể hoàn tối đa {new Intl.NumberFormat("vi-VN").format(refundableAmount)}₫</span></label>
          <label className="block font-body text-[13px] text-ink-muted-48">Ngày<input required type="date" max={today} value={date} onChange={(changeEvent) => setDate(changeEvent.target.value)} className={field} /></label>
          <label className="block font-body text-[13px] text-ink-muted-48">Ghi chú<input value={note} onChange={(changeEvent) => setNote(changeEvent.target.value)} className={field} /></label>
        </> : <div className="rounded-md bg-canvas-parchment p-md"><p className="font-body text-[14px] text-ink">Xác nhận ghi một bút toán điều chỉnh ngược lại sự kiện này.</p><p className="mt-xs font-body text-[13px] text-ink-muted-48">Lịch sử gốc được giữ nguyên; thao tác không xoá dữ liệu.</p></div>}
        {error ? <p role="alert" aria-live="assertive" className="font-body text-[13px] text-danger">{error}</p> : null}
        <div className="grid grid-cols-2 gap-sm"><Button label="Huỷ" variant="secondary" disabled={submitting} onClick={onClose} fullWidth pill /><Button type="submit" label={mode === "refund" ? "Ghi hoàn tiền" : "Xác nhận đảo"} loading={submitting} disabled={!valid} fullWidth pill /></div>
      </form>
    </section>
  </>;
}
