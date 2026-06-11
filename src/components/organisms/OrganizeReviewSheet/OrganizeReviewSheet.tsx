"use client";

import { useState, useEffect } from "react";
import { OrganizeSectionHeader } from "@/components/molecules/OrganizeSectionHeader";
import { NewCategoryRow } from "@/components/molecules/NewCategoryRow";
import { RecategorizationRow } from "@/components/molecules/RecategorizationRow";
import { TransactionEmojiRow } from "@/components/molecules/TransactionEmojiRow";
import type { OrganizePreview, OrganizeSelection } from "./types";

type OrganizeReviewSheetProps = {
  open: boolean;
  preview: OrganizePreview | null;
  applying: boolean;
  onApply: (selection: OrganizeSelection) => void;
  onClose: () => void;
};

export function OrganizeReviewSheet({ open, preview, applying, onApply, onClose }: OrganizeReviewSheetProps) {
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());
  const [selectedTxns, setSelectedTxns] = useState<Set<number>>(new Set());
  const [selectedEmojiTxns, setSelectedEmojiTxns] = useState<Set<number>>(new Set());

  // Reset selection whenever a new preview arrives
  useEffect(() => {
    if (preview) {
      setSelectedCats(new Set(preview.new_categories.map((c) => c.temp_id)));
      setSelectedTxns(new Set(preview.recategorizations.map((r) => r.transaction_id)));
      setSelectedEmojiTxns(new Set(preview.emoji_reassignments.map((r) => r.transaction_id)));
    }
  }, [preview]);

  if (!open) return null;

  function handleApply() {
    if (!preview) return;
    onApply({
      new_categories: preview.new_categories.filter((c) => selectedCats.has(c.temp_id)),
      emoji_assignments: preview.emoji_assignments,
      recategorizations: preview.recategorizations.filter((r) => selectedTxns.has(r.transaction_id)),
      emoji_reassignments: preview.emoji_reassignments.filter((r) => selectedEmojiTxns.has(r.transaction_id)),
    });
  }

  const hasAnything = preview && (
    preview.new_categories.length > 0 ||
    preview.emoji_assignments.length > 0 ||
    preview.recategorizations.length > 0 ||
    preview.emoji_reassignments.length > 0
  );

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
            Xem lại thay đổi AI ✦
          </p>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
          {!hasAnything ? (
            <div style={{ padding: "32px 16px", textAlign: "center" }}>
              <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--ink-muted-48)" }}>
                Không có thay đổi nào để đề xuất.
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
                      type={cat.type}
                      exampleNotes={cat.example_notes}
                      checked={selectedCats.has(cat.temp_id)}
                      onChange={(id, checked) =>
                        setSelectedCats((prev) => {
                          const next = new Set(prev);
                          if (checked) next.add(id); else next.delete(id);
                          return next;
                        })
                      }
                    />
                  ))}
                </section>
              )}

              {(preview?.emoji_assignments.length ?? 0) > 0 && (
                <section>
                  <OrganizeSectionHeader
                    title="Emoji"
                    count={preview!.emoji_assignments.length}
                    autoIncluded
                  />
                  <p style={{ padding: "4px 16px 10px", fontFamily: "var(--font-body)", fontSize: 14, color: "var(--ink-muted-48)" }}>
                    Sẽ gán emoji cho {preview!.emoji_assignments.length} danh mục.
                  </p>
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
                      onChange={(id, checked) =>
                        setSelectedTxns((prev) => {
                          const next = new Set(prev);
                          if (checked) next.add(id); else next.delete(id);
                          return next;
                        })
                      }
                    />
                  ))}
                </section>
              )}

              {(preview?.emoji_reassignments.length ?? 0) > 0 && (
                <section>
                  <OrganizeSectionHeader title="Đổi emoji giao dịch" count={preview!.emoji_reassignments.length} />
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
          <button type="button"
            onClick={handleApply}
            disabled={applying || !hasAnything}
            className={`w-full p-[14px] rounded-xl border-none font-body text-[17px] font-semibold flex items-center justify-center gap-2 tracking-[-0.4px] ${
              applying || !hasAnything
                ? "bg-canvas-parchment text-ink-muted-48 cursor-default"
                : "bg-primary text-white cursor-pointer"
            }`}
          >
            {applying ? "Đang áp dụng…" : "Áp dụng"}
          </button>
        </div>
      </div>
    </>
  );
}
