"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/atoms/Button";
import { CurrencyDisplay } from "@/components/atoms/CurrencyDisplay";
import { useModalFocus } from "@/hooks/useModalFocus";
import type { PositionAvailableAction, PositionSummary } from "@/lib/ledger/positions";

export type PositionActionIntent = { action: PositionAvailableAction["code"]; amount?: number; date: string };

type PositionActionSheetProps = {
  position: PositionSummary;
  action: PositionAvailableAction | null;
  submitting?: boolean;
  error?: string | null;
  onSubmit: (intent: PositionActionIntent) => void;
  onClose: () => void;
};

function currentVietnamDate() {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function PositionActionSheet({ position, action, submitting, error, onSubmit, onClose }: PositionActionSheetProps) {
  const [today] = useState(currentVietnamDate);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const dialogRef = useRef<HTMLElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  useModalFocus({
    open: action !== null,
    containerRef: dialogRef,
    initialFocusRef: action?.code === "close" ? dateInputRef : amountInputRef,
    onClose,
    closeDisabled: submitting,
  });

  if (!action) return null;
  const isClose = action.code === "close";
  const numericAmount = Number(amount);
  const amountValid = Number.isSafeInteger(numericAmount)
    && numericAmount > 0
    && (action.maxAmount === null || numericAmount <= action.maxAmount);
  const consequence = action.cashEffect === "receive"
    ? "Bạn sẽ nhận tiền mặt"
    : action.cashEffect === "pay"
      ? "Bạn sẽ trả tiền mặt"
      : "Không phát sinh dòng tiền";

  return (
    <>
      <button data-modal-backdrop="true" type="button" tabIndex={-1} aria-hidden="true" onClick={submitting ? undefined : onClose} className="fixed inset-0 z-[100] border-0 bg-surface-black/40" />
      <section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="position-action-title" className="fixed inset-x-0 bottom-0 z-[101] max-h-[88dvh] touch-pan-y overflow-y-auto overscroll-contain rounded-t-lg bg-canvas px-lg pb-[max(24px,env(safe-area-inset-bottom))] pt-md md:left-1/2 md:max-w-lg md:-translate-x-1/2">
        <div className="mx-auto mb-lg h-1 w-9 rounded-pill bg-hairline" />
        <h2 id="position-action-title" className="font-display text-[21px] font-semibold tracking-[-0.3px] text-ink">{action.label}</h2>
        <p className="mt-xxs font-body text-[14px] text-ink-muted-48">{position.name}</p>

        <form onSubmit={(event) => {
          event.preventDefault();
          if (!date || (!isClose && !amountValid)) return;
          onSubmit({ action: action.code, amount: isClose ? undefined : numericAmount, date });
        }}>
        {isClose ? (
          <div className="my-lg rounded-lg border border-hairline bg-canvas-parchment p-lg text-center">
            <p className="font-body text-[14px] text-ink-muted-48">{consequence}</p>
            <div className="mt-xs"><CurrencyDisplay amount={action.maxAmount ?? 0} size="xl" /></div>
            <p className="mt-sm font-body text-[13px] text-ink-muted-48">Tất toán là một thao tác nguyên tử: dòng tiền và trạng thái đóng được ghi nhận cùng lúc.</p>
          </div>
        ) : (
          <label className="my-lg block font-body text-[13px] text-ink-muted-48">
            Số tiền
            <input ref={amountInputRef} name="amount" autoComplete="off" inputMode="numeric" type="number" required min="1" max={action.maxAmount ?? Number.MAX_SAFE_INTEGER} step="1" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-xxs min-h-12 w-full rounded-md border border-hairline bg-canvas px-sm font-display text-[24px] font-semibold text-ink" />
            {action.maxAmount !== null ? <span className="mt-xxs block">Tối đa {new Intl.NumberFormat("vi-VN").format(action.maxAmount)}₫</span> : null}
          </label>
        )}

        <label className="mb-lg block font-body text-[13px] text-ink-muted-48">
          Ngày ghi nhận
          <input ref={dateInputRef} name="date" autoComplete="off" type="date" required max={today} value={date} onChange={(event) => setDate(event.target.value)} className="mt-xxs min-h-11 w-full rounded-md border border-hairline bg-canvas px-sm font-body text-[15px] text-ink" />
        </label>
        {error ? <p role="alert" aria-live="assertive" className="mb-md rounded-md bg-canvas-parchment p-sm font-body text-[14px] text-danger">{error}</p> : null}
        <div className="grid grid-cols-2 gap-sm">
          <Button label="Huỷ" variant="secondary" onClick={onClose} disabled={submitting} fullWidth pill />
          <Button
            type="submit"
            label={isClose ? "Xác nhận tất toán" : action.label}
            loading={submitting}
            disabled={!date || (!isClose && !amountValid)}
            fullWidth
            pill
          />
        </div>
        </form>
      </section>
    </>
  );
}
