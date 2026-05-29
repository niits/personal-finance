"use client";

import { useState } from "react";
import { EmojiPicker } from "@/components/organisms/EmojiPicker";

// ── Types ──────────────────────────────────────────────────────────────────

export type Category = {
  id: number;
  name: string;
  emoji: string | null;
  level: number;
  type: "income" | "expense";
  parent_id: number | null;
  children: Category[];
};

export type Suggestion = {
  name: string;
  type: "income" | "expense";
  parent_category_id: number | null;
  parent_category_name: string | null;
  example_notes: string[];
  transaction_count: number;
};

export type RecategorizeSuggestion = {
  transaction_id: number;
  note: string;
  current_category_id: number;
  current_category_name: string;
  suggested_category_id: number;
  suggested_category_name: string;
  reason: string;
};

export type CategoriesTemplateProps = {
  categories: Category[];
  loading: boolean;
  suggestions: Suggestion[] | null;
  suggestState: "loading" | "done" | "error" | "idle";
  recatSuggestions: RecategorizeSuggestion[] | null;
  recatState: "loading" | "done" | "error" | "idle";
  onAddCategory: (name: string, emoji: string | null, parentId: number | null, type: "income" | "expense") => Promise<{ error?: string }>;
  onEditCategory: (id: number, name: string, emoji: string | null) => Promise<{ error?: string }>;
  onDeleteCategory: (id: number) => Promise<{ error?: string }>;
  onAcceptSuggestion: (suggestion: Suggestion) => Promise<{ error?: string }>;
  onAcceptRecat: (s: RecategorizeSuggestion) => Promise<{ error?: string }>;
  onLoadSuggestions: () => void;
  onLoadRecatSuggestions: () => void;
  fillEmojiState: "idle" | "loading" | "done" | "error";
  onFillEmoji: () => void;
};

// ── Helpers ────────────────────────────────────────────────────────────────

function getParentType(cats: Category[], parentId: number | null): "income" | "expense" | null {
  if (parentId === null) return null;
  for (const c of cats) {
    if (c.id === parentId) return c.type;
    for (const cc of c.children) {
      if (cc.id === parentId) return cc.type;
    }
  }
  return null;
}

// ── Shared button styles ───────────────────────────────────────────────────

const primaryBtnStyle: React.CSSProperties = {
  padding: "12px 20px",
  borderRadius: 11,
  border: "none",
  background: "var(--primary)",
  color: "#fff",
  fontFamily: "var(--font-body)",
  fontSize: 15,
  fontWeight: 400,
  cursor: "pointer",
};

const ghostBtnStyle: React.CSSProperties = {
  padding: "12px 20px",
  borderRadius: 11,
  border: "1px solid var(--hairline)",
  background: "var(--canvas-parchment)",
  color: "var(--ink-muted-48)",
  fontFamily: "var(--font-body)",
  fontSize: 15,
  cursor: "pointer",
};

// ── Template ───────────────────────────────────────────────────────────────

