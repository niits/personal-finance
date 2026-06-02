"use client";

import { useState, useEffect, useRef } from "react";
import { TransactionForm } from "@/components/organisms/TransactionForm";
import type { OrganizePreview, OrganizeSelection } from "@/components/organisms/OrganizeReviewSheet";

// ── Types ──────────────────────────────────────────────────────────────────

export type DashboardData = {
  month: string;
  period_start: string;
  period_end: string;
  total_expense: number;
  total_income: number;
  savings: number;
  monthly_budget: { id: number; amount: number; remaining: number } | null;
  days_in_period: number;
  days_elapsed: number;
  days_remaining: number;
  pace_status: "under" | "over" | "no_budget";
  daily_expenses: { date: string; amount: number }[];
};

export type Transaction = {
  id: number;
  amount: number;
  type: "expense" | "income";
  emoji: string | null;
  category: { id: number; name: string; emoji: string | null; path: string } | null;
  root_category_name: string;
  debt_id: string | null;
  debt_party: string | null;
  debt_type: "lend" | "borrow" | null;
  note: string | null;
  date: string;
  custom_budgets: { id: number; name: string }[];
  created_at: number;
  updated_at: number;
};

export type DashboardTemplateProps = {
  data: DashboardData | null;
  transactions: Transaction[];
  loading: boolean;
  selectedMonth: string;
  isCurrentMonth: boolean;
  deleting: boolean;
  actionTxn: Transaction | null;
  formOpen: boolean;
  editTxn: Transaction | undefined;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSetActionTxn: (txn: Transaction | null) => void;
  onOpenForm: (txn?: Transaction) => void;
  onCloseForm: () => void;
  onSaved: () => void;
  onDelete: (txn: Transaction) => void;
  organizeState: "idle" | "loading" | "review" | "applying";
  organizePreview: OrganizePreview | null;
  onOrganize: () => void;
  onOrganizeApply: (selection: OrganizeSelection) => void;
  onOrganizeClose: () => void;
  onFillEmoji?: () => void;
};

// ── Helpers ────────────────────────────────────────────────────────────────

const _fmtVND = new Intl.NumberFormat("vi-VN");
function fmt(n: number) {
  return _fmtVND.format(n);
}

function fmtPeriodDate(s: string) {
  const [, m, d] = s.split("-");
  return `${parseInt(d)}/${parseInt(m)}`;
}

function toMonthLabel(m: string) {
  const [y, mo] = m.split("-");
  return `Tháng ${parseInt(mo)}/${y}`;
}

function prevMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`;
}

function nextMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
}

const WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function formatDateHeader(s: string) {
  const today = new Date();
  const todayStr = today.toISOString().substring(0, 10);
  const yest = new Date(today);
  yest.setDate(today.getDate() - 1);
  if (s === todayStr) return "Hôm nay";
  if (s === yest.toISOString().substring(0, 10)) return "Hôm qua";
  const d = new Date(s + "T00:00:00");
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()}/${d.getMonth() + 1}`;
}

function groupByDate(txns: Transaction[]) {
  const groups: Record<string, Transaction[]> = {};
  for (const t of txns) {
    if (!groups[t.date]) groups[t.date] = [];
    groups[t.date].push(t);
  }
  return groups;
}

// ── Sub-components ─────────────────────────────────────────────────────────

function TxnIcon({ txn }: { txn: Transaction }) {
  const isExp = txn.type === "expense";
  const displayEmoji = txn.emoji ?? txn.category?.emoji;
  if (displayEmoji) {
    return (
      <div
        className="size-8 rounded-full shrink-0 flex items-center justify-center text-[17px]"
        style={{ background: isExp ? "rgba(255,59,48,0.08)" : "rgba(52,199,89,0.08)" }}
      >
        {displayEmoji + "️"}
      </div>
    );
  }
  return (
    <div
      className="size-8 rounded-full shrink-0 flex items-center justify-center font-display text-[13px] font-semibold"
      style={{
        background: isExp ? "rgba(255,59,48,0.12)" : "rgba(52,199,89,0.12)",
        color: isExp ? "var(--danger)" : "var(--success)",
      }}
    >
      {(txn.category?.name ?? "◈").charAt(0).toUpperCase()}
    </div>
  );
}

