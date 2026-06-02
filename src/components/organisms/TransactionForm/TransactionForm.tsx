"use client";

import { useState, useRef } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { EmojiPicker } from "@/components/organisms/EmojiPicker";
import type { DebtWithRepayments } from "@/lib/debt";
import { findSelectedChild, getCategoryPath, rootDisplay } from "./categoryDisplay";

// ─── Types ────────────────────────────────────────────────────────────────────

export type EditTransaction = {
  id: number;
  amount: number;
  type: "expense" | "income";
  emoji: string | null;
  category: { id: number; name: string; path: string } | null;
  debt_id: string | null;
  debt_party: string | null;
  debt_type: "lend" | "borrow" | null;
  is_opening_tx: boolean;
  note: string | null;
  date: string;
  custom_budgets: { id: number; name: string }[];
};

export type TransactionFormMode =
  | { kind: "create" }
  | { kind: "create-debt-open" }
  | { kind: "repayment"; debt: DebtWithRepayments }
  | { kind: "edit"; transaction: EditTransaction };

export type TransactionFormProps = {
  open: boolean;
  mode: TransactionFormMode;
  onClose: () => void;
  onSaved: () => void;
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
type OpenDebt = { id: string; type: "lend" | "borrow"; party: string; remaining: number };

// ─── Helpers ──────────────────────────────────────────────────────────────────

const _fmt = new Intl.NumberFormat("vi-VN");
function fmt(n: number) { return _fmt.format(n); }

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtDateLabel(s: string) {
  const today = todayStr();
  const yest = new Date(); yest.setDate(yest.getDate() - 1);
  const yesterdayStr = `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, "0")}-${String(yest.getDate()).padStart(2, "0")}`;
  if (s === today) return "Hôm nay";
  if (s === yesterdayStr) return "Hôm qua";
  const [, m, d2] = s.split("-");
  return `${parseInt(d2)}/${parseInt(m)}`;
}

// ─── Category drill-down ──────────────────────────────────────────────────────

const COLLAPSED_LIMIT = 5;

function CategoryDrillDown({
  cats, selected, onSelect, usageCounts,
}: {
  cats: Category[];
  selected: number | null;
  onSelect: (id: number) => void;
  usageCounts: Record<number, number>;
}) {
  const [path, setPath] = useState<number[]>([]);
  const [expanded, setExpanded] = useState(false);

  const currentList = path.reduce<Category[]>((list, id) => {
    return list.find((c) => c.id === id)?.children ?? list;
  }, cats);

  const isRoot = path.length === 0;
  // At root level: sort by usage frequency and collapse to the top few; deeper
  // levels keep their natural order and never collapse.
  const { sorted: sortedList, collapsed: collapsedList, hasMore: rootHasMore } = isRoot
    ? rootDisplay(currentList, usageCounts, selected, COLLAPSED_LIMIT)
    : { sorted: currentList, collapsed: currentList, hasMore: false };

  function handleSelect(cat: Category) {
    if (cat.children.length === 0) {
      onSelect(cat.id);
      setPath([]);
    } else {
      setPath((p) => [...p, cat.id]);
    }
  }

  const rowStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "11px 16px", cursor: "pointer", width: "100%", textAlign: "left",
    background: "none", borderTop: "none", borderLeft: "none", borderRight: "none",
    borderBottom: "1px solid var(--hairline)",
  };

  const hasMore = isRoot && rootHasMore;
  const displayList = isRoot && !expanded ? collapsedList : sortedList;

  return (
    <div style={{ borderRadius: 11, border: "1px solid var(--hairline)", overflow: "hidden", background: "var(--canvas)" }}>
      {path.length > 0 && (
        <button type="button" onClick={() => setPath((p) => p.slice(0, -1))} style={{ ...rowStyle, color: "var(--primary)", fontFamily: "var(--font-body)", fontSize: 14 }}>
          ← Quay lại
        </button>
      )}
      {displayList.map((cat) => {
        const isSelected = cat.id === selected || (cat.children.length > 0 && findSelectedChild(cat, selected) !== null);
        const childLabel = findSelectedChild(cat, selected);
        return (
          <button type="button" key={cat.id} onClick={() => handleSelect(cat)} style={{ ...rowStyle, borderBottom: "1px solid var(--hairline)" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontFamily: "var(--font-body)", fontSize: 15, color: isSelected ? "var(--primary)" : "var(--ink)", fontWeight: isSelected ? 600 : 400 }}>
                {cat.name}
              </span>
              {childLabel && (
                <span style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--ink-muted-48)", marginLeft: 8 }}>
                  {childLabel}
                </span>
              )}
            </div>
            {cat.children.length > 0 ? (
              <span style={{ color: "var(--ink-muted-48)", fontSize: 14 }}>›</span>
            ) : isSelected ? (
              <span style={{ color: "var(--primary)", fontSize: 14 }}>✓</span>
            ) : null}
          </button>
        );
      })}
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          style={{ ...rowStyle, color: "var(--primary)", fontFamily: "var(--font-body)", fontSize: 14, justifyContent: "center", borderBottom: "none" }}
        >
          {expanded ? "Thu gọn ↑" : `Xem thêm ${sortedList.length - collapsedList.length} danh mục ↓`}
        </button>
      )}
    </div>
  );
}

