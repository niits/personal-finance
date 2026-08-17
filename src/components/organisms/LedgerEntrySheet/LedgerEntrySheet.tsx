"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/atoms/Button";
import { useModalFocus } from "@/hooks/useModalFocus";
import type { CustomEnvelopeDto } from "@/lib/ledger/contracts";
import type { PositionSummary } from "@/lib/ledger/positions";

export type LedgerCategoryOption = {
  id: number;
  name: string;
  label: string;
  emoji: string | null;
  type: "income" | "expense";
};

export type LedgerEntryIntent = {
  type: "income" | "expense";
  amount: number;
  categoryId: number;
  date: string;
  note: string | null;
  positionId?: string;
  allocations?: Array<{ customBudgetId: string; amount: number }>;
};

type Props = {
  open: boolean;
  categories: LedgerCategoryOption[];
  cards: PositionSummary[];
  envelopes: CustomEnvelopeDto[];
  submitting: boolean;
  error: string | null;
  onSubmit: (intent: LedgerEntryIntent) => void;
  onClose: () => void;
};

const field = "mt-xxs min-h-11 w-full min-w-0 rounded-md border border-hairline bg-canvas px-sm font-body text-[16px] text-ink";
const todayVietnam = () => new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);

export function LedgerEntrySheet({ open, categories, cards, envelopes, submitting, error, onSubmit, onClose }: Props) {
  const [today] = useState(todayVietnam);
  const [type, setType] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [positionId, setPositionId] = useState("");
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const dialogRef = useRef<HTMLElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  useModalFocus({ open, containerRef: dialogRef, initialFocusRef: amountRef, onClose, closeDisabled: submitting });

  if (!open) return null;
  const value = Number(amount);
  const allocated = Object.values(allocations).reduce((sum, item) => sum + Number(item || 0), 0);
  const unassigned = Number.isSafeInteger(value) ? value - allocated : 0;
  const availableCategories = categories.filter((category) => category.type === type);
  const valid = Number.isSafeInteger(value)
    && value > 0
    && !!categoryId
    && !!date
    && allocated <= value
    && Object.values(allocations).every((item) => Number.isSafeInteger(Number(item || 0)) && Number(item || 0) >= 0);

  return <>
    <button data-modal-backdrop="true" type="button" tabIndex={-1} aria-hidden="true" onClick={submitting ? undefined : onClose} className="fixed inset-0 z-[100] border-0 bg-surface-black/40" />
    <section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="entry-title" className="fixed inset-x-0 bottom-0 z-[101] max-h-[88dvh] touch-pan-y overflow-y-auto overscroll-contain rounded-t-lg bg-canvas px-lg pb-[max(24px,env(safe-area-inset-bottom))] pt-md md:left-1/2 md:max-w-xl md:-translate-x-1/2">
      <div className="mx-auto mb-md h-1 w-9 rounded-pill bg-hairline" />
      <h2 id="entry-title" className="font-display text-[21px] font-semibold text-ink">Ghi nhận giao dịch</h2>
      <form className="mt-md space-y-md" onSubmit={(event) => {
        event.preventDefault();
        if (!valid) return;
        onSubmit({
          type,
          amount: value,
          categoryId: Number(categoryId),
          date,
          note: note.trim() || null,
          positionId: type === "expense" && positionId ? positionId : undefined,
          allocations: type === "expense"
            ? Object.entries(allocations)
              .filter(([, item]) => Number(item) > 0)
              .map(([customBudgetId, item]) => ({ customBudgetId, amount: Number(item) }))
            : undefined,
        });
      }}>
        <div role="radiogroup" aria-label="Loại giao dịch" className="grid grid-cols-2 rounded-pill bg-canvas-parchment p-xxs">
          <button role="radio" aria-checked={type === "expense"} type="button" onClick={() => { setType("expense"); setCategoryId(""); }} className={`min-h-11 rounded-pill border-0 font-body text-[15px] ${type === "expense" ? "bg-primary text-on-primary" : "bg-transparent text-ink"}`}>Chi tiêu</button>
          <button role="radio" aria-checked={type === "income"} type="button" onClick={() => { setType("income"); setCategoryId(""); }} className={`min-h-11 rounded-pill border-0 font-body text-[15px] ${type === "income" ? "bg-primary text-on-primary" : "bg-transparent text-ink"}`}>Thu nhập</button>
        </div>
        <label className="block font-body text-[13px] text-ink-muted-48">Số tiền<input ref={amountRef} name="amount" inputMode="numeric" autoComplete="off" type="number" min="1" step="1" required value={amount} onChange={(event) => setAmount(event.target.value)} className={`${field} font-display text-[24px] font-semibold`} /></label>
        <label className="block font-body text-[13px] text-ink-muted-48">Danh mục<select name="categoryId" required value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className={field}><option value="">Chọn danh mục</option>{availableCategories.map((category) => <option key={category.id} value={category.id}>{category.emoji ?? "•"} {category.label}</option>)}</select></label>
        {type === "expense" ? <>
          <label className="block font-body text-[13px] text-ink-muted-48">Thanh toán từ<select name="positionId" value={positionId} onChange={(event) => setPositionId(event.target.value)} className={field}><option value="">Tiền mặt / thẻ ghi nợ</option>{cards.map((card) => <option key={card.id} value={card.id}>Thẻ tín dụng · {card.name}</option>)}</select></label>
          {envelopes.length ? <fieldset className="rounded-md bg-canvas-parchment p-md">
            <legend className="font-body text-[13px] font-semibold text-ink">Phân bổ phong bì (tuỳ chọn)</legend>
            <div className="mt-xs space-y-xs">{envelopes.map((envelope) => <label key={envelope.id} className="grid grid-cols-[1fr_120px] items-center gap-sm font-body text-[13px] text-ink-muted-48"><span>{envelope.name} · còn {new Intl.NumberFormat("vi-VN").format(envelope.remaining)}₫</span><input aria-label={`Phân bổ ${envelope.name}`} inputMode="numeric" type="number" min="0" max={value || 0} step="1" value={allocations[envelope.id] ?? ""} onChange={(event) => setAllocations((current) => ({ ...current, [envelope.id]: event.target.value }))} className={field} /></label>)}</div>
            <p role={unassigned < 0 ? "alert" : "status"} aria-live="polite" className={`mt-sm font-body text-[13px] ${unassigned < 0 ? "text-danger" : "text-ink-muted-48"}`}>Đã phân bổ {new Intl.NumberFormat("vi-VN").format(allocated)}₫ · Chưa gán {new Intl.NumberFormat("vi-VN").format(unassigned)}₫</p>
          </fieldset> : null}
        </> : null}
        <div className="grid grid-cols-2 gap-sm"><label className="font-body text-[13px] text-ink-muted-48">Ngày<input name="date" type="date" required max={today} value={date} onChange={(event) => setDate(event.target.value)} className={field} /></label><label className="font-body text-[13px] text-ink-muted-48">Ghi chú<input name="note" autoComplete="off" value={note} onChange={(event) => setNote(event.target.value)} className={field} /></label></div>
        {error ? <p role="alert" aria-live="assertive" className="font-body text-[13px] text-danger">{error}</p> : null}
        <div className="grid grid-cols-2 gap-sm"><Button label="Huỷ" variant="secondary" onClick={onClose} disabled={submitting} fullWidth pill /><Button type="submit" label="Ghi nhận" loading={submitting} disabled={!valid} fullWidth pill /></div>
      </form>
    </section>
  </>;
}
