"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/atoms/Button";
import { useModalFocus } from "@/hooks/useModalFocus";
import type { PositionSummary } from "@/lib/ledger/positions";

type Props = {
  open: boolean;
  position: PositionSummary;
  closedDate: string;
  submitting: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
};

export function PositionCloseCorrectionSheet({ open, position, closedDate, submitting, error, onConfirm, onClose }: Props) {
  const [confirmed, setConfirmed] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  useModalFocus({ open, containerRef: dialogRef, initialFocusRef: titleRef, onClose, closeDisabled: submitting });

  if (!open) return null;
  return <>
    <button data-modal-backdrop="true" type="button" tabIndex={-1} aria-hidden="true" onClick={submitting ? undefined : onClose} className="fixed inset-0 z-[100] border-0 bg-surface-black/40" />
    <section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="close-correction-title" className="fixed inset-x-0 bottom-0 z-[101] max-h-[88dvh] touch-pan-y overflow-y-auto overscroll-contain rounded-t-lg bg-canvas px-lg pb-[max(24px,env(safe-area-inset-bottom))] pt-md md:left-1/2 md:max-w-lg md:-translate-x-1/2">
      <div className="mx-auto mb-md h-1 w-9 rounded-pill bg-hairline" />
      <h2 ref={titleRef} tabIndex={-1} id="close-correction-title" className="font-display text-[21px] font-semibold text-ink">Điều chỉnh lần tất toán</h2>
      <p className="mt-xs font-body text-[14px] text-ink-muted-48">{position.name} · đã tất toán ngày {closedDate.split("-").reverse().join("/")}</p>
      <div className="my-lg rounded-md bg-canvas-parchment p-md">
        <p className="font-body text-[14px] text-ink">Hệ thống sẽ ghi một sự kiện điều chỉnh cho lần tất toán này.</p>
        <p className="mt-xs font-body text-[13px] text-ink-muted-48">Lịch sử đóng và bút toán tất toán gốc vẫn được giữ để đối chiếu. Đây không phải thao tác xoá hay mở lại chung.</p>
      </div>
      <label className="flex gap-sm font-body text-[14px] text-ink"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-xxs size-5 accent-primary" /><span>Tôi xác nhận lần tất toán đã chọn cần được điều chỉnh bằng sự kiện mới.</span></label>
      {error ? <p role="alert" aria-live="assertive" className="mt-md font-body text-[13px] text-danger">{error}</p> : null}
      <div className="mt-lg grid grid-cols-2 gap-sm"><Button label="Huỷ" variant="secondary" disabled={submitting} onClick={onClose} fullWidth pill /><Button label="Ghi điều chỉnh" disabled={!confirmed} loading={submitting} onClick={onConfirm} fullWidth pill /></div>
    </section>
  </>;
}