// ─── Date picker ──────────────────────────────────────────────────────────────

function DatePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <span style={{ fontFamily: "var(--font-body)", fontSize: 15, color: "var(--primary)" }}>
        {fmtDateLabel(value)}
      </span>
      <input
        type="date"
        aria-label="Chọn ngày"
        value={value}
        max={todayStr()}
        onChange={(e) => { if (e.target.value) onChange(e.target.value); }}
        style={{ position: "absolute", inset: 0, opacity: 0, width: "100%", height: "100%", cursor: "pointer" }}
      />
    </div>
  );
}

// ─── Debt link section ────────────────────────────────────────────────────────

type DebtLinkState =
  | { kind: "none" }
  | { kind: "new-debt"; party: string; due_date: string }   // debtSubType derived from tx type
  | { kind: "existing"; debtId: string; party: string };

function DebtLinkSection({
  txType, state, onChange, openLends, openBorrows,
}: {
  txType: "expense" | "income";
  state: DebtLinkState;
  onChange: (s: DebtLinkState) => void;
  openLends: OpenDebt[];
  openBorrows: OpenDebt[];
}) {
  const [expanded, setExpanded] = useState(false);

  // expense → can create lend (Cho vay mới) or repay borrow
  // income  → can create borrow (Đi vay mới) or receive lend repayment
  const newLabel = txType === "expense" ? "Cho vay mới" : "Đi vay mới";
  const existingList = txType === "expense" ? openBorrows : openLends;
  const existingLabel = txType === "expense" ? "Trả nợ cho:" : "Nhận lại từ:";

  const summaryLabel = state.kind === "none"
    ? "Không"
    : state.kind === "new-debt"
      ? newLabel
      : state.party;

  return (
    <div>
      <button type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex justify-between items-center bg-transparent py-[15px] cursor-pointer border-t border-hairline"
      >
        <span style={{ fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 600, color: "var(--ink-muted-48)", textTransform: "uppercase", letterSpacing: 0.5 }}>
          Liên kết nợ
        </span>
        <span style={{ fontFamily: "var(--font-body)", fontSize: 15, color: state.kind !== "none" ? "var(--primary)" : "var(--ink-muted-48)" }}>
          {summaryLabel} {expanded ? "▾" : "▸"}
        </span>
      </button>

      {expanded && (
        <div style={{ paddingBottom: 16 }}>
          {/* None */}
          <Option label="Không liên kết" selected={state.kind === "none"} onSelect={() => onChange({ kind: "none" })} />

          {/* New debt */}
          <Option label={newLabel} selected={state.kind === "new-debt"} onSelect={() => onChange({ kind: "new-debt", party: "", due_date: "" })} />
          {state.kind === "new-debt" && (
            <div style={{ paddingLeft: 20, paddingBottom: 8 }}>
              <input
                aria-label={txType === "expense" ? "Cho vay ai" : "Vay của ai"}
                placeholder={txType === "expense" ? "Cho vay ai…" : "Vay của ai…"}
                value={state.party}
                onChange={(e) => onChange({ ...state, party: e.target.value })}
                style={inputStyle}
              />
              <div style={{ marginTop: 8, position: "relative" }}>
                <span style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--ink-muted-48)", marginRight: 8 }}>Hạn trả:</span>
                <input
                  type="date"
                  aria-label="Hạn trả"
                  value={state.due_date}
                  onChange={(e) => onChange({ ...state, due_date: e.target.value })}
                  style={{ ...inputStyle, display: "inline-block", width: "auto" }}
                />
              </div>
            </div>
          )}

          {/* Existing debts */}
          {existingList.length > 0 && (
            <>
              <div style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--ink-muted-48)", padding: "8px 0 4px", fontWeight: 600 }}>
                {existingLabel}
              </div>
              {existingList.map((d) => (
                <Option
                  key={d.id}
                  label={d.party}
                  sublabel={`còn ${fmt(d.remaining)}₫`}
                  selected={state.kind === "existing" && state.debtId === d.id}
                  onSelect={() => onChange({ kind: "existing", debtId: d.id, party: d.party })}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: 10,
  border: "1px solid var(--hairline)", background: "var(--canvas-parchment)",
  fontFamily: "var(--font-body)", fontSize: 15, color: "var(--ink)",
  outline: "none", boxSizing: "border-box",
};

function Option({ label, sublabel, selected, onSelect }: { label: string; sublabel?: string; selected: boolean; onSelect: () => void }) {
  return (
    <button type="button"
      onClick={onSelect}
      className="w-full flex items-center gap-2.5 bg-transparent px-1 py-3 cursor-pointer border-b border-hairline"
    >
      <span
        className="size-[18px] rounded-full shrink-0 flex items-center justify-center"
        style={{
          border: `2px solid ${selected ? "var(--primary)" : "var(--hairline)"}`,
          background: selected ? "var(--primary)" : "transparent",
        }}
      >
        {selected && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff" }} />}
      </span>
      <span style={{ fontFamily: "var(--font-body)", fontSize: 15, color: "var(--ink)", fontWeight: selected ? 600 : 400 }}>
        {label}
      </span>
      {sublabel && <span style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--ink-muted-48)", marginLeft: "auto" }}>{sublabel}</span>}
    </button>
  );
}

// ─── Main form ────────────────────────────────────────────────────────────────

const SPRING = "cubic-bezier(0.32, 0.72, 0, 1)";

export function TransactionForm({ open, mode, onClose, onSaved }: TransactionFormProps) {
  const isEdit = mode.kind === "edit";
  const isRepayment = mode.kind === "repayment";
  const editTx = isEdit ? mode.transaction : null;

  const [type, setType] = useState<"expense" | "income">(
    isRepayment ? (mode.debt.type === "lend" ? "income" : "expense")
    : editTx?.type ?? "expense"
  );
  const [amountStr, setAmountStr] = useState(
    isRepayment ? fmt(mode.debt.remaining) : editTx ? fmt(editTx.amount) : ""
  );
  const [categoryId, setCategoryId] = useState<number | null>(editTx?.category?.id ?? null);
  const [date, setDate] = useState(editTx?.date ?? todayStr());
  const [note, setNote] = useState(editTx?.note ?? "");
  const [emoji, setEmoji] = useState<string | null>(editTx?.emoji ?? null);
  const [selectedCbIds, setSelectedCbIds] = useState<number[]>(editTx?.custom_budgets.map((c) => c.id) ?? []);
  const [debtLink, setDebtLink] = useState<DebtLinkState>({ kind: "none" });
  const [unlinkMode, setUnlinkMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const amountRef = useRef<HTMLInputElement>(null);

  // Enter/exit is driven by CSS keyframes (see globals.css). `mounted` keeps the
  // sheet in the DOM while the exit animation plays; it's adjusted during render
  // from the `open` prop (the React-recommended alternative to a prop-sync effect)
  // and cleared in the sheet's onAnimationEnd handler once the exit finishes.
  const [mounted, setMounted] = useState(open);
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setMounted(true);
  }

  // NOTE: switching edit targets is handled by remounting via a `key` prop at
  // the call site (see DashboardTemplate), so the useState initializers above
  // re-run for the new transaction — no prop-sync effect needed.

  const { data: catData } = useSWR<{ categories: Category[]; usage_counts: Record<number, number> }>(
    open && !isRepayment ? "/api/categories" : null, fetcher,
  );
  const { data: debtsData } = useSWR<{ lending: OpenDebt[]; borrowing: OpenDebt[] }>(
    open && !isRepayment ? "/api/debts" : null, fetcher,
  );
  const { data: cbData } = useSWR<{ custom_budgets: CustomBudget[] }>(
    open && !isRepayment ? "/api/custom-budgets?active_only=true" : null, fetcher,
  );

  const allCats = catData?.categories ?? [];
  const cats = allCats.filter((c) => c.type === type);
  const usageCounts = catData?.usage_counts ?? {};
  const openLends = debtsData?.lending ?? [];
  const openBorrows = debtsData?.borrowing ?? [];
  const customBudgets = cbData?.custom_budgets ?? [];

  // Whether to hide category/budget (debt tx has no category)
  const isDebtMode = isRepayment
    || (isEdit && editTx?.debt_id && !unlinkMode)
    || debtLink.kind !== "none";

  function reset() {
    setType("expense");
    setAmountStr("");
    setCategoryId(null);
    setDate(todayStr());
    setNote("");
    setEmoji(null);
    setSelectedCbIds([]);
    setDebtLink({ kind: "none" });
    setUnlinkMode(false);
    setError("");
  }

  function handleClose() { onClose(); reset(); }

  async function submit() {
    const amount = parseInt(amountStr.replace(/[^\d]/g, ""), 10);
    if (!amount || amount <= 0) { setError("Nhập số tiền hợp lệ"); return; }

    setSaving(true); setError("");
    try {
      // ── Repayment mode ────────────────────────────────────────────────────
      if (isRepayment) {
        const r = await fetch("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount, type, date, note: note || null, emoji: emoji || null, debt_id: mode.debt.id }),
        });
        if (!r.ok) { setError((await r.json() as { error?: string }).error ?? "Lỗi"); return; }
        onSaved(); handleClose(); return;
      }

      // ── Edit mode ─────────────────────────────────────────────────────────
      if (isEdit && editTx) {
        const body: Record<string, unknown> = { amount, type, note: note || null, date, emoji: emoji || null };

        if (unlinkMode) {
          // Unlink: remove debt context, require category
          if (!categoryId) { setError("Chọn danh mục"); return; }
          body.category_id = categoryId;
          const unlinkRes = await fetch(`/api/transactions/${editTx.id}/link`, { method: "DELETE" });
          if (!unlinkRes.ok) {
            const e = await unlinkRes.json() as { error?: string };
            setError(e.error ?? "Không thể hủy liên kết");
            return;
          }
        } else if (!editTx.debt_id) {
          // Normal edit — no debt
          if (!categoryId) { setError("Chọn danh mục"); return; }
          body.category_id = categoryId;
          if (type === "expense") body.custom_budget_ids = selectedCbIds;
        }
        // debt edit: amount/note/date only

        const r = await fetch(`/api/transactions/${editTx.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!r.ok) { setError((await r.json() as { error?: string }).error ?? "Lỗi"); return; }
        onSaved(); handleClose(); return;
      }

      // ── Create mode ───────────────────────────────────────────────────────
      if (debtLink.kind === "new-debt") {
        if (!debtLink.party.trim()) { setError("Nhập tên người"); return; }
        const debtType = type === "expense" ? "lend" : "borrow";
        const r = await fetch("/api/debts", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: debtType, party: debtLink.party.trim(),
            due_date: debtLink.due_date || null,
            amount, date, transaction_note: note || null,
          }),
        });
        if (!r.ok) { setError((await r.json() as { error?: string }).error ?? "Lỗi"); return; }
        onSaved(); handleClose(); return;
      }

      if (debtLink.kind === "existing") {
        const r = await fetch("/api/transactions", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount, type, date, note: note || null, emoji: emoji || null, debt_id: debtLink.debtId }),
        });
        if (!r.ok) { setError((await r.json() as { error?: string }).error ?? "Lỗi"); return; }
        onSaved(); handleClose(); return;
      }

      // Normal transaction
      if (!categoryId) { setError("Chọn danh mục"); return; }
      const body: Record<string, unknown> = {
        amount, type, date, note: note || null, emoji: emoji || null, category_id: categoryId,
      };
      if (type === "expense") body.custom_budget_ids = selectedCbIds;
      const r = await fetch("/api/transactions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) { setError((await r.json() as { error?: string }).error ?? "Lỗi"); return; }
      onSaved(); handleClose();
    } finally {
      setSaving(false);
    }
  }

  if (!mounted) return null;

  const title = isRepayment ? "Ghi nhận thanh toán"
    : isEdit ? "Sửa giao dịch"
    : "Giao dịch mới";

  const amountColor = type === "expense" ? "var(--danger)" : "var(--success)";
  const selectedCatPath = categoryId ? getCategoryPath(cats, categoryId) : [];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300 }}>
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Đóng"
        onClick={handleClose}
        style={{
          position: "absolute", inset: 0, border: "none", padding: 0, cursor: "pointer",
          background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
          animation: `${open ? "sheet-fade-in" : "sheet-fade-out"} 0.4s ${SPRING} forwards`,
        }}
      />

      {/* Full-screen sheet */}
      <div
        className="absolute inset-0 bg-canvas flex flex-col overflow-x-hidden"
        style={{ animation: `${open ? "sheet-slide-in" : "sheet-slide-out"} 0.4s ${SPRING} forwards` }}
        onAnimationEnd={() => {
          if (open) amountRef.current?.focus();
          else setMounted(false);
        }}
      >
        {/* Drag handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--hairline)" }} />
        </div>

        {/* Nav bar */}
        <div style={{ display: "flex", alignItems: "center", padding: "4px 16px 12px", flexShrink: 0 }}>
          <button type="button" onClick={handleClose} className="bg-transparent border-none font-body text-[28px] text-ink-muted-48 cursor-pointer pr-2 leading-none">
            ✕
          </button>
          <span style={{ flex: 1, textAlign: "center", fontFamily: "var(--font-body)", fontSize: 17, fontWeight: 600, color: "var(--ink)", letterSpacing: -0.4 }}>
            {title}
          </span>
          <button type="button"
            onClick={submit}
            disabled={saving}
            className={`bg-transparent border-none font-body text-[17px] font-semibold pl-2 ${
              saving ? "text-ink-muted-48 cursor-not-allowed" : "text-primary cursor-pointer"
            }`}
          >
            {saving ? "…" : "Lưu"}
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", WebkitOverflowScrolling: "touch", padding: "8px 20px", paddingBottom: "max(40px, env(safe-area-inset-bottom))" } as React.CSSProperties}>

          {/* Repayment: locked debt chip */}
          {isRepayment && (
            <div style={{ background: "var(--canvas-parchment)", borderRadius: 12, padding: "12px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 18 }}>💸</span>
              <div>
                <div style={{ fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
                  {mode.debt.party} · {mode.debt.type === "lend" ? "Cho vay" : "Đi vay"}
                </div>
                <div style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--ink-muted-48)", marginTop: 2 }}>
                  Còn lại {fmt(mode.debt.remaining)}₫
                </div>
              </div>
            </div>
          )}

          {/* Edit: debt chip if tx is a debt tx */}
          {isEdit && editTx?.debt_id && !unlinkMode && (
            <div style={{ background: "var(--canvas-parchment)", borderRadius: 12, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>💸</span>
                <span style={{ fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
                  {editTx.debt_party} · {editTx.debt_type === "lend" ? "Cho vay" : "Đi vay"}
                  {editTx.is_opening_tx && <span style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--ink-muted-48)", marginLeft: 6 }}>(Gốc)</span>}
                </span>
              </div>
              <button type="button"
                onClick={() => setUnlinkMode(true)}
                className="bg-transparent border-none font-body text-[13px] text-danger cursor-pointer font-semibold"
              >
                Hủy liên kết
              </button>
            </div>
          )}

          {/* Type segmented — hidden when type is locked */}
          {!isRepayment && !(isEdit && editTx?.debt_id && !unlinkMode) && (
            <div style={{ display: "flex", background: "var(--canvas-parchment)", borderRadius: 11, padding: 4, marginBottom: 18 }}>
              {(["expense", "income"] as const).map((t) => (
                <button key={t} type="button" onClick={() => {
                  setType(t);
                  setError("");
                  if (t === "income") setSelectedCbIds([]);
                  // create mode: category list is type-specific, so reset selection
                  if (!isEdit && !isRepayment) setCategoryId(null);
                }}
                  style={{
                    flex: 1, padding: "9px", borderRadius: 8, border: "none",
                    background: type === t ? (t === "expense" ? "var(--danger)" : "var(--success)") : "transparent",
                    color: type === t ? "#fff" : "var(--ink-muted-48)",
                    fontFamily: "var(--font-body)", fontSize: 15, fontWeight: type === t ? 600 : 400,
                    cursor: "pointer", transition: "background 0.15s, color 0.15s",
                  }}
                >
                  {t === "expense" ? "Chi tiêu" : "Thu nhập"}
                </button>
              ))}
            </div>
          )}

          {/* Amount */}
          <div style={{ position: "relative", marginBottom: 18 }}>
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[22px] text-ink-muted-48 font-display font-semibold pointer-events-none">₫</span>
            <input
              type="text" inputMode="numeric" placeholder="0" aria-label="Số tiền"
              value={amountStr}
              onChange={(e) => { const raw = e.target.value.replace(/[^\d]/g, ""); setAmountStr(raw ? fmt(parseInt(raw, 10)) : ""); setError(""); }}
              ref={amountRef}
              style={{
                width: "100%", boxSizing: "border-box", padding: "14px 16px 14px 44px", borderRadius: 11,
                border: "1px solid var(--hairline)", fontFamily: "var(--font-display)",
                fontSize: 28, fontWeight: 600, color: amountColor,
                background: "var(--canvas-parchment)", outline: "none",
                letterSpacing: -0.3, textAlign: "right",
              }}
            />
          </div>

          {/* Date */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderTop: "1px solid var(--hairline)" }}>
            <span style={{ fontFamily: "var(--font-body)", fontSize: 15, color: "var(--ink)" }}>Ngày</span>
            <DatePicker value={date} onChange={setDate} />
          </div>

          {/* Category — hidden for debt transactions */}
          {!isDebtMode && (
            <div style={{ paddingTop: 14, paddingBottom: 8, borderTop: "1px solid var(--hairline)" }}>
              <p style={{ fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 600, color: "var(--ink-muted-48)", marginBottom: 10, letterSpacing: 0.5, textTransform: "uppercase" }}>
                Danh mục {selectedCatPath.length > 0 && <span style={{ color: "var(--primary)", fontWeight: 400, textTransform: "none", letterSpacing: 0, fontSize: 12 }}>· {selectedCatPath.join(" › ")}</span>}
              </p>
              <CategoryDrillDown cats={cats} selected={categoryId} onSelect={(id) => { setCategoryId(id); setError(""); }} usageCounts={usageCounts} />
            </div>
          )}

          {/* Custom budgets — expense only, hidden for debt */}
          {!isDebtMode && type === "expense" && customBudgets.length > 0 && (
            <div style={{ padding: "16px 0", borderTop: "1px solid var(--hairline)" }}>
              <p style={{ fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 600, color: "var(--ink-muted-48)", marginBottom: 8, letterSpacing: 0.5, textTransform: "uppercase" }}>Gán vào quỹ</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {customBudgets.map((cb) => {
                  const on = selectedCbIds.includes(cb.id);
                  return (
                    <button type="button" key={cb.id}
                      onClick={() => setSelectedCbIds((p) => on ? p.filter((x) => x !== cb.id) : [...p, cb.id])}
                      style={{
                        padding: "7px 14px", borderRadius: 999, cursor: "pointer",
                        border: on ? "none" : "1px solid var(--hairline)",
                        background: on ? "var(--ink)" : "var(--canvas-parchment)",
                        color: on ? "#fff" : "var(--ink-muted-48)",
                        fontFamily: "var(--font-body)", fontSize: 14, fontWeight: on ? 600 : 400,
                        transition: "background 0.12s, color 0.12s, border-color 0.12s",
                      }}
                    >
                      {on && "✓ "}{cb.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Note + emoji */}
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "14px 0", borderTop: "1px solid var(--hairline)" }}>
            <EmojiPicker value={emoji} onChange={setEmoji} />
            <input
              type="text" placeholder="Ghi chú (tuỳ chọn)" aria-label="Ghi chú"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{
                flex: 1, padding: "12px 16px", borderRadius: 11,
                border: "1px solid var(--hairline)", fontFamily: "var(--font-body)",
                fontSize: 15, color: "var(--ink)", background: "var(--canvas-parchment)", outline: "none",
              }}
            />
          </div>

          {/* Debt link section — only in create/edit-normal modes */}
          {!isRepayment && !(isEdit && editTx?.debt_id) && (
            <DebtLinkSection
              txType={type}
              state={debtLink}
              onChange={setDebtLink}
              openLends={openLends}
              openBorrows={openBorrows}
            />
          )}

          {error && (
            <p style={{ color: "var(--danger)", fontSize: 14, fontFamily: "var(--font-body)", marginTop: 16, marginBottom: 4 }}>{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
