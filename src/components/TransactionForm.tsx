"use client";

import { useState, useEffect, useCallback } from "react";

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

function getLast14Days(): string[] {
  const days: string[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(makeDateStr(d));
  }
  return days;
}

function DatePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [showInput, setShowInput] = useState(false);
  const days = getLast14Days();
  const inStrip = days.includes(value);

  return (
    <div style={{
      background: "var(--canvas-parchment)",
      borderRadius: 11,
      border: "1px solid var(--hairline)",
      overflow: "hidden",
    }}>
      {/* Scrollable day strip */}
      <div style={{
        display: "flex",
        overflowX: "auto",
        gap: 0,
        scrollbarWidth: "none",
        WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"],
      } as React.CSSProperties}>
        {days.map((d, i) => {
          const dateObj = new Date(d + "T00:00:00");
          const isSelected = value === d;
          const isToday = d === todayStr();
          const weekday = WEEKDAYS[dateObj.getDay()];
          const dayNum = dateObj.getDate();

          return (
            <button
              key={d}
              onClick={() => { onChange(d); setShowInput(false); }}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minWidth: 52,
                padding: "10px 4px",
                border: "none",
                borderRight: i < days.length - 1 ? "1px solid var(--hairline)" : "none",
                background: isSelected ? "var(--primary)" : "transparent",
                cursor: "pointer",
                gap: 4,
                transition: "background 0.12s",
              }}
            >
              <span style={{
                fontFamily: "var(--font-body)",
                fontSize: 10,
                color: isSelected ? "rgba(255,255,255,0.8)" : "var(--ink-muted-48)",
                fontWeight: 400,
                letterSpacing: 0.3,
              }}>
                {isToday ? "HN" : weekday}
              </span>
              <span style={{
                fontFamily: "var(--font-display)",
                fontSize: 17,
                fontWeight: isSelected ? 600 : (isToday ? 600 : 400),
                color: isSelected ? "#fff" : isToday ? "var(--primary)" : "var(--ink)",
                lineHeight: 1,
              }}>
                {dayNum}
              </span>
            </button>
          );
        })}

        {/* "…" button for older dates */}
        <button
          onClick={() => setShowInput(!showInput)}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 44,
            padding: "10px 8px",
            border: "none",
            background: (!inStrip && value) ? "var(--ink)" : "transparent",
            cursor: "pointer",
            gap: 4,
          }}
        >
          <span style={{
            fontFamily: "var(--font-body)",
            fontSize: 10,
            color: (!inStrip && value) ? "rgba(255,255,255,0.7)" : "var(--ink-muted-48)",
          }}>
            {(!inStrip && value) ? new Date(value + "T00:00:00").getDate() : ""}
          </span>
          <span style={{
            fontSize: 16,
            color: (!inStrip && value) ? "#fff" : "var(--ink-muted-48)",
            lineHeight: 1,
          }}>
            {(!inStrip && value) ? WEEKDAYS[new Date(value + "T00:00:00").getDay()] : "···"}
          </span>
        </button>
      </div>

      {/* Hidden date input for older dates */}
      {showInput && (
        <div style={{ borderTop: "1px solid var(--hairline)", padding: "10px 12px" }}>
          <input
            type="date"
            value={value}
            max={todayStr()}
            onChange={(e) => { if (e.target.value) { onChange(e.target.value); setShowInput(false); } }}
            autoFocus
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid var(--hairline)",
              fontFamily: "var(--font-body)",
              fontSize: 15,
              color: "var(--ink)",
              background: "var(--canvas)",
              outline: "none",
            }}
          />
        </div>
      )}
    </div>
  );
}

// ─── Main Form ────────────────────────────────────────────────────────────────

export default function TransactionForm({ open, onClose, onSaved }: Props) {
  const [type, setType] = useState<"expense" | "income">("expense");
  const [amountStr, setAmountStr] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState("");
  const [cats, setCats] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadCats = useCallback(async () => {
    const r = await fetch("/api/categories");
    const d = await r.json() as { categories?: Category[] };
    setCats(d.categories ?? []);
  }, []);

  useEffect(() => {
    if (open) loadCats();
  }, [open, loadCats]);

  function reset() {
    setType("expense");
    setAmountStr("");
    setCategoryId(null);
    setDate(todayStr());
    setNote("");
    setError("");
  }

  async function submit() {
    const amount = parseInt(amountStr.replace(/[^\d]/g, ""), 10);
    if (!amount || amount <= 0) { setError("Nhập số tiền hợp lệ"); return; }
    if (!categoryId) { setError("Chọn danh mục"); return; }
    setSaving(true);
    setError("");
    const r = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, type, category_id: categoryId, note: note || null, date }),
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
              <button key={t} onClick={() => { setType(t); setError(""); }} style={{
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
              onCatsChanged={loadCats}
            />
          </div>

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
