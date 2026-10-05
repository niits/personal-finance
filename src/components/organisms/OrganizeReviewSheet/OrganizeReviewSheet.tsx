"use client";

import { useState } from "react";
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
};

export function OrganizeReviewSheet({ open, preview, applying, error = null, applyBlocked = false, onApply, onClose }: OrganizeReviewSheetProps) {
  if (!open || !preview) return null;
  return <OpenOrganizeReviewSheet preview={preview} applying={applying} error={error} applyBlocked={applyBlocked} onApply={onApply} onClose={onClose} />;
}

function OpenOrganizeReviewSheet({ preview, applying, error, applyBlocked, onApply, onClose }: Omit<OrganizeReviewSheetProps, "open" | "preview"> & { preview: OrganizePreview }) {
  const [selectedCats, setSelectedCats] = useState<Set<string>>(
    () => new Set(preview.new_categories.map((c) => c.temp_id)),
  );
  const [selectedTxns, setSelectedTxns] = useState<Set<number>>(
    () => new Set(preview.recategorizations.map((r) => r.transaction_id)),
  );
  const [selectedEmojiTxns, setSelectedEmojiTxns] = useState<Set<number>>(
    () => new Set(preview.emoji_reassignments.map((r) => r.transaction_id)),
  );
  const [selectedEmojiCategories, setSelectedEmojiCategories] = useState<Set<number>>(
    () => new Set(preview.emoji_assignments.map((assignment) => assignment.category_id)),
  );

  function handleApply() {
    if (applying || applyBlocked) return;
    onApply({
      new_categories: preview.new_categories.filter((c) => selectedCats.has(c.temp_id)),
      emoji_assignments: preview.emoji_assignments.filter((assignment) =>
        selectedEmojiCategories.has(assignment.category_id)),
      recategorizations: preview.recategorizations.filter((r) => selectedTxns.has(r.transaction_id)),
      emoji_reassignments: preview.emoji_reassignments.filter((r) => selectedEmojiTxns.has(r.transaction_id)),
    });
  }

  function selectCategory(id: string, checked: boolean) {
    setSelectedCats((previous) => {
      const next = new Set(previous);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
    if (!checked) {
      setSelectedTxns((previous) => {
        const next = new Set(previous);
        for (const move of preview.recategorizations) {
          if (move.suggested_category_id === id) next.delete(move.transaction_id);
        }
        return next;
      });
    }
  }

  function selectMove(id: number, checked: boolean) {
    setSelectedTxns((previous) => {
      const next = new Set(previous);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
    if (checked) {
      const target = preview.recategorizations.find((move) => move.transaction_id === id)?.suggested_category_id;
      if (typeof target === "string") {
        setSelectedCats((previous) => new Set(previous).add(target));
      }
    }
  }

  const hasAnything = preview && (
    preview.new_categories.length > 0 ||
    preview.emoji_assignments.length > 0 ||
    preview.recategorizations.length > 0 ||
    preview.emoji_reassignments.length > 0
  );
  const hasSelection = selectedCats.size + selectedTxns.size +
    selectedEmojiTxns.size + selectedEmojiCategories.size > 0;

  return (
    <>
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Đóng"
        disabled={applying}
        onClick={applying ? undefined : onClose}
        style={{
          position: "fixed", inset: 0, border: "none", padding: 0, cursor: applying ? "default" : "pointer", background: "rgba(0,0,0,0.4)", zIndex: 100,
        }}
      />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-[101] bg-canvas rounded-t-2xl max-h-[80dvh] flex flex-col overflow-hidden">
        {/* Handle + title */}
        <div style={{ padding: "12px 16px 8px", flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--hairline)", margin: "0 auto 12px" }} />
          <p style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600, color: "var(--ink)", letterSpacing: -0.4 }}>
            Xem lại đề xuất phân loại ✦
          </p>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
          {!hasAnything ? (
            <div style={{ padding: "32px 16px", textAlign: "center" }}>
              <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--ink-muted-48)" }}>
                Không có đề xuất phân loại mới.
              </p>
            </div>
          ) : (
            <>
              {(preview?.new_categories.length ?? 0) > 0 && (
                <section>
                  <OrganizeSectionHeader title="Danh mục mới" count={preview!.new_categories.length} />
                  {preview!.new_categories.map((cat) => (
                    <NewCategoryRow
                      key={cat.temp_id}
                      tempId={cat.temp_id}
                      name={cat.name}
                      emoji={cat.emoji}
                      type={cat.type}
                      exampleNotes={cat.example_notes}
                      checked={selectedCats.has(cat.temp_id)}
                      onChange={selectCategory}
                    />
                  ))}
                </section>
              )}

              {(preview?.emoji_assignments.length ?? 0) > 0 && (
                <section>
                  <OrganizeSectionHeader title="Emoji danh mục" count={preview.emoji_assignments.length} />
                  {preview.emoji_assignments.map((assignment) => (
                    <label key={assignment.category_id} className="flex min-h-11 items-center gap-3 px-4 py-2 font-body text-[15px] text-ink">
                      <input
                        type="checkbox"
                        checked={selectedEmojiCategories.has(assignment.category_id)}
                        onChange={(event) => setSelectedEmojiCategories((previous) => {
                          const next = new Set(previous);
                          if (event.target.checked) next.add(assignment.category_id);
                          else next.delete(assignment.category_id);
                          return next;
                        })}
                        aria-label={`Gán ${assignment.emoji} cho danh mục ${assignment.category_name}`}
                        style={{ accentColor: "var(--primary)" }}
                      />
                      <span className="min-w-0 flex-1 break-words">{assignment.category_name}</span>
                      <span aria-hidden="true" className="text-lg">{assignment.emoji}</span>
                    </label>
                  ))}
                </section>
              )}

              {(preview?.recategorizations.length ?? 0) > 0 && (
                <section>
                  <OrganizeSectionHeader title="Phân loại lại" count={preview!.recategorizations.length} />
                  {preview!.recategorizations.map((r) => (
                    <RecategorizationRow
                      key={r.transaction_id}
                      transactionId={r.transaction_id}
                      note={r.note}
                      currentCategory={r.current_category_name}
                      suggestedCategory={r.suggested_category_name}
                      isNewCategory={typeof r.suggested_category_id === "string"}
                      reason={r.reason}
                      checked={selectedTxns.has(r.transaction_id)}
                      onChange={selectMove}
                    />
                  ))}
                </section>
              )}

              {(preview?.emoji_reassignments.length ?? 0) > 0 && (
                <section>
                  <OrganizeSectionHeader title="Thay emoji giao dịch" count={preview!.emoji_reassignments.length} />
                  {preview!.emoji_reassignments.map((r) => (
                    <TransactionEmojiRow
                      key={r.transaction_id}
                      transactionId={r.transaction_id}
                      note={r.note}
                      currentEmoji={r.current_emoji}
                      suggestedEmoji={r.emoji}
                      reason={r.reason}
                      checked={selectedEmojiTxns.has(r.transaction_id)}
                      onChange={(id, checked) =>
                        setSelectedEmojiTxns((prev) => {
                          const next = new Set(prev);
                          if (checked) next.add(id); else next.delete(id);
                          return next;
                        })
                      }
                    />
                  ))}
                </section>
              )}
            </>
          )}
        </div>

        {/* CTA */}
        <div style={{ padding: "12px 16px 28px", flexShrink: 0, borderTop: "1px solid var(--hairline)" }}>
          {error && <p role="alert" className="mb-3 text-sm text-danger">{error}</p>}
          <button type="button"
            onClick={handleApply}
            disabled={applying || applyBlocked || !hasSelection}
            aria-busy={applying}
            className={`w-full p-[14px] rounded-xl border-none font-body text-[17px] font-semibold flex items-center justify-center gap-2 tracking-[-0.4px] ${
              applying || applyBlocked || !hasSelection
                ? "bg-canvas-parchment text-ink-muted-48 cursor-default"
                : "bg-primary text-white cursor-pointer"
            }`}
          >
            {applying ? "Đang áp dụng…" : hasSelection ? "Áp dụng" : "Chưa chọn thay đổi"}
          </button>
        </div>
      </div>
    </>
  );
}
