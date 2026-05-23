"use client";

import { useState, useEffect, useRef } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { EmojiPicker } from "@/components/organisms/EmojiPicker";

export type EditTransaction = {
  id: number;
  amount: number;
  type: "expense" | "income";
  emoji: string | null;
  category: { id: number; name: string; path: string } | null;
  debt_id: string | null;
  note: string | null;
  date: string;
  custom_budgets: { id: number; name: string }[];
};

type Category = {
  id: number;
  name: string;
  level: number;
  type: "income" | "expense";
  parent_id: number | null;
  children: Category[];
};

type CustomBudget = { id: number; name: string; amount: number; is_active: number };
type DebtItem = { id: string; type: "lend" | "borrow"; party: string; remaining: number };

export type TransactionFormProps = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  transaction?: EditTransaction;
};

const _fmtVN = new Intl.NumberFormat("vi-VN");
function fmt(n: number) {
  return _fmtVN.format(n);
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
void formatDateLabel; // used indirectly via hintLabel

// ─── Category Drill-Down ──────────────────────────────────────────────────────

function findSelectedChild(cat: Category, selectedId: number | null): string | null {
  if (!selectedId) return null;
  for (const child of cat.children) {
    if (child.id === selectedId) return child.name;
    const found = findSelectedChild(child, selectedId);
    if (found) return found;
  }
  return null;
}

function CategoryDrillDown({
  cats,
  selected,
  onSelect,
}: {
  cats: Category[];
  selected: number | null;
  onSelect: (id: number) => void;
}) {
  const [path, setPath] = useState<number[]>([]);
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
      {path.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 10, flexWrap: "wrap" }}>
          <button onClick={() => setPath([])} style={{ background: "none", border: "none", color: "var(--primary)", fontSize: 13, cursor: "pointer", padding: "2px 0", fontFamily: "var(--font-body)" }}>
            Tất cả
          </button>
          {pathNames.map((name, i) => (
            <span key={`${i}-${name}`} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ color: "var(--ink-muted-48)", fontSize: 12 }}>›</span>
              <button onClick={() => setPath(path.slice(0, i + 1))} style={{ background: "none", border: "none", color: i === pathNames.length - 1 ? "var(--ink)" : "var(--primary)", fontSize: 13, cursor: "pointer", padding: "2px 0", fontFamily: "var(--font-body)", fontWeight: i === pathNames.length - 1 ? 600 : 400 }}>
                {name}
              </button>
            </span>
          ))}
        </div>
      )}

      <div style={{ borderRadius: 11, border: "1px solid var(--hairline)", overflow: "hidden", background: "var(--canvas)" }}>
        {current.length === 0 && (
          <div style={{ padding: "12px 16px", color: "var(--ink-muted-48)", fontSize: 14, fontFamily: "var(--font-body)" }}>
            Không có danh mục con
          </div>
        )}

        {current.map((cat, i) => {
          const isLeaf = cat.children.length === 0;
          const isSelected = selected === cat.id;
          const selectedChildName = !isLeaf ? findSelectedChild(cat, selected) : null;
          const hasSelectedChild = !!selectedChildName;

          return (
            <div key={cat.id} style={{ borderTop: i > 0 ? "1px solid var(--hairline)" : "none" }}>
              <button
                onClick={() => isLeaf ? onSelect(cat.id) : setPath(prev => [...prev, cat.id])}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  padding: "11px 14px",
                  background: isSelected || hasSelectedChild ? "rgba(0,102,204,0.06)" : "transparent",
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
                  border: `2px solid ${isSelected || hasSelectedChild ? "var(--primary)" : "var(--hairline)"}`,
                  background: isSelected ? "var(--primary)" : "transparent",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  {isSelected && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff" }} />}
                  {hasSelectedChild && !isSelected && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--primary)", opacity: 0.5 }} />}
                </span>

                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{
                    display: "block",
                    fontFamily: "var(--font-body)",
                    fontSize: 15,
                    color: isSelected || hasSelectedChild ? "var(--primary)" : "var(--ink)",
                    fontWeight: isSelected || hasSelectedChild ? 600 : 400,
                    letterSpacing: -0.374,
                  }}>
                    {cat.name}
                  </span>
                  {hasSelectedChild && (
                    <span style={{
                      display: "block",
                      fontFamily: "var(--font-body)",
                      fontSize: 12,
                      color: "var(--primary)",
                      opacity: 0.7,
                      marginTop: 1,
                      letterSpacing: -0.2,
                    }}>
                      {selectedChildName}
                    </span>
                  )}
                </span>

                {!isLeaf && (
                  <span style={{ color: hasSelectedChild ? "var(--primary)" : "var(--ink-muted-48)", fontSize: 14, opacity: hasSelectedChild ? 0.6 : 1 }}>›</span>
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
  lastSun.setDate(now.getDate() - now.getDay());
  const sunday = makeDateStr(lastSun);

  if (today === sunday) {
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

// ─── Main Form ────────────────────────────────────────────────────────────────

const SPRING = "cubic-bezier(0.32, 0.72, 0, 1)";
const DRAG_CLOSE_THRESHOLD = 120;
const DRAG_VELOCITY_THRESHOLD = 0.5;

export function TransactionForm({ open, onClose, onSaved, transaction }: TransactionFormProps) {
  const isEdit = !!transaction;
  const [type, setType] = useState<"expense" | "income">(transaction?.type ?? "expense");
  const [amountStr, setAmountStr] = useState(transaction ? fmt(transaction.amount) : "");
  const [categoryId, setCategoryId] = useState<number | null>(transaction?.category?.id ?? null);
  const [date, setDate] = useState(transaction?.date ?? todayStr());
  const [note, setNote] = useState(transaction?.note ?? "");
  const [emoji, setEmoji] = useState<string | null>(transaction?.emoji ?? null);
  const [selectedCbIds, setSelectedCbIds] = useState<number[]>(
    transaction?.custom_budgets.map((cb) => cb.id) ?? []
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Debt link mode — only relevant in edit mode
  // "keep": no change; "unlink": remove debt_id; "link": attach to a different debt
  const [debtLinkMode, setDebtLinkMode] = useState<"keep" | "unlink" | "link">("keep");
  const [linkDebtId, setLinkDebtId] = useState<string | null>(null);

  const [mounted, setMounted] = useState(false);
  const [show, setShow] = useState(false);

  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);
  const touchStartY = useRef(0);
  const touchStartTime = useRef(0);
  const currentDragY = useRef(0);

  useEffect(() => {
    if (open) {
      setMounted(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setShow(true);
          // Delay focus until after slide-in animation (400ms) to prevent
          // iOS keyboard from opening before the sheet reaches its final position
          setTimeout(() => amountRef.current?.focus(), 420);
        });
      });
    } else {
      setShow(false);
      setDragY(0);
      const t = setTimeout(() => setMounted(false), 400);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (transaction) {
      setType(transaction.type);
      setAmountStr(fmt(transaction.amount));
      setCategoryId(transaction.category?.id ?? null);
      setDate(transaction.date);
      setNote(transaction.note ?? "");
      setEmoji(transaction.emoji ?? null);
      setSelectedCbIds(transaction.custom_budgets.map((cb) => cb.id));
      setDebtLinkMode("keep");
      setLinkDebtId(null);
    }
  }, [transaction]);

  const { data: catData } = useSWR<{ categories: Category[] }>(
    open ? "/api/categories" : null,
    fetcher,
  );
  const { data: debtsData } = useSWR<{ lending: DebtItem[]; borrowing: DebtItem[] }>(
    open && isEdit && debtLinkMode === "link" ? "/api/debts" : null,
    fetcher,
  );
  const openDebts = [...(debtsData?.lending ?? []), ...(debtsData?.borrowing ?? [])];

  const { data: cbData } = useSWR<{ custom_budgets: CustomBudget[] }>(
    open ? (isEdit ? "/api/custom-budgets" : "/api/custom-budgets?active_only=true") : null,
    fetcher,
  );
  const allCats = catData?.categories ?? [];
  const cats = allCats.filter((c) => c.type === type);
  const allCbs = cbData?.custom_budgets ?? [];
  const customBudgets = isEdit
    ? allCbs.filter((cb) => cb.is_active === 1 || selectedCbIds.includes(cb.id))
    : allCbs;

  useEffect(() => {
    if (!isEdit) setCategoryId(null);
  }, [type, isEdit]);

  function reset() {
    setType("expense");
    setAmountStr("");
    setCategoryId(null);
    setDate(todayStr());
    setNote("");
    setEmoji(null);
    setSelectedCbIds([]);
    setError("");
    setDebtLinkMode("keep");
    setLinkDebtId(null);
  }

  function toggleCb(id: number) {
    setSelectedCbIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function submit() {
    const amount = parseInt(amountStr.replace(/[^\d]/g, ""), 10);
    if (!amount || amount <= 0) { setError("Nhập số tiền hợp lệ"); return; }

    const isDebtTx = isEdit && transaction!.debt_id && debtLinkMode === "keep";
    const isLinking = isEdit && debtLinkMode === "link";
    const isUnlinking = isEdit && debtLinkMode === "unlink";

    if (isLinking && !linkDebtId) { setError("Chọn khoản nợ để liên kết"); return; }
    if (!isDebtTx && !isLinking && !categoryId) { setError("Chọn danh mục"); return; }

    setSaving(true);
    setError("");
    const body: Record<string, unknown> = { amount, type, note: note || null, date, emoji: emoji || null };

    if (isLinking) {
      body.link_debt_id = linkDebtId;
    } else if (isUnlinking) {
      body.link_debt_id = null;
      body.category_id = categoryId;
    } else {
      body.category_id = categoryId;
    }

    if (!isDebtTx && !isLinking && type === "expense") body.custom_budget_ids = selectedCbIds;
    const url = isEdit ? `/api/transactions/${transaction!.id}` : "/api/transactions";
    const method = isEdit ? "PATCH" : "POST";
    const r = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await r.json() as { error?: string };
    if (!r.ok) { setError(d.error ?? "Lỗi khi lưu"); setSaving(false); return; }
    setSaving(false);
    if (!isEdit) reset();
    onClose();
    onSaved();
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
    currentDragY.current = 0;
    setIsDragging(true);
  }

  function handleTouchMove(e: React.TouchEvent) {
    const dy = e.touches[0].clientY - touchStartY.current;
    if (dy > 0) {
      const dampened = Math.pow(dy, 0.85);
      currentDragY.current = dampened;
      setDragY(dampened);
    }
  }

  function handleTouchEnd() {
    setIsDragging(false);
    const elapsed = Date.now() - touchStartTime.current;
    const velocity = currentDragY.current / elapsed;
    if (currentDragY.current > DRAG_CLOSE_THRESHOLD || velocity > DRAG_VELOCITY_THRESHOLD) {
      onClose();
      reset();
    } else {
      setDragY(0);
    }
    currentDragY.current = 0;
  }

  if (!mounted) return null;

  const backdropOpacity = show ? Math.max(0, 0.5 - (dragY / 400) * 0.5) : 0;
  const sheetTranslateY = show ? dragY : "100%";

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 300,
      display: "flex",
      flexDirection: "column",
      justifyContent: "flex-end",
      overflowX: "hidden",
    }}>
      <div
        onClick={() => { onClose(); reset(); }}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          opacity: backdropOpacity,
          transition: isDragging ? "none" : `opacity 0.4s ${SPRING}`,
        }}
      />

      <div
        style={{
          position: "relative",
          background: "var(--canvas)",
          borderRadius: "20px 20px 0 0",
          maxHeight: "92svh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          touchAction: "pan-y",
          transform: `translateY(${sheetTranslateY}${typeof sheetTranslateY === "number" ? "px" : ""})`,
          transition: isDragging ? "none" : `transform 0.4s ${SPRING}`,
          ...(isDragging && { willChange: "transform" }),
        }}
      >
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "12px 0 4px",
            cursor: "grab",
            userSelect: "none",
            touchAction: "none",
          }}
        >
          <div style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            background: "var(--hairline)",
            transition: `width 0.15s ease, background 0.15s ease`,
            ...(isDragging ? { width: 48, background: "var(--ink-muted-48)" } : {}),
          }} />
        </div>

        {isEdit && (
          <p style={{ textAlign: "center", fontFamily: "var(--font-body)", fontSize: 15, fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>
            Sửa giao dịch
          </p>
        )}

        <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden", padding: "0 20px" }}>
          <div style={{ flexShrink: 0 }}>
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
                  transition: "background 0.15s, color 0.15s",
                }}>
                  {t === "expense" ? "Chi tiêu" : "Thu nhập"}
                </button>
              ))}
            </div>

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
                ref={amountRef}
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

            <div style={{ marginBottom: 18 }}>
              <p style={{ fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 600, color: "var(--ink-muted-48)", marginBottom: 8, letterSpacing: 0.5, textTransform: "uppercase" }}>
                Ngày
              </p>
              <DatePicker value={date} onChange={setDate} />
            </div>

            {/* Debt link section — edit mode only */}
            {isEdit && (
              <div style={{ marginBottom: 16 }}>
                {transaction!.debt_id && debtLinkMode === "keep" ? (
                  // Currently a debt transaction
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 10, background: "var(--canvas-parchment)", border: "1px solid var(--hairline)" }}>
                    <span style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--ink-muted-80)" }}>◈ Khoản nợ</span>
                    <button
                      onClick={() => setDebtLinkMode("unlink")}
                      style={{ background: "none", border: "none", fontFamily: "var(--font-body)", fontSize: 13, color: "var(--destructive)", cursor: "pointer", fontWeight: 600 }}
                    >
                      Chuyển sang chi tiêu thường
                    </button>
                  </div>
                ) : !transaction!.debt_id && debtLinkMode === "keep" ? (
                  // Regular transaction — offer linking
                  <button
                    onClick={() => setDebtLinkMode("link")}
                    style={{ background: "none", border: "none", fontFamily: "var(--font-body)", fontSize: 13, color: "var(--primary)", cursor: "pointer", padding: 0 }}
                  >
                    ◈ Đánh dấu là khoản nợ
                  </button>
                ) : debtLinkMode === "link" ? (
                  // Pick a debt to link
                  <div style={{ padding: "10px 12px", borderRadius: 10, background: "var(--canvas-parchment)", border: "1px solid var(--hairline)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>Chọn khoản nợ</span>
                      <button onClick={() => { setDebtLinkMode("keep"); setLinkDebtId(null); }} style={{ background: "none", border: "none", fontFamily: "var(--font-body)", fontSize: 13, color: "var(--ink-muted-48)", cursor: "pointer" }}>Huỷ</button>
                    </div>
                    {openDebts.length === 0 ? (
                      <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--ink-muted-48)" }}>Không có khoản nợ đang mở</p>
                    ) : openDebts.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => setLinkDebtId(d.id)}
                        style={{
                          display: "block", width: "100%", textAlign: "left",
                          padding: "8px 10px", borderRadius: 8, marginBottom: 4,
                          border: "none",
                          background: linkDebtId === d.id ? "var(--primary)" : "var(--canvas-card)",
                          color: linkDebtId === d.id ? "#fff" : "var(--ink)",
                          fontFamily: "var(--font-body)", fontSize: 13, cursor: "pointer",
                        }}
                      >
                        {d.party} · {d.type === "lend" ? "Cho vay" : "Đi vay"} · còn {(d.remaining / 1000).toLocaleString("vi-VN")}k
                      </button>
                    ))}
                  </div>
                ) : debtLinkMode === "unlink" ? (
                  // Unlinking — show reminder + cancel
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 10, background: "#fff3cd", border: "1px solid #ffc107" }}>
                    <span style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--ink)" }}>Chọn danh mục mới bên dưới</span>
                    <button onClick={() => setDebtLinkMode("keep")} style={{ background: "none", border: "none", fontFamily: "var(--font-body)", fontSize: 13, color: "var(--ink-muted-48)", cursor: "pointer" }}>Huỷ</button>
                  </div>
                ) : null}
              </div>
            )}

            {/* Category label — hide for debt transactions (unless unlinking) */}
            {(!isEdit || !transaction!.debt_id || debtLinkMode === "unlink") && (
            <p style={{ fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 600, color: "var(--ink-muted-48)", marginBottom: 8, letterSpacing: 0.5, textTransform: "uppercase" }}>
              Danh mục
            </p>
            )}
          </div>

          {/* Category picker — hide for debt transactions (unless unlinking) */}
          {(!isEdit || !transaction!.debt_id || debtLinkMode === "unlink") && (
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", marginBottom: 18 }}>
            <CategoryDrillDown
              cats={cats}
              selected={categoryId}
              onSelect={(id) => { setCategoryId(id); setError(""); }}
            />
          </div>
          )}
          {isEdit && transaction!.debt_id && debtLinkMode === "keep" && (
            <div style={{ flex: 1, minHeight: 0 }} />
          )}

          <div style={{ flexShrink: 0, paddingBottom: "max(28px, env(safe-area-inset-bottom))" }}>
            {type === "expense" && customBudgets.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <p style={{ fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 600, color: "var(--ink-muted-48)", marginBottom: 8, letterSpacing: 0.5, textTransform: "uppercase" }}>
                  Gán vào quỹ
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {customBudgets.map((cb) => {
                    const on = selectedCbIds.includes(cb.id);
                    const inactive = cb.is_active === 0;
                    return (
                      <button
                        key={cb.id}
                        onClick={() => !inactive && toggleCb(cb.id)}
                        disabled={inactive}
                        style={{
                          padding: "7px 14px",
                          borderRadius: 999,
                          border: on ? "none" : "1px solid var(--hairline)",
                          background: on ? (inactive ? "var(--ink-muted-48)" : "var(--ink)") : "var(--canvas-parchment)",
                          color: on ? "#fff" : "var(--ink-muted-48)",
                          fontFamily: "var(--font-body)",
                          fontSize: 13,
                          fontWeight: on ? 600 : 400,
                          cursor: inactive ? "default" : "pointer",
                          opacity: inactive ? 0.55 : 1,
                          transition: "background 0.12s, color 0.12s, border-color 0.12s",
                        }}
                      >
                        {on && <span style={{ marginRight: 5 }}>✓</span>}{cb.name}
                        {inactive && <span style={{ marginLeft: 5, fontSize: 12, opacity: 0.8 }}>· đã tắt</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: error ? 10 : 18 }}>
              <EmojiPicker value={emoji} onChange={setEmoji} />
              <input
                type="text"
                placeholder="Ghi chú (tuỳ chọn)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  borderRadius: 11,
                  border: "1px solid var(--hairline)",
                  fontFamily: "var(--font-body)",
                  fontSize: 15,
                  color: "var(--ink)",
                  background: "var(--canvas-parchment)",
                  outline: "none",
                }}
              />
            </div>

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
              {saving ? "Đang lưu…" : isEdit ? "Cập nhật" : "Lưu giao dịch"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
