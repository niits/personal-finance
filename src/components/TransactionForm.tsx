"use client";

import { useState, useEffect, useCallback, useRef } from "react";

type Category = {
  id: number;
  name: string;
  level: number;
  parent_id: number | null;
  children: Category[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

function fmt(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n);
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateLabel(s: string) {
  const today = todayStr();
  const yesterday = yesterdayStr();
  if (s === today) return "Hôm nay";
  if (s === yesterday) return "Hôm qua";
  const [, m, d] = s.split("-");
  return `${parseInt(d)}/${parseInt(m)}`;
}

// ─── Category Drill-Down ──────────────────────────────────────────────────────

function CategoryDrillDown({
  cats,
  selected,
  onSelect,
  onCatsChanged,
}: {
  cats: Category[];
  selected: number | null;
  onSelect: (id: number) => void;
  onCatsChanged: () => void;
}) {
  // path = [l1Id, l2Id?, l3Id?] – breadcrumb of what user has drilled into
  const [path, setPath] = useState<number[]>([]);
  const [addingAt, setAddingAt] = useState<number | null>(null); // parent_id for new cat (null = L1)
  const [newName, setNewName] = useState("");
  const [addErr, setAddErr] = useState("");
  const [addSaving, setAddSaving] = useState(false);

  // Navigate back when cats change (in case selected node was reparented)
  useEffect(() => { setPath([]); }, [cats]);

  function getCurrent(): Category[] {
    if (path.length === 0) return cats;
    let list = cats;
    for (const id of path) {
      const found = list.find((c) => c.id === id);
      if (!found) return [];
      list = found.children;
    }
    return list;
  }

  function getPathNames(): string[] {
    const names: string[] = [];
    let list = cats;
    for (const id of path) {
      const found = list.find((c) => c.id === id);
      if (!found) break;
      names.push(found.name);
      list = found.children;
    }
    return names;
  }

  async function addCategory() {
    if (!newName.trim()) return;
    setAddSaving(true);
    setAddErr("");
    const r = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), parent_id: addingAt ?? null }),
    });
    const d = await r.json() as { category?: Category; error?: string };
    if (!r.ok) { setAddErr(d.error ?? "Lỗi"); setAddSaving(false); return; }
    setNewName("");
    setAddingAt(null);
    setAddSaving(false);
    onCatsChanged();
  }

  const current = getCurrent();
  const currentParentId = path.length > 0 ? path[path.length - 1] : null;
  const pathNames = getPathNames();
  const currentLevel = path.length + 1; // 1, 2, or 3
  const canAddHere = currentLevel <= 3;

  return (
    <div>
      {/* Breadcrumb */}
      {path.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 10, flexWrap: "wrap" }}>
          <button
            onClick={() => setPath([])}
            style={{ background: "none", border: "none", color: "var(--primary)", fontSize: 13, cursor: "pointer", padding: "2px 0", fontFamily: "var(--font-body)" }}
          >
            Tất cả
          </button>
          {pathNames.map((name, i) => (
            <span key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ color: "var(--ink-muted-48)", fontSize: 12 }}>›</span>
              <button
                onClick={() => setPath(path.slice(0, i + 1))}
                style={{ background: "none", border: "none", color: i === pathNames.length - 1 ? "var(--ink)" : "var(--primary)", fontSize: 13, cursor: "pointer", padding: "2px 0", fontFamily: "var(--font-body)", fontWeight: i === pathNames.length - 1 ? 600 : 400 }}
              >
                {name}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Category list */}
      <div style={{
        borderRadius: 11,
        border: "1px solid var(--hairline)",
        overflow: "hidden",
        background: "var(--canvas)",
      }}>
        {current.length === 0 && !canAddHere && (
          <div style={{ padding: "12px 16px", color: "var(--ink-muted-48)", fontSize: 14, fontFamily: "var(--font-body)" }}>
            Không có danh mục con
          </div>
        )}

        {current.map((cat, i) => {
          const isLeaf = cat.children.length === 0;
          const isSelected = selected === cat.id;
          return (
            <div key={cat.id} style={{ borderTop: i > 0 ? "1px solid var(--hairline)" : "none" }}>
              <button
                onClick={() => {
                  if (isLeaf) {
                    onSelect(cat.id);
                  } else {
                    setPath([...path, cat.id]);
                  }
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  padding: "11px 14px",
                  background: isSelected ? "rgba(0,102,204,0.08)" : "transparent",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  gap: 10,
                }}
              >
                <span style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  border: `2px solid ${isSelected ? "var(--primary)" : "var(--hairline)"}`,
                  background: isSelected ? "var(--primary)" : "transparent",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  {isSelected && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff" }} />}
                </span>
                <span style={{
                  flex: 1,
                  fontFamily: "var(--font-body)",
                  fontSize: 15,
                  color: isSelected ? "var(--primary)" : "var(--ink)",
                  fontWeight: isSelected ? 600 : 400,
                  letterSpacing: -0.374,
                }}>
                  {cat.name}
                </span>
                {!isLeaf && (
                  <span style={{ color: "var(--ink-muted-48)", fontSize: 14 }}>›</span>
                )}
              </button>
            </div>
          );
        })}

        {/* Add inline */}
        {canAddHere && (
          <div style={{ borderTop: current.length > 0 ? "1px solid var(--hairline)" : "none" }}>
            {addingAt === currentParentId && (
              <div style={{ padding: "10px 12px", display: "flex", gap: 8 }}>
                <input
                  autoFocus
                  placeholder={`Tên danh mục cấp ${currentLevel}…`}
                  value={newName}
                  onChange={(e) => { setNewName(e.target.value); setAddErr(""); }}
                  onKeyDown={(e) => e.key === "Enter" && addCategory()}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: addErr ? "1px solid #ff453a" : "1px solid var(--hairline)",
                    fontFamily: "var(--font-body)",
                    fontSize: 14,
                    color: "var(--ink)",
                    background: "var(--canvas-parchment)",
                    outline: "none",
                  }}
                />
                <button
                  onClick={addCategory}
                  disabled={addSaving || !newName.trim()}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: "none",
                    background: newName.trim() ? "var(--primary)" : "var(--hairline)",
                    color: newName.trim() ? "#fff" : "var(--ink-muted-48)",
                    fontFamily: "var(--font-body)",
                    fontSize: 13,
                    cursor: newName.trim() ? "pointer" : "default",
                    flexShrink: 0,
                  }}
                >
                  {addSaving ? "…" : "Lưu"}
                </button>
                <button
                  onClick={() => { setAddingAt(null); setNewName(""); setAddErr(""); }}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid var(--hairline)",
                    background: "transparent",
                    color: "var(--ink-muted-48)",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  ✕
                </button>
              </div>
            )}
            {addErr && (
              <p style={{ padding: "0 12px 8px", color: "#ff453a", fontSize: 12, fontFamily: "var(--font-body)" }}>{addErr}</p>
            )}
            {addingAt !== currentParentId && (
              <button
                onClick={() => { setAddingAt(currentParentId); setNewName(""); }}
                style={{
                  width: "100%",
                  padding: "11px 14px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  color: "var(--primary)",
                  fontFamily: "var(--font-body)",
                  fontSize: 14,
                }}
              >
                <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
                Thêm danh mục cấp {currentLevel}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Date Picker ──────────────────────────────────────────────────────────────

const WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function makeDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getDateHints(): string[] {
  const now = new Date();
  const today = makeDateStr(now);

  const lastSun = new Date(now);
  lastSun.setDate(now.getDate() - now.getDay()); // most recent Sunday (today if Sunday)
  const sunday = makeDateStr(lastSun);

  if (today === sunday) {
    // Today is Sunday — fill remaining slots with recent days
    const result = [today];
    for (let i = 1; result.length < 3; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      result.push(makeDateStr(d));
    }
    return result;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayStr = makeDateStr(yesterday);

  // today + sunday = 2 required; add yesterday in between if it's not sunday
  const result = [today];
  if (yesterdayStr !== sunday) result.push(yesterdayStr);
  result.push(sunday);
  return result;
}

function hintLabel(s: string): string {
  const now = new Date();
  const today = makeDateStr(now);
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (s === today) return "Hôm nay";
  if (s === makeDateStr(yest)) return "Hôm qua";
  const d = new Date(s + "T00:00:00");
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
}

function selectedDateLabel(s: string): string {
  const now = new Date();
  const today = makeDateStr(now);
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (s === today) return "Hôm nay";
  if (s === makeDateStr(yest)) return "Hôm qua";
  const d = new Date(s + "T00:00:00");
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()}/${d.getMonth() + 1}`;
}

function DatePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hints = getDateHints();
  const isCustom = !hints.includes(value);

  const btnBase: React.CSSProperties = {
    flex: 1,
    padding: "11px 4px",
    border: "none",
    fontFamily: "var(--font-body)",
    fontSize: 13,
    cursor: "pointer",
    whiteSpace: "nowrap",
    letterSpacing: -0.2,
    transition: "background 0.12s",
    minWidth: 0,
  };

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
      {/* Hint bar — 3 equal buttons grouped */}
      <div style={{
        flex: 3,
        display: "flex",
        borderRadius: 11,
        border: "1px solid var(--hairline)",
        overflow: "hidden",
        background: "var(--canvas-parchment)",
      }}>
        {hints.map((d, i) => {
          const isSelected = value === d;
          return (
            <button
              key={d}
              onClick={() => onChange(d)}
              style={{
                ...btnBase,
                borderRight: i < hints.length - 1 ? "1px solid var(--hairline)" : "none",
                background: isSelected ? "var(--primary)" : "transparent",
                color: isSelected ? "#fff" : "var(--ink-muted-80)",
                fontWeight: isSelected ? 600 : 400,
              }}
            >
              {hintLabel(d)}
            </button>
          );
        })}
      </div>

      {/* Date display — separate, same unit width, opens datepicker */}
      <div style={{ flex: 1, position: "relative" }}>
        <button
          onClick={() => inputRef.current?.showPicker?.()}
          style={{
            ...btnBase,
            width: "100%",
            height: "100%",
            borderRadius: 11,
            border: "1px solid var(--hairline)",
            background: isCustom ? "var(--ink)" : "var(--canvas-parchment)",
            color: isCustom ? "#fff" : "var(--ink-muted-48)",
            fontWeight: isCustom ? 600 : 400,
          }}
        >
          {isCustom ? selectedDateLabel(value) : "···"}
        </button>
        <input
          ref={inputRef}
          type="date"
          value={value}
          max={todayStr()}
          onChange={(e) => { if (e.target.value) onChange(e.target.value); }}
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
          }}
        />
      </div>
    </div>
  );
}

type CustomBudget = { id: number; name: string; amount: number; is_active: number };

// ─── Main Form ────────────────────────────────────────────────────────────────

export default function TransactionForm({ open, onClose, onSaved }: Props) {
  const [type, setType] = useState<"expense" | "income">("expense");
  const [amountStr, setAmountStr] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState("");
  const [cats, setCats] = useState<Category[]>([]);
  const [customBudgets, setCustomBudgets] = useState<CustomBudget[]>([]);
  const [selectedCbIds, setSelectedCbIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    const [catRes, cbRes] = await Promise.all([
      fetch("/api/categories"),
      fetch("/api/custom-budgets?active_only=true"),
    ]);
    const catData = await catRes.json() as { categories?: Category[] };
    const cbData = await cbRes.json() as { custom_budgets?: CustomBudget[] };
    setCats(catData.categories ?? []);
    setCustomBudgets(cbData.custom_budgets ?? []);
  }, []);

  useEffect(() => {
    if (open) loadData();
  }, [open, loadData]);

  function reset() {
    setType("expense");
    setAmountStr("");
    setCategoryId(null);
    setDate(todayStr());
    setNote("");
    setSelectedCbIds([]);
    setError("");
  }

  function toggleCb(id: number) {
    setSelectedCbIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function submit() {
    const amount = parseInt(amountStr.replace(/[^\d]/g, ""), 10);
    if (!amount || amount <= 0) { setError("Nhập số tiền hợp lệ"); return; }
    if (!categoryId) { setError("Chọn danh mục"); return; }
    setSaving(true);
    setError("");
    const body: Record<string, unknown> = { amount, type, category_id: categoryId, note: note || null, date };
    if (type === "expense" && selectedCbIds.length > 0) body.custom_budget_ids = selectedCbIds;
    const r = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await r.json() as { error?: string };
    if (!r.ok) { setError(d.error ?? "Lỗi khi lưu"); setSaving(false); return; }
    setSaving(false);
    reset();
    onClose();
    onSaved();
  }

  if (!open) return null;

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 300,
      display: "flex",
      flexDirection: "column",
      justifyContent: "flex-end",
    }}>
      {/* Backdrop */}
      <div
        onClick={() => { onClose(); reset(); }}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
        }}
      />

      {/* Sheet */}
      <div style={{
        position: "relative",
        background: "var(--canvas)",
        borderRadius: "20px 20px 0 0",
        maxHeight: "92svh",
        overflowY: "auto",
        paddingBottom: "max(28px, env(safe-area-inset-bottom))",
      }}>
        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px" }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--hairline)" }} />
        </div>

        <div style={{ padding: "0 20px 8px" }}>

          {/* Type toggle */}
          <div style={{
            display: "flex",
            background: "var(--canvas-parchment)",
            borderRadius: 11,
            padding: 4,
            marginBottom: 18,
          }}>
            {(["expense", "income"] as const).map((t) => (
              <button key={t} onClick={() => { setType(t); setError(""); if (t === "income") setSelectedCbIds([]); }} style={{
                flex: 1,
                padding: "9px",
                borderRadius: 8,
                border: "none",
                background: type === t ? (t === "expense" ? "#ff453a" : "#30d158") : "transparent",
                color: type === t ? "#fff" : "var(--ink-muted-48)",
                fontFamily: "var(--font-body)",
                fontSize: 15,
                fontWeight: type === t ? 600 : 400,
                cursor: "pointer",
                transition: "all 0.15s",
              }}>
                {t === "expense" ? "Chi tiêu" : "Thu nhập"}
              </button>
            ))}
          </div>

          {/* Amount */}
          <div style={{ position: "relative", marginBottom: 18 }}>
            <span style={{
              position: "absolute",
              left: 16,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: 22,
              color: "var(--ink-muted-48)",
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              pointerEvents: "none",
            }}>₫</span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={amountStr}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^\d]/g, "");
                setAmountStr(raw ? fmt(parseInt(raw, 10)) : "");
                setError("");
              }}
              autoFocus
              style={{
                width: "100%",
                padding: "14px 16px 14px 44px",
                borderRadius: 11,
                border: "1px solid var(--hairline)",
                fontFamily: "var(--font-display)",
                fontSize: 28,
                fontWeight: 600,
                color: "var(--ink)",
                background: "var(--canvas-parchment)",
                outline: "none",
                letterSpacing: -0.3,
                textAlign: "right",
                paddingRight: 16,
              }}
            />
          </div>

          {/* Date */}
          <div style={{ marginBottom: 18 }}>
            <p style={{ fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 600, color: "var(--ink-muted-48)", marginBottom: 8, letterSpacing: 0.5, textTransform: "uppercase" }}>
              Ngày
            </p>
            <DatePicker value={date} onChange={setDate} />
          </div>

          {/* Category */}
          <div style={{ marginBottom: 18 }}>
            <p style={{ fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 600, color: "var(--ink-muted-48)", marginBottom: 8, letterSpacing: 0.5, textTransform: "uppercase" }}>
              Danh mục
            </p>
            <CategoryDrillDown
              cats={cats}
              selected={categoryId}
              onSelect={(id) => { setCategoryId(id); setError(""); }}
              onCatsChanged={loadData}
            />
          </div>

          {/* Custom budgets — expense only */}
          {type === "expense" && customBudgets.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <p style={{ fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 600, color: "var(--ink-muted-48)", marginBottom: 8, letterSpacing: 0.5, textTransform: "uppercase" }}>
                Gán vào quỹ
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {customBudgets.map((cb) => {
                  const on = selectedCbIds.includes(cb.id);
                  return (
                    <button
                      key={cb.id}
                      onClick={() => toggleCb(cb.id)}
                      style={{
                        padding: "7px 14px",
                        borderRadius: 999,
                        border: on ? "none" : "1px solid var(--hairline)",
                        background: on ? "var(--ink)" : "var(--canvas-parchment)",
                        color: on ? "#fff" : "var(--ink-muted-80)",
                        fontFamily: "var(--font-body)",
                        fontSize: 13,
                        fontWeight: on ? 600 : 400,
                        cursor: "pointer",
                        transition: "all 0.12s",
                      }}
                    >
                      {on && <span style={{ marginRight: 5 }}>✓</span>}{cb.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Note */}
          <input
            type="text"
            placeholder="Ghi chú (tuỳ chọn)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={{
              width: "100%",
              padding: "12px 16px",
              borderRadius: 11,
              border: "1px solid var(--hairline)",
              fontFamily: "var(--font-body)",
              fontSize: 15,
              color: "var(--ink)",
              background: "var(--canvas-parchment)",
              outline: "none",
              marginBottom: error ? 10 : 18,
            }}
          />

          {error && (
            <p style={{ color: "#ff453a", fontSize: 13, fontFamily: "var(--font-body)", marginBottom: 12 }}>
              {error}
            </p>
          )}

          <button
            onClick={submit}
            disabled={saving}
            style={{
              width: "100%",
              padding: "15px",
              borderRadius: 999,
              border: "none",
              background: "var(--primary)",
              color: "#fff",
              fontFamily: "var(--font-body)",
              fontSize: 17,
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.7 : 1,
              transition: "opacity 0.15s",
            }}
          >
            {saving ? "Đang lưu…" : "Lưu giao dịch"}
          </button>
        </div>
      </div>
    </div>
  );
}
