"use client";

import { useEffect, useEffectEvent } from "react";

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
  "[contenteditable='true']",
].join(",");

const modalStack: symbol[] = [];
let bodyLockDepth = 0;
let originalBodyOverflow = "";

type ModalFocusOptions = {
  open: boolean;
  containerRef: React.RefObject<HTMLElement | null>;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  closeDisabled?: boolean;
};

function focusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector))
    .filter((element) => !element.closest("[hidden], [inert], [aria-hidden='true']"));
}

export function useModalFocus({
  open,
  containerRef,
  initialFocusRef,
  onClose,
  closeDisabled = false,
}: ModalFocusOptions) {
  const closeFromKeyboard = useEffectEvent(() => {
    if (!closeDisabled) onClose();
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!open || !container) return;

    const token = Symbol("modal");
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const hiddenSiblings: Array<{ element: HTMLElement; hadInert: boolean; ariaHidden: string | null }> = [];

    modalStack.push(token);
    if (bodyLockDepth === 0) originalBodyOverflow = document.body.style.overflow;
    bodyLockDepth += 1;
    document.body.style.overflow = "hidden";

    let branch: HTMLElement = container;
    while (branch.parentElement) {
      for (const sibling of branch.parentElement.children) {
        if (!(sibling instanceof HTMLElement) || sibling === branch || sibling.dataset.modalBackdrop === "true") continue;
        hiddenSiblings.push({ element: sibling, hadInert: sibling.hasAttribute("inert"), ariaHidden: sibling.getAttribute("aria-hidden") });
        sibling.setAttribute("inert", "");
        sibling.setAttribute("aria-hidden", "true");
      }
      if (branch.parentElement === document.body) break;
      branch = branch.parentElement;
    }

    const frame = requestAnimationFrame(() => {
      (initialFocusRef?.current ?? focusableElements(container)[0] ?? container).focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (modalStack.at(-1) !== token) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeFromKeyboard();
        return;
      }
      if (event.key !== "Tab") return;

      const elements = focusableElements(container);
      if (elements.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && (document.activeElement === first || !container.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown, true);
      const stackIndex = modalStack.lastIndexOf(token);
      if (stackIndex >= 0) modalStack.splice(stackIndex, 1);
      for (const { element, hadInert, ariaHidden } of hiddenSiblings.reverse()) {
        if (!hadInert) element.removeAttribute("inert");
        if (ariaHidden === null) element.removeAttribute("aria-hidden");
        else element.setAttribute("aria-hidden", ariaHidden);
      }
      bodyLockDepth = Math.max(0, bodyLockDepth - 1);
      if (bodyLockDepth === 0) document.body.style.overflow = originalBodyOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open, containerRef, initialFocusRef]);
}
