"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";

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
}: {
  cats: Category[];
  selected: number | null;
  onSelect: (id: number) => void;
}) {
  // path = [l1Id, l2Id?, l3Id?] – breadcrumb of what user has drilled into
  const [path, setPath] = useState<number[]>([]);
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

  const current = getCurrent();
  const pathNames = getPathNames();

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
        {current.length === 0 && (
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
        <div
          style={{
            ...btnBase,
            width: "100%",
            height: "100%",
            borderRadius: 11,
            border: "1px solid var(--hairline)",
            background: isCustom ? "var(--ink)" : "var(--canvas-parchment)",
            color: isCustom ? "#fff" : "var(--ink-muted-48)",
            fontWeight: isCustom ? 600 : 400,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          {isCustom ? selectedDateLabel(value) : "···"}
        </div>
        <input
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
            cursor: "pointer",
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
  const [selectedCbIds, setSelectedCbIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const { data: catData } = useSWR<{ categories: Category[] }>(
    open ? "/api/categories" : null,
    fetcher,
  );
  const { data: cbData } = useSWR<{ custom_budgets: CustomBudget[] }>(
    open ? "/api/custom-budgets?active_only=true" : null,
    fetcher,
  );
  const cats = catData?.categories ?? [];
  const customBudgets = cbData?.custom_budgets ?? [];

  useEffect(() => {
    if (!open) return;
  }, [open]);

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
