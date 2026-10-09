"use client";

import { useEffect, useRef, type ReactNode, type RefObject } from "react";

export type ModalSheetProps = {
  open: boolean;
  title: string;
  pending?: boolean;
  onDismiss: () => void;
  children: ReactNode;
  restoreFocusRef?: RefObject<HTMLElement | null>;
};

export function ModalSheet({ open, title, pending = false, onDismiss, children, restoreFocusRef }: ModalSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const trigger = restoreFocusRef?.current ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const { scrollX, scrollY } = window;
    const bodyStyle = document.body.style;
    const previous = { position: bodyStyle.position, top: bodyStyle.top, left: bodyStyle.left, width: bodyStyle.width };
    bodyStyle.position = "fixed";
    bodyStyle.top = `${-scrollY}px`;
    bodyStyle.left = `${-scrollX}px`;
    bodyStyle.width = "100%";
    dialog.showModal();
    dialog.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });

    const viewport = window.visualViewport;
    function fitViewport() {
      if (!dialog || !viewport) return;
      dialog.style.top = `${viewport.offsetTop}px`;
      dialog.style.height = `${viewport.height}px`;
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && dialog.contains(focused)) {
        focused.scrollIntoView({ block: "nearest" });
      }
    }
    fitViewport();
    viewport?.addEventListener("resize", fitViewport);
    viewport?.addEventListener("scroll", fitViewport);

    return () => {
      viewport?.removeEventListener("resize", fitViewport);
      viewport?.removeEventListener("scroll", fitViewport);
      dialog.close();
      Object.assign(bodyStyle, previous);
      window.scrollTo(scrollX, scrollY);
      trigger?.focus({ preventScroll: true });
    };
  }, [open, restoreFocusRef]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-label={title}
      aria-busy={pending}
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onDismiss();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !pending) onDismiss();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = [...event.currentTarget.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]',
        )].filter((element) => element.getClientRects().length > 0);
        const first = controls[0];
        const last = controls.at(-1);
        if (!first) {
          event.preventDefault();
          return;
        }
        if (event.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement as HTMLElement))) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
      className="fixed inset-x-0 top-0 m-0 h-dvh max-h-none w-full max-w-none items-end justify-center border-0 bg-transparent p-0 backdrop:bg-surface-black/40 open:flex sm:items-center sm:p-lg"
    >
      <section className="max-h-[calc(100%_-_env(safe-area-inset-top))] w-full min-w-0 max-w-[480px] overflow-y-auto overscroll-contain rounded-t-sheet bg-canvas px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-lg sm:rounded-sheet sm:p-lg">
        <h2 tabIndex={-1} className="modal-sheet-title break-words font-display text-[21px] font-semibold leading-[26px] text-ink">{title}</h2>
        {children}
      </section>
    </dialog>
  );
}
