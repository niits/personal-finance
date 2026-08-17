"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/atoms/Button";
import { useModalFocus } from "@/hooks/useModalFocus";
import type { PositionKind } from "@/lib/ledger/types";

export type CreatePositionIntent = {
  name: string;
  kind: PositionKind;
  counterparty: string | null;
  dueDate: string | null;
  note: string | null;
};

type PositionCreateSheetProps = {
  open: boolean;
  submitting?: boolean;
  error?: string | null;
  onSubmit: (intent: CreatePositionIntent) => void;
  onClose: () => void;
};

const kinds: Array<{ value: PositionKind; label: string; hint: string }> = [
  { value: "personal_receivable", label: "Cho vay", hint: "Người khác nợ bạn" },
  { value: "personal_payable", label: "Đi vay", hint: "Bạn nợ người khác" },
  { value: "term_deposit", label: "Tiền gửi", hint: "Tiền gửi kỳ hạn" },
  { value: "credit_card", label: "Thẻ tín dụng", hint: "Chi tiêu trước, thanh toán sau" },
];

export function PositionCreateSheet({ open, submitting, error, onSubmit, onClose }: PositionCreateSheetProps) {
  const [kind, setKind] = useState<PositionKind>("personal_receivable");
  const [name, setName] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");
  const dialogRef = useRef<HTMLElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  useModalFocus({ open, containerRef: dialogRef, initialFocusRef: nameInputRef, onClose, closeDisabled: submitting });

  if (!open) return null;

  return (
    <>
      <button data-modal-backdrop="true" type="button" tabIndex={-1} aria-hidden="true" onClick={submitting ? undefined : onClose} className="fixed inset-0 z-[100] border-0 bg-surface-black/40" />
      <section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="create-position-title" className="fixed inset-x-0 bottom-0 z-[101] max-h-[88dvh] touch-pan-y overflow-y-auto overscroll-contain rounded-t-lg bg-canvas px-lg pb-[max(24px,env(safe-area-inset-bottom))] pt-md md:left-1/2 md:max-w-xl md:-translate-x-1/2">
        <div className="mx-auto mb-md h-1 w-9 rounded-pill bg-hairline" />
        <div className="mb-lg flex items-center justify-between">
          <div>
            <h2 id="create-position-title" className="font-display text-[21px] font-semibold tracking-[-0.3px] text-ink">Tạo vị thế</h2>
            <p className="mt-xxs font-body text-[14px] text-ink-muted-48">Theo dõi riêng phần gốc, không tính là thu nhập hay chi phí.</p>
          </div>
          <button type="button" onClick={submitting ? undefined : onClose} disabled={submitting} className="size-11 rounded-full border-0 bg-canvas-parchment font-body text-[18px] text-ink disabled:text-ink-muted-48" aria-label="Đóng">×</button>
        </div>

        <form onSubmit={(event) => {
          event.preventDefault();
          onSubmit({
            name: name.trim(),
            kind,
            counterparty: counterparty.trim() || null,
            dueDate: dueDate || null,
            note: note.trim() || null,
          });
        }} className="space-y-md">
        <div className="grid grid-cols-2 gap-xs" role="radiogroup" aria-label="Loại vị thế">
          {kinds.map((item) => (
            <button key={item.value} role="radio" aria-checked={kind === item.value} type="button" onClick={() => setKind(item.value)} className={`min-h-20 rounded-lg border p-sm text-left ${kind === item.value ? "border-primary bg-canvas text-primary" : "border-hairline bg-canvas-parchment text-ink"}`}>
              <span className="block font-body text-[15px] font-semibold">{item.label}</span>
              <span className="mt-xxs block font-body text-[12px] text-ink-muted-48">{item.hint}</span>
            </button>
          ))}
        </div>

          <label className="block font-body text-[13px] text-ink-muted-48">
            Tên vị thế
            <input ref={nameInputRef} name="name" autoComplete="off" required value={name} onChange={(event) => setName(event.target.value)} placeholder="Ví dụ: Khoản vay của Lan" className="mt-xxs min-h-11 w-full rounded-md border border-hairline bg-canvas px-sm font-body text-[17px] text-ink" />
          </label>
          <label className="block font-body text-[13px] text-ink-muted-48">
            Đối tác (tuỳ chọn)
            <input name="counterparty" autoComplete="name" value={counterparty} onChange={(event) => setCounterparty(event.target.value)} placeholder="Tên người hoặc ngân hàng" className="mt-xxs min-h-11 w-full rounded-md border border-hairline bg-canvas px-sm font-body text-[17px] text-ink" />
          </label>
          <p className="rounded-md bg-canvas-parchment p-sm font-body text-[13px] text-ink-muted-48">Vị thế mới bắt đầu với số dư 0. Sau khi tạo, dùng thao tác trong trang chi tiết để thêm khoản gốc.</p>
          <label className="block font-body text-[13px] text-ink-muted-48">
            Ngày đến hạn (tuỳ chọn)
            <input name="dueDate" autoComplete="off" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="mt-xxs min-h-11 w-full rounded-md border border-hairline bg-canvas px-sm font-body text-[15px] text-ink" />
          </label>
          <label className="block font-body text-[13px] text-ink-muted-48">
            Ghi chú (tuỳ chọn)
            <textarea name="note" autoComplete="off" value={note} onChange={(event) => setNote(event.target.value)} rows={2} className="mt-xxs w-full resize-none rounded-md border border-hairline bg-canvas p-sm font-body text-[17px] text-ink" />
          </label>
          {error ? <p role="alert" aria-live="assertive" className="rounded-md bg-canvas-parchment p-sm font-body text-[14px] text-danger">{error}</p> : null}
          <Button type="submit" label="Tạo vị thế" loading={submitting} disabled={!name.trim()} fullWidth pill />
        </form>
      </section>
    </>
  );
}
