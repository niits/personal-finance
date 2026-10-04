"use client";

import { useEffect, useRef } from "react";

export function ConfirmationSheet({
  open,
  title,
  consequence,
  confirmLabel,
  pendingLabel = "Đang xử lý…",
  pending = false,
  error,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  consequence: string;
  confirmLabel: string;
  pendingLabel?: string;
  pending?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!open) return;

    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="confirmation-title"
      aria-describedby="confirmation-consequence"
      aria-busy={pending}
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onCancel();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !pending) onCancel();
      }}
      className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-none w-full max-w-none border-0 bg-transparent p-0 backdrop:bg-surface-black/40 sm:inset-0 sm:m-auto sm:max-w-[480px]"
    >
      <div
        className="w-full rounded-t-2xl bg-canvas px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-lg sm:rounded-lg sm:p-lg"
      >
        <h2 id="confirmation-title" className="font-display text-[21px] font-semibold leading-[26px] text-ink">
          {title}
        </h2>
        <p id="confirmation-consequence" className="mt-xs font-body text-base leading-[25px] text-ink-muted-80">
          {consequence}
        </p>
        {error ? (
          <p role="alert" className="mt-sm font-body text-sm leading-[21px] text-danger">
            {error}
          </p>
        ) : null}
        <div className="mt-lg flex gap-sm">
          <button
            type="button"
            disabled={pending}
            onClick={onCancel}
            className="min-h-11 flex-1 rounded-md border border-hairline bg-canvas font-body text-base font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-60"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onConfirm}
            className="min-h-11 flex-1 rounded-md border-0 bg-danger font-body text-base font-semibold text-on-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? pendingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
