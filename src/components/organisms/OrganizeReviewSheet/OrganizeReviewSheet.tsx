"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { OrganizeSectionHeader } from "@/components/molecules/OrganizeSectionHeader";
import { NewCategoryRow } from "@/components/molecules/NewCategoryRow";
import { RecategorizationRow } from "@/components/molecules/RecategorizationRow";
import { TransactionEmojiRow } from "@/components/molecules/TransactionEmojiRow";
import type { OrganizePreview, OrganizeSelection } from "./types";

type OrganizeReviewSheetProps = {
  open: boolean;
  preview: OrganizePreview | null;
  applying: boolean;
  error?: string | null;
  applyBlocked?: boolean;
  onApply: (selection: OrganizeSelection) => void;
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
};

export function OrganizeReviewSheet({ open, preview, applying, error = null, applyBlocked = false, onApply, onClose, returnFocusRef }: OrganizeReviewSheetProps) {
  if (!open || !preview) return null;
  return <OpenOrganizeReviewSheet preview={preview} applying={applying} error={error} applyBlocked={applyBlocked} onApply={onApply} onClose={onClose} returnFocusRef={returnFocusRef} />;
}

function OpenOrganizeReviewSheet({ preview, applying, error, applyBlocked, onApply, onClose, returnFocusRef }: Omit<OrganizeReviewSheetProps, "open" | "preview"> & { preview: OrganizePreview }) {
  const merges = preview.category_merges ?? [];
  const moves = preview.category_moves ?? [];
  const snapshot = new Map((preview.category_snapshot ?? []).map((category) => [category.id, category]));
  function makeSelection(checked: boolean) {
    return {
      cats: new Set<string | number>(checked ? preview.new_categories.map((category) => category.temp_id) : []),
      txns: new Set<string | number>(checked ? preview.recategorizations.map((move) => move.transaction_id) : []),
      emojiTxns: new Set<string | number>(checked ? preview.emoji_reassignments.map((assignment) => assignment.transaction_id) : []),
      emojiCats: new Set<string | number>(checked ? preview.emoji_assignments.map((assignment) => assignment.category_id) : []),
      merges: new Set<string | number>(checked ? merges.map((merge) => merge.source_category_id) : []),
      tree: checked && moves.length > 0,
    };
  }
  const [selection, setSelection] = useState(() => makeSelection(true));
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previousFocus = returnFocusRef?.current ?? document.activeElement;
    const dialog = dialogRef.current;
    dialog?.showModal();
    const containFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !dialog) return;
      const controls = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]')];
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    };
    dialog?.addEventListener("keydown", containFocus);
    return () => {
      dialog?.removeEventListener("keydown", containFocus);
      if (dialog?.open) dialog.close();
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [returnFocusRef]);

  function toggle(key: Exclude<keyof typeof selection, "tree">, id: number | string, checked: boolean) {
    setSelection((previous) => {
      const next = { ...previous, [key]: new Set(checked ? [...previous[key], id] : [...previous[key]].filter((item) => item !== id)) };
      if (key === "cats" && !checked) {
        const dependentIds = new Set(preview.recategorizations.filter((move) => move.suggested_category_id === id).map((move) => move.transaction_id));
        next.txns = new Set([...previous.txns].filter((transactionId) => typeof transactionId !== "number" || !dependentIds.has(transactionId)));
      }
      if (key === "txns" && checked) {
        const target = preview.recategorizations.find((move) => move.transaction_id === id)?.suggested_category_id;
        if (typeof target === "string") next.cats = new Set([...previous.cats, target]);
      }
      return next;
    });
  }

  const hasAnything = merges.length + moves.length + preview.new_categories.length +
    preview.emoji_assignments.length + preview.recategorizations.length + preview.emoji_reassignments.length > 0;
  const hasSelection = selection.cats.size + selection.txns.size + selection.emojiTxns.size +
    selection.emojiCats.size + selection.merges.size + Number(selection.tree) > 0;

  function handleApply() {
    if (applying || applyBlocked || !hasSelection) return;
    onApply({
      category_snapshot: preview.category_snapshot ?? [],
      category_merges: merges.filter((merge) => selection.merges.has(merge.source_category_id)),
      category_moves: selection.tree ? moves : [],
      new_categories: preview.new_categories.filter((category) => selection.cats.has(category.temp_id)),
      emoji_assignments: preview.emoji_assignments.filter((assignment) => selection.emojiCats.has(assignment.category_id)),
      recategorizations: preview.recategorizations.filter((move) => selection.txns.has(move.transaction_id)),
      emoji_reassignments: preview.emoji_reassignments.filter((assignment) => selection.emojiTxns.has(assignment.transaction_id)),
    });
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="organize-review-title"
      aria-busy={applying}
      onCancel={(event) => { event.preventDefault(); if (!applying) onClose(); }}
      className="fixed inset-x-0 bottom-0 top-auto m-0 w-full max-w-none border-0 bg-transparent p-0 text-ink backdrop:bg-surface-black/40 sm:inset-0 sm:m-auto sm:max-w-[720px]"
    >
      <div className="flex max-h-[80dvh] flex-col overflow-hidden rounded-t-2xl bg-canvas sm:rounded-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-hairline px-4 py-3">
          <h2 id="organize-review-title" className="font-display text-lg font-semibold">Xem lại đề xuất tổ chức</h2>
          <button type="button" onClick={onClose} disabled={applying} className="min-h-11 px-3 font-body text-sm text-primary disabled:opacity-60">Đóng</button>
        </div>
        <fieldset disabled={applying} className="min-h-0 flex-1 overflow-y-auto border-0 p-0">
          {!hasAnything ? <p className="px-4 py-8 text-center font-body text-sm text-ink-muted-48">Không có đề xuất tổ chức mới.</p> : <>
            <div className="flex gap-3 px-4">
              <button type="button" onClick={() => setSelection(makeSelection(true))} className="min-h-11 text-sm text-primary">Chọn tất cả</button>
              <button type="button" onClick={() => setSelection(makeSelection(false))} className="min-h-11 text-sm text-primary">Bỏ chọn tất cả</button>
            </div>
            {merges.length > 0 && <section>
              <OrganizeSectionHeader title="Hợp nhất danh mục" count={merges.length} />
              {merges.map((merge) => <RecategorizationRow
                key={merge.source_category_id}
                transactionId={merge.source_category_id}
                note={`Hợp nhất ${merge.source_category_name}`}
                currentCategory={merge.source_category_name}
                suggestedCategory={merge.target_category_name}
                reason={`${merge.transaction_count} giao dịch sẽ được chuyển, bao gồm lịch sử và giao dịch không có ghi chú. Danh mục nguồn sẽ bị xóa. ${merge.reason}`}
                checked={selection.merges.has(merge.source_category_id)}
                onChange={(id, checked) => toggle("merges", id, checked)}
              />)}
            </section>}
            {moves.length > 0 && <section>
              <OrganizeSectionHeader title="Sắp xếp cây danh mục" count={moves.length} />
              <label className="flex min-h-11 items-center gap-3 px-4 text-sm">
                <input type="checkbox" checked={selection.tree} onChange={(event) => setSelection((previous) => ({ ...previous, tree: event.target.checked }))} className="accent-primary" />
                Áp dụng nhóm thay đổi cấu trúc
              </label>
              <p className="px-4 pb-2 text-sm text-ink-muted-48">Các thay đổi được chọn cùng nhau để giữ cây danh mục hợp lệ.</p>
              {moves.map((move) => {
                const current = snapshot.get(move.category_id);
                const currentParent = current?.parent_id ? snapshot.get(current.parent_id)?.name : null;
                return <div key={move.category_id} className="break-words px-4 py-2 font-body">
                  <p className="text-base text-ink">{move.category_name}</p>
                  <p className="text-sm text-ink-muted-80">{currentParent ?? "Cấp gốc"}, thứ tự {(current?.sort_order ?? 0) + 1} → {move.parent_category_name ?? "Cấp gốc"}, thứ tự {move.sort_order + 1}</p>
                  <p className="text-sm text-ink-muted-48">{move.reason}</p>
                </div>;
              })}
            </section>}
            {preview.new_categories.length > 0 && <section>
              <OrganizeSectionHeader title="Danh mục mới" count={preview.new_categories.length} />
              {preview.new_categories.map((category) => <NewCategoryRow key={category.temp_id} tempId={category.temp_id} name={category.name} emoji={category.emoji} type={category.type} exampleNotes={category.example_notes} checked={selection.cats.has(category.temp_id)} onChange={(id, checked) => toggle("cats", id, checked)} />)}
            </section>}
            {preview.emoji_assignments.length > 0 && <section>
              <OrganizeSectionHeader title="Emoji danh mục" count={preview.emoji_assignments.length} />
              {preview.emoji_assignments.map((assignment) => <label key={assignment.category_id} className="flex min-h-11 items-center gap-3 px-4 py-2 font-body text-base text-ink">
                <input type="checkbox" checked={selection.emojiCats.has(assignment.category_id)} onChange={(event) => toggle("emojiCats", assignment.category_id, event.target.checked)} aria-label={`Gán ${assignment.emoji} cho danh mục ${assignment.category_name}`} className="accent-primary" />
                <span className="min-w-0 flex-1 break-words">{assignment.category_name}</span>
                <span aria-hidden="true" className="text-lg">{assignment.emoji}</span>
              </label>)}
            </section>}
            {preview.recategorizations.length > 0 && <section>
              <OrganizeSectionHeader title="Phân loại lại" count={preview.recategorizations.length} />
              {preview.recategorizations.map((move) => <RecategorizationRow key={move.transaction_id} transactionId={move.transaction_id} note={move.note} currentCategory={move.current_category_name} suggestedCategory={move.suggested_category_name} isNewCategory={typeof move.suggested_category_id === "string"} reason={move.reason} checked={selection.txns.has(move.transaction_id)} onChange={(id, checked) => toggle("txns", id, checked)} />)}
            </section>}
            {preview.emoji_reassignments.length > 0 && <section>
              <OrganizeSectionHeader title="Thay emoji giao dịch" count={preview.emoji_reassignments.length} />
              {preview.emoji_reassignments.map((assignment) => <TransactionEmojiRow key={assignment.transaction_id} transactionId={assignment.transaction_id} note={assignment.note} currentEmoji={assignment.current_emoji} suggestedEmoji={assignment.emoji} reason={assignment.reason} checked={selection.emojiTxns.has(assignment.transaction_id)} onChange={(id, checked) => toggle("emojiTxns", id, checked)} />)}
            </section>}
          </>}
        </fieldset>
        <div className="shrink-0 border-t border-hairline px-4 pt-3 pb-[max(24px,env(safe-area-inset-bottom))]">
          {error && <p role="alert" className="mb-3 break-words text-sm text-danger">{error}</p>}
          <button type="button" onClick={handleApply} disabled={applying || applyBlocked || !hasSelection} aria-busy={applying} className="min-h-11 w-full rounded-xl bg-primary px-4 py-3 font-body text-base font-semibold text-on-primary disabled:cursor-default disabled:bg-canvas-parchment disabled:text-ink-muted-48">
            {applying ? "Đang áp dụng…" : hasSelection ? "Áp dụng" : "Chưa chọn thay đổi"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