// ── Template ───────────────────────────────────────────────────────────────

export function DashboardTemplate({
  data,
  transactions,
  loading,
  selectedMonth,
  isCurrentMonth,
  deleting,
  actionTxn,
  formOpen,
  editTxn,
  onPrevMonth,
  onNextMonth,
  onSetActionTxn,
  onOpenForm,
  onCloseForm,
  onSaved,
  onDelete,
  organizeState,
  organizePreview,
  onOrganize,
  onOrganizeApply,
  onOrganizeClose,
  onFillEmoji,
}: DashboardTemplateProps) {
  const [selectedRoot, setSelectedRoot] = useState<string | null>(null);

  const budgetPct = data?.monthly_budget
    ? Math.min((data.total_expense / data.monthly_budget.amount) * 100, 100) : 0;

  const pacePct = data
    ? Math.min((data.days_elapsed / data.days_in_period) * 100, 100) : 0;

  const rootCounts = new Map<string, number>();
  for (const t of transactions) {
    if (t.type === "expense")
      rootCounts.set(t.root_category_name, (rootCounts.get(t.root_category_name) ?? 0) + 1);
  }
  const topRoots = [...rootCounts.entries()].toSorted((a, b) => b[1] - a[1]).slice(0, 3).map(([n]) => n);

  const filteredTxns = selectedRoot ? transactions.filter((t) => t.root_category_name === selectedRoot) : transactions;
  const groups = groupByDate(filteredTxns);
  const dates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  const totalExpense = data?.total_expense ?? 0;
  const filteredExpense = filteredTxns
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);
  const targetAmount = loading ? 0 : (selectedRoot ? filteredExpense : totalExpense);

  const [displayedAmount, setDisplayedAmount] = useState(targetAmount);
  const animRef = useRef<number | null>(null);
  const prevAmountRef = useRef(targetAmount);

  useEffect(() => {
    const start = prevAmountRef.current;
    const target = targetAmount;
    if (start === target) return;
    const duration = 350;
    const startTime = performance.now();
    if (animRef.current) cancelAnimationFrame(animRef.current);
    function tick(now: number) {
      const p = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplayedAmount(Math.round(start + (target - start) * eased));
      if (p < 1) { animRef.current = requestAnimationFrame(tick); }
      else { prevAmountRef.current = target; }
    }
    animRef.current = requestAnimationFrame(tick);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [targetAmount]);

  const chevronStyle = (disabled?: boolean): React.CSSProperties => ({
    background: "none", border: "none", cursor: disabled ? "default" : "pointer",
    color: disabled ? "transparent" : "var(--body-muted)",
    fontSize: 18, padding: "0 6px", lineHeight: 1, flexShrink: 0,
  });

  const isOver = data?.monthly_budget ? data.monthly_budget.remaining < 0 : false;
  const barColor = isOver ? "var(--danger)" : "var(--primary)";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100dvh - 44px - 72px)" }}>

      {/* ── Header ── */}
      <div style={{ background: "var(--surface-black)", color: "var(--on-dark)", padding: "28px 20px 24px", flexShrink: 0 }}>

        {/* Month navigation */}
        <div style={{ display: "flex", alignItems: "center", gap: 2, marginBottom: 2 }}>
          <button type="button" style={chevronStyle()} onClick={onPrevMonth}>‹</button>
          <span style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--body-muted)", letterSpacing: -0.12 }}>
            {selectedMonth ? toMonthLabel(selectedMonth) : ""}
          </span>
          <button type="button" style={chevronStyle(isCurrentMonth)} onClick={() => !isCurrentMonth && onNextMonth()}>›</button>
        </div>

        {data && (
          <p style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--body-muted)", letterSpacing: -0.1, marginBottom: 8 }}>
            {fmtPeriodDate(data.period_start)} – {fmtPeriodDate(data.period_end)}
          </p>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <p style={{ fontFamily: "var(--font-display)", fontSize: 38, fontWeight: 600, lineHeight: 1.1, letterSpacing: -0.5 }}>
            {loading ? "—" : `${fmt(displayedAmount)}₫`}
          </p>
          {onFillEmoji && (
            <button type="button"
              onClick={onFillEmoji}
              className="border-none rounded-full size-8 flex items-center justify-center cursor-pointer text-base shrink-0 mt-0.5"
              style={{ background: "rgba(255,255,255,0.12)" }}
              title="Gợi ý emoji"
            >
              ✦
            </button>
          )}
        </div>
        <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--body-muted)", marginTop: 4, letterSpacing: -0.224 }}>
          {selectedRoot && !loading
            ? <span>trong tổng <span style={{ color: "var(--on-dark)", fontWeight: 600 }}>{fmt(totalExpense)}₫</span> đã chi tháng này</span>
            : "đã chi tháng này"}
        </p>

        {/* Budget bar with pace background */}
        {data?.monthly_budget && (
          <div style={{ marginTop: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: "var(--body-muted)", fontFamily: "var(--font-body)" }}>
                Ngân sách {fmt(data.monthly_budget.amount)}₫
              </span>
              <span style={{ fontSize: 12, fontFamily: "var(--font-body)", fontWeight: 600, color: isOver ? "var(--danger)" : "var(--success)" }}>
                {isOver ? "Vượt " : "Còn "}{fmt(Math.abs(data.monthly_budget.remaining))}₫
              </span>
            </div>

            <div style={{ position: "relative", height: 4, borderRadius: 2, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
              <div style={{
                position: "absolute", inset: 0,
                width: `${pacePct}%`,
                background: "rgba(255,255,255,0.18)",
                borderRadius: 2,
              }} />
              <div style={{
                position: "absolute", inset: 0,
                width: `${budgetPct}%`,
                background: barColor,
                borderRadius: 2,
                transition: "width 0.6s ease",
              }} />
            </div>
          </div>
        )}

        {/* Income/savings — only when income exists */}
        {data && data.total_income > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, marginTop: 16, borderRadius: "var(--radius-md)", overflow: "hidden" }}>
            <div style={{ background: "rgba(255,255,255,0.07)", padding: "12px 14px" }}>
              <p style={{ fontSize: 12, color: "var(--body-muted)", fontFamily: "var(--font-body)", marginBottom: "var(--space-xs)" }}>Thu nhập</p>
              <p style={{ fontSize: 17, fontWeight: 600, fontFamily: "var(--font-display)", color: "var(--success)", letterSpacing: -0.374 }}>+{fmt(data.total_income)}₫</p>
            </div>
            <div style={{ background: "rgba(255,255,255,0.07)", padding: "12px 14px" }}>
              <p style={{ fontSize: 12, color: "var(--body-muted)", fontFamily: "var(--font-body)", marginBottom: "var(--space-xs)" }}>Tiết kiệm</p>
              <p style={{ fontSize: 17, fontWeight: 600, fontFamily: "var(--font-display)", color: data.savings >= 0 ? "#fff" : "var(--danger)", letterSpacing: -0.374 }}>
                {data.savings >= 0 ? "+" : ""}{fmt(data.savings)}₫
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Category chips ── */}
      {topRoots.length > 0 && (
        <div style={{ display: "flex", gap: 8, padding: "10px 16px", background: "var(--canvas)", borderBottom: "1px solid var(--hairline)", alignItems: "center" }}>
          {(["Tất cả", ...topRoots] as string[]).map((label) => {
            const isAll = label === "Tất cả";
            const active = isAll ? selectedRoot === null : selectedRoot === label;
            return (
              <button type="button"
                key={label}
                onClick={() => setSelectedRoot(isAll ? null : (selectedRoot === label ? null : label))}
                className={`flex-1 px-1 py-1.5 rounded-full border-none cursor-pointer font-body text-[14px] font-semibold truncate ${active ? "bg-primary text-white" : "bg-canvas-parchment text-ink"}`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Transaction list ── */}
      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" } as React.CSSProperties}>

        {/* Setup checklist */}
        {!loading && !data?.monthly_budget && (
          <div style={{ padding: "20px 16px" }}>
            <div style={{ background: "var(--canvas)", borderRadius: "var(--radius-lg)", padding: "20px", border: "1px solid var(--hairline)" }}>
              <p style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600, color: "var(--ink)", marginBottom: 16 }}>Bắt đầu nào 👋</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { href: "/categories", icon: "⊞", title: "Tạo danh mục", sub: "Phân loại chi tiêu của bạn" },
                  { href: "/budget", icon: "◈", title: "Đặt ngân sách tháng", sub: "Kiểm soát mức chi tiêu" },
                ].map((item) => (
                  <a key={item.href} href={item.href} className="flex items-center gap-3 px-4 py-3 bg-canvas-parchment rounded-md no-underline text-ink">
                    <span style={{ fontSize: 20 }}>{item.icon}</span>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, fontFamily: "var(--font-body)" }}>{item.title}</p>
                      <p style={{ fontSize: 12, color: "var(--ink-muted-48)", fontFamily: "var(--font-body)" }}>{item.sub}</p>
                    </div>
                    <span style={{ marginLeft: "auto", color: "var(--primary)", fontSize: 14 }}>→</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ padding: "48px", textAlign: "center", color: "var(--ink-muted-48)", fontFamily: "var(--font-body)", fontSize: 14 }}>Đang tải…</div>
        ) : transactions.length === 0 ? (
          <div style={{ padding: "40px 22px", textAlign: "center" }}>
            <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--ink-muted-48)" }}>Chưa có giao dịch nào</p>
          </div>
        ) : (
          dates.map((d) => (
            <div key={d}>
              <div style={{ padding: "10px 16px 6px", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 600, color: "var(--ink)", letterSpacing: -0.224 }}>{formatDateHeader(d)}</span>
                <span style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--ink-muted-48)" }}>
                  {fmt(groups[d].reduce((s, t) => s + (t.type === "expense" ? -t.amount : t.amount), 0))}₫
                </span>
              </div>
              <div style={{ background: "var(--canvas)" }}>
                {groups[d].map((txn, i) => (
                  <div key={txn.id} onClick={() => onSetActionTxn(txn)}
                    role="button" tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSetActionTxn(txn); } }}
                    style={{ display: "flex", alignItems: "center", padding: "10px 16px", borderTop: i > 0 ? "1px solid var(--hairline)" : "none", cursor: "pointer", minHeight: 44, gap: 10 }}>
                    <TxnIcon txn={txn} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="font-body text-[15px] text-ink tracking-[-0.374px] truncate leading-[1.3]">
                        {txn.category?.name ?? "Khoản nợ"}
                      </p>
                      <p className="font-body text-xs text-ink-muted-48 truncate leading-[1.3] min-h-[1em]">
                        {txn.note ?? ""}
                      </p>
                      {txn.debt_party && (
                        <p style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--ink-muted-48)", lineHeight: 1.3, marginTop: 1 }}>
                          💸 {txn.debt_type === "lend" ? "Cho vay" : "Đi vay"} · {txn.debt_party}
                        </p>
                      )}
                      {txn.custom_budgets.length > 0 && (
                        <div style={{ display: "flex", gap: 4, marginTop: 3, alignItems: "center" }}>
                          {txn.custom_budgets.slice(0, 2).map((cb) => (
                            <span key={cb.id} className="font-body text-xs font-semibold px-[7px] py-0.5 rounded-[10px] text-primary whitespace-nowrap max-w-[90px] overflow-hidden text-ellipsis" style={{ background: "rgba(0,102,204,0.08)" }}>
                              {cb.name}
                            </span>
                          ))}
                          {txn.custom_budgets.length > 2 && (
                            <span className="font-body text-xs font-semibold px-1.5 py-0.5 rounded-[10px] bg-canvas-parchment text-ink-muted-48 whitespace-nowrap">
                              +{txn.custom_budgets.length - 2}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      <p style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600, color: txn.type === "expense" ? "var(--danger)" : "var(--success)", letterSpacing: -0.2 }}>
                        {txn.type === "expense" ? "−" : "+"}{fmt(txn.amount)}₫
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── FAB ── */}
      {data?.monthly_budget && (
        <div style={{ position: "fixed", bottom: 84, right: 20, zIndex: 40 }}>
          <button type="button" onClick={() => onOpenForm()}
            className="size-14 rounded-full bg-primary text-white text-[28px] leading-none border-none cursor-pointer flex items-center justify-center shadow-[0_4px_16px_rgba(0,102,204,0.4)]">
            +
          </button>
        </div>
      )}

      {/* ── Action sheet ── */}
      {actionTxn && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          <button type="button" aria-label="Đóng" onClick={() => onSetActionTxn(null)} style={{ position: "absolute", inset: 0, border: "none", padding: 0, cursor: "pointer", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" } as React.CSSProperties} />
          <div style={{ position: "relative", background: "var(--canvas)", borderRadius: "20px 20px 0 0", paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}>
            <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 8px" }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--hairline)" }} />
            </div>
            <div style={{ padding: "0 20px 16px", borderBottom: "1px solid var(--hairline)" }}>
              <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--ink-muted-48)", marginBottom: 2 }}>{actionTxn.category?.path ?? "Khoản nợ"}</p>
              <p style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 600, color: actionTxn.type === "expense" ? "var(--danger)" : "var(--success)", letterSpacing: -0.3 }}>
                {actionTxn.type === "expense" ? "−" : "+"}{fmt(actionTxn.amount)}₫
              </p>
              {actionTxn.note && <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--ink-muted-48)", marginTop: 2 }}>{actionTxn.note}</p>}
              {actionTxn.custom_budgets.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                  {actionTxn.custom_budgets.map((cb) => (
                    <span key={cb.id} style={{ fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 12, background: "rgba(0,102,204,0.08)", color: "var(--primary)" }}>
                      {cb.name}
                    </span>
                  ))}
                </div>
              )}
              {actionTxn.updated_at !== actionTxn.created_at && (
                <p suppressHydrationWarning style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--ink-muted-48)", marginTop: 8 }}>
                  Cập nhật {new Date(actionTxn.updated_at * 1000).toLocaleString("vi-VN", { day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
            </div>
            <div style={{ padding: "12px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
              <button type="button" onClick={() => { onOpenForm(actionTxn); onSetActionTxn(null); }}
                className="w-full p-[14px] rounded-xl border-none bg-canvas-parchment text-ink font-body text-base font-semibold cursor-pointer">
                Sửa
              </button>
              <button type="button" onClick={() => onDelete(actionTxn)} disabled={deleting}
                className={`w-full p-[14px] rounded-xl border-none font-body text-base font-semibold ${deleting ? "cursor-not-allowed opacity-60" : "cursor-pointer opacity-100"}`}
                style={{ background: "rgba(255,59,48,0.1)", color: "var(--danger)" }}>
                {deleting ? "Đang xoá…" : "Xoá"}
              </button>
            </div>
          </div>
        </div>
      )}

      <TransactionForm
        key={editTxn?.id ?? "create"}
        open={formOpen}
        onClose={onCloseForm}
        onSaved={onSaved}
        mode={editTxn ? {
          kind: "edit",
          transaction: {
            id: editTxn.id,
            amount: editTxn.amount,
            type: editTxn.type,
            emoji: editTxn.emoji,
            category: editTxn.category,
            debt_id: editTxn.debt_id,
            debt_party: editTxn.debt_party,
            debt_type: editTxn.debt_type,
            is_opening_tx: false,
            note: editTxn.note,
            date: editTxn.date,
            custom_budgets: editTxn.custom_budgets,
          },
        } : { kind: "create" }}
      />

    </div>
  );
}