export function CategoriesTemplate({
  categories,
  loading,
  suggestions,
  suggestState,
  recatSuggestions,
  recatState,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
  onAcceptSuggestion,
  onAcceptRecat,
  onLoadSuggestions,
  onLoadRecatSuggestions,
  fillEmojiState,
  onFillEmoji,
}: CategoriesTemplateProps) {
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState<string | null>(null);
  const [parentId, setParentId] = useState<number | null>(null);
  const [newType, setNewType] = useState<"income" | "expense">("expense");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  // AI suggest sheet
  const [showSuggest, setShowSuggest] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [applying, setApplying] = useState(false);
  const [recatSelected, setRecatSelected] = useState<Set<number>>(new Set());
  const [applyingRecat, setApplyingRecat] = useState(false);

  const inheritedType = getParentType(categories, parentId);
  const resolvedType = inheritedType ?? newType;

  const flatCats = categories.flatMap((c) => [
    c,
    ...c.children.map((cc) => ({ ...cc, children: [] })),
  ]).filter((c) => c.level < 3);

  async function save() {
    if (!newName.trim()) return;
    setSaving(true);
    setError("");
    const result = await onAddCategory(newName.trim(), newEmoji, parentId, resolvedType);
    if (result.error) { setError(result.error); setSaving(false); return; }
    setNewName("");
    setNewEmoji(null);
    setParentId(null);
    setShowForm(false);
    setSaving(false);
  }

  function openSuggest() {
    setShowSuggest(true);
    setSelected(new Set());
    setRecatSelected(new Set());
    onLoadSuggestions();
    onFillEmoji();
  }

  function closeSheet() {
    setShowSuggest(false);
    setSelected(new Set());
    setRecatSelected(new Set());
  }

  async function applySelected() {
    if (!suggestions) return;
    const toCreate = suggestions.filter((_, i) => selected.has(i));
    setApplying(true);
    for (const s of toCreate) {
      await onAcceptSuggestion(s);
    }
    setApplying(false);
    // After applying, load recat suggestions
    setRecatSelected(new Set());
    onLoadRecatSuggestions();
  }

  async function applyRecategorize() {
    if (!recatSuggestions) return;
    const toApply = recatSuggestions.filter((_, i) => recatSelected.has(i));
    if (toApply.length === 0) { closeSheet(); return; }
    setApplyingRecat(true);
    for (const s of toApply) {
      await onAcceptRecat(s);
    }
    setApplyingRecat(false);
    closeSheet();
  }

  function renderCategory(cat: Category, depth = 0): React.ReactNode {
    return (
      <div key={cat.id}>
        <div style={{
          display: "flex",
          alignItems: "center",
          padding: "12px 20px",
          paddingLeft: 20 + depth * 20,
          borderBottom: "1px solid var(--hairline)",
          background: "var(--canvas)",
        }}>
          <span style={{
            fontFamily: "var(--font-body)",
            fontSize: 17,
            color: "var(--ink)",
            letterSpacing: -0.374,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}>
            {depth > 0 && <span style={{ color: "var(--ink-muted-48)" }}>└</span>}
            {cat.emoji && <span style={{ fontSize: 18 }}>{cat.emoji + "️"}</span>}
            {cat.name}
          </span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
            {depth === 0 && (
              <span style={{
                fontSize: 11,
                color: cat.type === "income" ? "#34c759" : "var(--primary)",
                fontFamily: "var(--font-body)",
                background: cat.type === "income" ? "rgba(52,199,89,0.1)" : "rgba(0,102,204,0.08)",
                padding: "2px 8px",
                borderRadius: 999,
              }}>
                {cat.type === "income" ? "Thu nhập" : "Chi tiêu"}
              </span>
            )}
            <span style={{
              fontSize: 11,
              color: "var(--ink-muted-48)",
              fontFamily: "var(--font-body)",
              background: "var(--canvas-parchment)",
              padding: "2px 8px",
              borderRadius: 999,
            }}>
              Cấp {cat.level}
            </span>
          </div>
        </div>
        {cat.children?.map((child) => renderCategory(child, depth + 1))}
      </div>
    );
  }

  function renderSuggestSheet() {
    if (suggestState === "loading") {
      return (
        <div style={{ padding: "40px 22px", textAlign: "center" }}>
          <p style={{ fontFamily: "var(--font-body)", fontSize: 15, color: "var(--ink-muted-48)" }}>
            Đang phân tích giao dịch…
          </p>
        </div>
      );
    }

    if (suggestState === "error") {
      return (
        <div style={{ padding: "32px 22px", textAlign: "center" }}>
          <p style={{ fontFamily: "var(--font-body)", fontSize: 15, color: "#ff453a" }}>
            Không thể phân tích lúc này. Thử lại sau.
          </p>
        </div>
      );
    }

    if (recatState === "loading") {
      return (
        <div style={{ padding: "40px 22px", textAlign: "center" }}>
          <p style={{ fontFamily: "var(--font-body)", fontSize: 15, color: "var(--ink-muted-48)" }}>
            Đang kiểm tra danh mục giao dịch…
          </p>
        </div>
      );
    }

    if (recatState === "error") {
      return (
        <div style={{ padding: "32px 22px", textAlign: "center" }}>
          <p style={{ fontFamily: "var(--font-body)", fontSize: 15, color: "#ff453a", marginBottom: 16 }}>
            Không thể kiểm tra danh mục lúc này.
          </p>
          <button onClick={closeSheet} style={ghostBtnStyle}>Đóng</button>
        </div>
      );
    }

    if (recatState === "done") {
      const recs = recatSuggestions ?? [];
      if (recs.length === 0) {
        return (
          <div style={{ padding: "32px 22px", textAlign: "center" }}>
            <p style={{ fontFamily: "var(--font-body)", fontSize: 15, color: "var(--ink-muted-48)", marginBottom: 20 }}>
              Tất cả giao dịch đã có danh mục phù hợp
            </p>
            <button onClick={closeSheet} style={primaryBtnStyle}>Xong</button>
          </div>
        );
      }

      const selectedCount = recatSelected.size;
      return (
        <div>
          <div style={{ padding: "16px 20px 8px", borderBottom: "1px solid var(--hairline)" }}>
            <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--ink-muted-48)" }}>
              Đề xuất đổi danh mục cho {recs.length} giao dịch
            </p>
          </div>
          <div style={{ overflowY: "auto", maxHeight: 340 }}>
            {recs.map((s, i) => (
              <div
                key={`${s.transaction_id}-${s.suggested_category_id}`}
                onClick={() => {
                  const next = new Set(recatSelected);
                  if (next.has(i)) next.delete(i); else next.add(i);
                  setRecatSelected(next);
                }}
                style={{
                  padding: "14px 20px",
                  borderBottom: "1px solid var(--hairline)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  background: recatSelected.has(i) ? "rgba(0,102,204,0.04)" : "var(--canvas)",
                }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 2,
                  background: recatSelected.has(i) ? "var(--primary)" : "transparent",
                  border: `1.5px solid ${recatSelected.has(i) ? "var(--primary)" : "var(--hairline)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {recatSelected.has(i) && (
                    <svg width="11" height="8" viewBox="0 0 11 8" fill="none">
                      <path d="M1 4l3 3 6-6" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontFamily: "var(--font-body)", fontSize: 15, color: "var(--ink)",
                    letterSpacing: -0.374, marginBottom: 4,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    &ldquo;{s.note}&rdquo;
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--ink-muted-48)" }}>
                      {s.current_category_name}
                    </span>
                    <span style={{ color: "var(--ink-muted-48)", fontSize: 12 }}>→</span>
                    <span style={{ fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 600, color: "var(--primary)" }}>
                      {s.suggested_category_name}
                    </span>
                  </div>
                  <p style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--ink-muted-48)", fontStyle: "italic" }}>
                    {s.reason}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: "14px 20px", display: "flex", gap: 10 }}>
            <button onClick={closeSheet} style={{ ...ghostBtnStyle, flex: 1 }}>Bỏ qua</button>
            <button
              onClick={applyRecategorize}
              disabled={applyingRecat || selectedCount === 0}
              style={{ ...primaryBtnStyle, flex: 2, opacity: selectedCount === 0 ? 0.4 : 1 }}
            >
              {applyingRecat ? "Đang đổi…" : `Đổi ${selectedCount} giao dịch`}
            </button>
          </div>
        </div>
      );
    }

    // suggestState === "done" — show suggestions
    const suggs = suggestions ?? [];
    if (suggs.length === 0) {
      return (
        <div style={{ padding: "32px 22px", textAlign: "center" }}>
          <p style={{ fontFamily: "var(--font-body)", fontSize: 15, color: "var(--ink-muted-48)", marginBottom: 20 }}>
            Danh mục hiện tại đã phù hợp với lịch sử giao dịch
          </p>
          <button onClick={closeSheet} style={primaryBtnStyle}>Xong</button>
        </div>
      );
    }

    const selectedCount = selected.size;
    return (
      <div>
        <div style={{ padding: "16px 20px 8px", borderBottom: "1px solid var(--hairline)" }}>
          <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--ink-muted-48)" }}>
            {suggs.length} danh mục được gợi ý
          </p>
        </div>
        <div style={{ overflowY: "auto", maxHeight: 340 }}>
          {suggs.map((s, i) => (
            <div
              key={`${s.name}-${s.parent_category_id ?? 'root'}`}
              onClick={() => {
                const next = new Set(selected);
                if (next.has(i)) next.delete(i); else next.add(i);
                setSelected(next);
              }}
              style={{
                padding: "14px 20px",
                borderBottom: "1px solid var(--hairline)",
                cursor: "pointer",
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                background: selected.has(i) ? "rgba(0,102,204,0.04)" : "var(--canvas)",
              }}
            >
              <div style={{
                width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 2,
                background: selected.has(i) ? "var(--primary)" : "transparent",
                border: `1.5px solid ${selected.has(i) ? "var(--primary)" : "var(--hairline)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {selected.has(i) && (
                  <svg width="11" height="8" viewBox="0 0 11 8" fill="none">
                    <path d="M1 4l3 3 6-6" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{
                    fontFamily: "var(--font-body)", fontSize: 16, fontWeight: 600,
                    color: "var(--ink)", letterSpacing: -0.374,
                  }}>
                    {s.parent_category_name && (
                      <span style={{ color: "var(--ink-muted-48)", fontWeight: 400 }}>
                        └ {s.parent_category_name} / {" "}
                      </span>
                    )}
                    {s.name}
                  </span>
                  <span style={{
                    fontSize: 11,
                    color: s.type === "income" ? "#34c759" : "var(--primary)",
                    background: s.type === "income" ? "rgba(52,199,89,0.1)" : "rgba(0,102,204,0.08)",
                    padding: "2px 7px", borderRadius: 999,
                    fontFamily: "var(--font-body)",
                  }}>
                    {s.type === "income" ? "Thu nhập" : "Chi tiêu"}
                  </span>
                </div>
                <p style={{
                  fontFamily: "var(--font-body)", fontSize: 12,
                  color: "var(--ink-muted-48)", fontStyle: "italic", marginBottom: 2,
                }}>
                  {s.example_notes.join(" · ")}
                </p>
                <p style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--ink-muted-48)" }}>
                  ~{s.transaction_count} giao dịch
                </p>
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: "14px 20px", display: "flex", gap: 10 }}>
          <button onClick={closeSheet} style={{ ...ghostBtnStyle, flex: 1 }}>Huỷ</button>
          <button
            onClick={applySelected}
            disabled={applying || selectedCount === 0}
            style={{ ...primaryBtnStyle, flex: 2, opacity: selectedCount === 0 ? 0.4 : 1 }}
          >
            {applying ? "Đang thêm…" : `Thêm ${selectedCount} danh mục`}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{
        background: "var(--surface-black)",
        padding: "28px 22px 20px",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
      }}>
        <div>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-body)", marginBottom: 4 }}>
            Bước 1
          </p>
          <h1 style={{
            fontFamily: "var(--font-display)",
            fontSize: 28,
            fontWeight: 600,
            color: "var(--on-dark)",
            letterSpacing: -0.28,
          }}>
            Danh mục
          </h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={openSuggest}
            style={{
              background: "transparent",
              color: "rgba(255,255,255,0.75)",
              border: "1px solid rgba(255,255,255,0.25)",
              borderRadius: 999,
              padding: "8px 16px",
              fontFamily: "var(--font-body)",
              fontSize: 14,
              fontWeight: 400,
              cursor: "pointer",
            }}
          >
            ✦ Gợi ý
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            style={{
              background: "var(--primary)",
              color: "#fff",
              border: "none",
              borderRadius: 999,
              padding: "8px 18px",
              fontFamily: "var(--font-body)",
              fontSize: 14,
              fontWeight: 400,
              cursor: "pointer",
            }}
          >
            + Thêm
          </button>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <div style={{
          background: "var(--canvas)",
          padding: "20px",
          borderBottom: "1px solid var(--hairline)",
        }}>
          <p style={{
            fontFamily: "var(--font-body)",
            fontSize: 14,
            fontWeight: 600,
            color: "var(--ink)",
            marginBottom: 12,
          }}>
            Danh mục mới
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <EmojiPicker value={newEmoji} onChange={setNewEmoji} suggestForName={newName} />
              <input
                placeholder="Tên danh mục"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && save()}
                style={{
                  flex: 1,
                  padding: "11px 16px",
                  borderRadius: 11,
                  border: "1px solid var(--hairline)",
                  fontFamily: "var(--font-body)",
                  fontSize: 17,
                  color: "var(--ink)",
                  background: "var(--canvas-parchment)",
                  outline: "none",
                  letterSpacing: -0.374,
                }}
              />
            </div>

            <select
              value={parentId ?? ""}
              onChange={(e) => setParentId(e.target.value ? Number(e.target.value) : null)}
              style={{
                width: "100%",
                padding: "11px 16px",
                borderRadius: 11,
                border: "1px solid var(--hairline)",
                fontFamily: "var(--font-body)",
                fontSize: 15,
                color: parentId ? "var(--ink)" : "var(--ink-muted-48)",
                background: "var(--canvas-parchment)",
                outline: "none",
                appearance: "none",
              }}
            >
              <option value="">Không có danh mục cha (cấp 1)</option>
              {flatCats.map((c) => (
                <option key={c.id} value={c.id}>
                  {"  ".repeat(c.level - 1)}{c.level > 1 ? "└ " : ""}{c.name} (cấp {c.level + 1})
                </option>
              ))}
            </select>

            {parentId === null ? (
              <div style={{ display: "flex", gap: 8 }}>
                {(["expense", "income"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setNewType(t)}
                    style={{
                      flex: 1,
                      padding: "9px",
                      borderRadius: 11,
                      border: `1px solid ${newType === t ? "var(--primary)" : "var(--hairline)"}`,
                      background: newType === t ? "rgba(0,102,204,0.08)" : "var(--canvas-parchment)",
                      color: newType === t ? "var(--primary)" : "var(--ink-muted-48)",
                      fontFamily: "var(--font-body)",
                      fontSize: 14,
                      fontWeight: newType === t ? 600 : 400,
                      cursor: "pointer",
                    }}
                  >
                    {t === "expense" ? "Chi tiêu" : "Thu nhập"}
                  </button>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 12, color: "var(--ink-muted-48)", fontFamily: "var(--font-body)", paddingLeft: 4 }}>
                Phân loại: <strong>{resolvedType === "expense" ? "Chi tiêu" : "Thu nhập"}</strong> (kế thừa từ danh mục cha)
              </p>
            )}

            {error && (
              <p style={{ color: "#ff453a", fontSize: 13, fontFamily: "var(--font-body)" }}>
                {error}
              </p>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => { setShowForm(false); setError(""); }}
                style={{
                  flex: 1,
                  padding: "11px",
                  borderRadius: 11,
                  border: "1px solid var(--hairline)",
                  background: "var(--canvas-parchment)",
                  fontFamily: "var(--font-body)",
                  fontSize: 15,
                  color: "var(--ink-muted-48)",
                  cursor: "pointer",
                }}
              >
                Huỷ
              </button>
              <button
                onClick={save}
                disabled={saving || !newName.trim()}
                style={{
                  flex: 2,
                  padding: "11px",
                  borderRadius: 11,
                  border: "none",
                  background: newName.trim() ? "var(--primary)" : "var(--hairline)",
                  color: newName.trim() ? "#fff" : "var(--ink-muted-48)",
                  fontFamily: "var(--font-body)",
                  fontSize: 15,
                  fontWeight: 400,
                  cursor: newName.trim() ? "pointer" : "not-allowed",
                  transition: "background 0.15s",
                }}
              >
                {saving ? "Đang lưu…" : "Lưu"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category list */}
      <div style={{ marginTop: 1 }}>
        {loading ? (
          <div style={{ padding: "40px 22px", textAlign: "center", color: "var(--ink-muted-48)", fontFamily: "var(--font-body)", fontSize: 14 }}>
            Đang tải…
          </div>
        ) : categories.length === 0 ? (
          <div style={{ padding: "40px 22px", textAlign: "center" }}>
            <p style={{ fontFamily: "var(--font-display)", fontSize: 21, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>
              Chưa có danh mục
            </p>
            <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--ink-muted-48)", marginBottom: 24 }}>
              Tạo thủ công hoặc dùng bộ danh mục mẫu
            </p>
            <button
              onClick={() => onAddCategory("_seed_", null, null, "expense")}
              disabled={saving}
              style={{
                background: "var(--primary)",
                color: "#fff",
                border: "none",
                borderRadius: 999,
                padding: "12px 24px",
                fontFamily: "var(--font-body)",
                fontSize: 15,
                fontWeight: 400,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? "Đang tạo…" : "Tạo danh mục mẫu"}
            </button>
          </div>
        ) : (
          categories.map((c) => renderCategory(c))
        )}
      </div>

      {categories.length > 0 && (
        <div style={{ padding: "16px 22px" }}>
          <p style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--ink-muted-48)", lineHeight: 1.5 }}>
            Tối đa 3 cấp. Chỉ danh mục không có danh mục con mới có thể gán vào giao dịch.
          </p>
        </div>
      )}

      {/* AI suggest bottom sheet */}
      {showSuggest && (
        <>
          <div
            onClick={closeSheet}
            style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
              zIndex: 100,
            }}
          />
          <div style={{
            position: "fixed", bottom: 0, left: 0, right: 0,
            background: "var(--canvas)",
            borderRadius: "16px 16px 0 0",
            zIndex: 101,
            maxHeight: "80vh",
            display: "flex",
            flexDirection: "column",
          }}>
            <div style={{
              padding: "12px 20px 0",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
            }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--hairline)" }} />
              <div style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingBottom: 12,
                borderBottom: "1px solid var(--hairline)",
              }}>
                <span style={{ fontFamily: "var(--font-body)", fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>
                  {recatState === "done" || recatState === "loading" || recatState === "error"
                    ? "Kiểm tra danh mục"
                    : "✦ Gợi ý danh mục"}
                </span>
                <button
                  onClick={closeSheet}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "var(--ink-muted-48)", fontSize: 20, lineHeight: 1,
                    padding: "0 4px",
                  }}
                >
                  ×
                </button>
              </div>
            </div>
            <div style={{ overflowY: "auto", flex: 1 }}>
              {renderSuggestSheet()}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
