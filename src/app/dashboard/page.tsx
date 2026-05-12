"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { getDB } from "@/lib/firebase-client";
import {
  categoriesCol,
  customBudgetsCol,
  monthlyBudgetsCol,
  transactionsCol,
  adjustmentsCol,
} from "@/lib/firestore-refs";
import { useCollection } from "@/lib/hooks/useFirestore";
import { query, where, limit } from "firebase/firestore";
import { currentBudgetMonth, getBudgetPeriodInclusive } from "@/lib/validators";
import {
  deriveDashboard,
  buildCategoryPath,
  getRootCategoryName,
} from "@/lib/derive/dashboard";
import { deleteTransaction } from "@/lib/data/transactions";
import TransactionForm from "@/components/TransactionForm";
import type {
  Category,
  CustomBudget,
  Transaction,
} from "@/lib/schema";

function fmt(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n);
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

type EnrichedTxn = Transaction & {
  category: { id: string; name: string; path: string };
  root_category_name: string;
  custom_budgets: { id: string; name: string }[];
};

function groupByDate(txns: EnrichedTxn[]) {
  const groups: Record<string, EnrichedTxn[]> = {};
  for (const t of txns) {
    if (!groups[t.date]) groups[t.date] = [];
    groups[t.date].push(t);
  }
  return groups;
}

function TxnIcon({ name, type }: { name: string; type: "expense" | "income" }) {
  const isExp = type === "expense";
  return (
    <div style={{
      width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
      background: isExp ? "rgba(255,69,58,0.12)" : "rgba(48,209,88,0.12)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 600,
      color: isExp ? "#ff453a" : "#30d158",
    }}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function DashboardPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const uid = session?.user.id;

  const [selectedMonth, setSelectedMonth] = useState(currentBudgetMonth());
  const [selectedRoot, setSelectedRoot] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editTxn, setEditTxn] = useState<Transaction | undefined>(undefined);
  const [actionTxn, setActionTxn] = useState<EnrichedTxn | null>(null);
  const [deleting, setDeleting] = useState(false);

  const db = getDB();

  // Subscribe to budget for selectedMonth.
  const budgetQuery = useMemo(
    () =>
      uid
        ? query(monthlyBudgetsCol(db, uid), where("month", "==", selectedMonth), limit(1))
        : null,
    [db, uid, selectedMonth],
  );
  const budgetState = useCollection(budgetQuery, [uid, selectedMonth]);
  const budget = budgetState.data?.[0] ?? null;

  // Subscribe to adjustments for current budget.
  const adjQuery = useMemo(
    () => (uid && budget ? adjustmentsCol(db, uid, budget.id) : null),
    [db, uid, budget],
  );
  const adjustmentsState = useCollection(adjQuery, [uid, budget?.id]);
  const adjustments = useMemo(() => adjustmentsState.data ?? [], [adjustmentsState.data]);

  // Period bounds for transaction subscription.
  const period = useMemo(() => getBudgetPeriodInclusive(selectedMonth), [selectedMonth]);

  // Subscribe to transactions in period.
  const txQuery = useMemo(
    () =>
      uid
        ? query(
            transactionsCol(db, uid),
            where("date", ">=", period.start_date),
            where("date", "<=", period.end_date),
          )
        : null,
    [db, uid, period.start_date, period.end_date],
  );
  const txState = useCollection(txQuery, [uid, period.start_date, period.end_date]);

  // Subscribe to categories + custom budgets for label hydration.
  const catQuery = useMemo(() => (uid ? categoriesCol(db, uid) : null), [db, uid]);
  const catState = useCollection(catQuery, [uid]);
  const cats: Category[] = useMemo(() => catState.data ?? [], [catState.data]);

  const cbQuery = useMemo(() => (uid ? customBudgetsCol(db, uid) : null), [db, uid]);
  const cbState = useCollection(cbQuery, [uid]);
  const customBudgets: CustomBudget[] = useMemo(() => cbState.data ?? [], [cbState.data]);

  // Redirect if logged out.
  if (!isPending && !session) router.replace("/");

  const catMap = useMemo(() => {
    const m = new Map<string, { name: string; parentId: string | null }>();
    for (const c of cats) m.set(c.id, { name: c.name, parentId: c.parentId });
    return m;
  }, [cats]);

  const cbMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const cb of customBudgets) m.set(cb.id, cb.name);
    return m;
  }, [customBudgets]);

  const enriched: EnrichedTxn[] = useMemo(() => {
    const txns = txState.data ?? [];
    const sorted = [...txns].sort((a, b) =>
      a.date < b.date ? 1 : a.date > b.date ? -1 : a.id.localeCompare(b.id) > 0 ? -1 : 1,
    );
    return sorted.map((t) => ({
      ...t,
      category: {
        id: t.categoryId,
        name: catMap.get(t.categoryId)?.name ?? "(unknown)",
        path: buildCategoryPath(t.categoryId, catMap),
      },
      root_category_name: getRootCategoryName(t.categoryId, catMap),
      custom_budgets: t.customBudgetIds.map((id) => ({
        id,
        name: cbMap.get(id) ?? "(unknown)",
      })),
    }));
  }, [txState.data, catMap, cbMap]);

  const dashboard = useMemo(
    () =>
      deriveDashboard({
        month: selectedMonth,
        budget,
        adjustments,
        transactions: txState.data ?? [],
      }),
    [selectedMonth, budget, adjustments, txState.data],
  );

  const loading = isPending || txState.loading || budgetState.loading;
  const isCurrentMonth = selectedMonth === currentBudgetMonth();

  const budgetPct = dashboard.monthly_budget
    ? Math.min((dashboard.total_expense / dashboard.monthly_budget.amount) * 100, 100)
    : 0;
  const pacePct = Math.min((dashboard.days_elapsed / dashboard.days_in_period) * 100, 100);

  const rootCounts = new Map<string, number>();
  for (const t of enriched) {
    if (t.type === "expense")
      rootCounts.set(t.root_category_name, (rootCounts.get(t.root_category_name) ?? 0) + 1);
  }
  const topRoots = [...rootCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([n]) => n);

  const filteredTxns = selectedRoot
    ? enriched.filter((t) => t.root_category_name === selectedRoot)
    : enriched;
  const groups = groupByDate(filteredTxns);
  const dates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  const chevronStyle = (disabled?: boolean): React.CSSProperties => ({
    background: "none", border: "none", cursor: disabled ? "default" : "pointer",
    color: disabled ? "transparent" : "rgba(255,255,255,0.5)",
    fontSize: 18, padding: "0 6px", lineHeight: 1, flexShrink: 0,
  });

  const isOver = dashboard.monthly_budget ? dashboard.monthly_budget.remaining < 0 : false;
  const barColor = isOver ? "#ff453a" : "var(--primary)";

  async function handleDelete(txn: EnrichedTxn) {
    if (!uid) return;
    setDeleting(true);
    try {
      await deleteTransaction(db, uid, txn.id);
      setActionTxn(null);
    } catch (e) {
      console.error(e);
    } finally {
      setDeleting(false);
    }
  }

  function navigate(m: string) {
    setSelectedMonth(m);
    setSelectedRoot(null);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100svh - 44px - 72px)", overflow: "hidden" }}>

      <div style={{ background: "var(--surface-black)", color: "var(--on-dark)", flexShrink: 0, padding: "28px 20px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 2, marginBottom: 2 }}>
          <button style={chevronStyle()} onClick={() => navigate(prevMonth(selectedMonth))}>‹</button>
          <span style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "rgba(255,255,255,0.5)", letterSpacing: -0.12 }}>
            {toMonthLabel(selectedMonth)}
          </span>
          <button style={chevronStyle(isCurrentMonth)} onClick={() => !isCurrentMonth && navigate(nextMonth(selectedMonth))}>›</button>
        </div>

        <p style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: -0.1, marginBottom: 8 }}>
          {fmtPeriodDate(dashboard.period_start)} – {fmtPeriodDate(dashboard.period_end)}
        </p>

        <p style={{ fontFamily: "var(--font-display)", fontSize: 38, fontWeight: 600, lineHeight: 1.1, letterSpacing: -0.5 }}>
          {loading ? "—" : `${fmt(dashboard.total_expense)}₫`}
        </p>
        <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "rgba(255,255,255,0.45)", marginTop: 4, letterSpacing: -0.224 }}>
          đã chi tháng này
        </p>

        {dashboard.monthly_budget && (
          <div style={{ marginTop: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontFamily: "var(--font-body)" }}>
                Ngân sách {fmt(dashboard.monthly_budget.amount)}₫
              </span>
              <span style={{ fontSize: 12, fontFamily: "var(--font-body)", fontWeight: 600, color: isOver ? "#ff453a" : "#30d158" }}>
                {isOver ? "Vượt " : "Còn "}{fmt(Math.abs(dashboard.monthly_budget.remaining))}₫
              </span>
            </div>
            <div style={{ position: "relative", height: 4, borderRadius: 2, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
              <div style={{
                position: "absolute", inset: 0, width: `${pacePct}%`,
                background: "rgba(255,255,255,0.18)", borderRadius: 2,
              }} />
              <div style={{
                position: "absolute", inset: 0, width: `${budgetPct}%`,
                background: barColor, borderRadius: 2, transition: "width 0.6s ease",
              }} />
            </div>
          </div>
        )}

        {dashboard.total_income > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, marginTop: 16, borderRadius: 10, overflow: "hidden" }}>
            <div style={{ background: "rgba(255,255,255,0.07)", padding: "10px 14px" }}>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-body)", marginBottom: 3 }}>Thu nhập</p>
              <p style={{ fontSize: 16, fontWeight: 600, fontFamily: "var(--font-display)", color: "#30d158", letterSpacing: -0.3 }}>+{fmt(dashboard.total_income)}₫</p>
            </div>
            <div style={{ background: "rgba(255,255,255,0.07)", padding: "10px 14px" }}>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-body)", marginBottom: 3 }}>Tiết kiệm</p>
              <p style={{ fontSize: 16, fontWeight: 600, fontFamily: "var(--font-display)", color: dashboard.savings >= 0 ? "#fff" : "#ff453a", letterSpacing: -0.3 }}>
                {dashboard.savings >= 0 ? "+" : ""}{fmt(dashboard.savings)}₫
              </p>
            </div>
          </div>
        )}
      </div>

      {topRoots.length > 0 && (
        <div style={{ flexShrink: 0, display: "flex", gap: 8, padding: "10px 16px", background: "var(--canvas)", borderBottom: "1px solid var(--hairline)" }}>
          {(["Tất cả", ...topRoots] as string[]).map((label) => {
            const isAll = label === "Tất cả";
            const active = isAll ? selectedRoot === null : selectedRoot === label;
            return (
              <button
                key={label}
                onClick={() => setSelectedRoot(isAll ? null : (selectedRoot === label ? null : label))}
                style={{ flex: 1, padding: "6px 4px", borderRadius: 999, border: "none", cursor: "pointer", fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 500, background: active ? "var(--primary)" : "var(--canvas-parchment)", color: active ? "#fff" : "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" } as React.CSSProperties}>

        {!loading && !dashboard.monthly_budget && (
          <div style={{ padding: "20px 16px" }}>
            <div style={{ background: "var(--canvas)", borderRadius: "var(--radius-lg)", padding: "20px", border: "1px solid var(--hairline)" }}>
              <p style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600, color: "var(--ink)", marginBottom: 16 }}>Bắt đầu nào 👋</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { href: "/dashboard/categories", icon: "⊞", title: "Tạo danh mục", sub: "Phân loại chi tiêu của bạn" },
                  { href: "/dashboard/budget", icon: "◈", title: "Đặt ngân sách tháng", sub: "Kiểm soát mức chi tiêu" },
                ].map((item) => (
                  <a key={item.href} href={item.href} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "var(--canvas-parchment)", borderRadius: 11, textDecoration: "none", color: "var(--ink)" }}>
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
        ) : enriched.length === 0 ? (
          <div style={{ padding: "40px 22px", textAlign: "center" }}>
            <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--ink-muted-48)" }}>Chưa có giao dịch nào</p>
          </div>
        ) : (
          dates.map((d) => (
            <div key={d}>
              <div style={{ padding: "10px 16px 6px", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600, color: "var(--ink)", letterSpacing: -0.224 }}>{formatDateHeader(d)}</span>
                <span style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--ink-muted-48)" }}>
                  {fmt(groups[d].reduce((s, t) => s + (t.type === "expense" ? -t.amount : t.amount), 0))}₫
                </span>
              </div>
              <div style={{ background: "var(--canvas)" }}>
                {groups[d].map((txn, i) => (
                  <div key={txn.id} onClick={() => setActionTxn(txn)}
                    style={{ display: "flex", alignItems: "center", padding: "10px 16px", borderTop: i > 0 ? "1px solid var(--hairline)" : "none", cursor: "pointer", minHeight: 44, gap: 10 }}>
                    <TxnIcon name={txn.category.name} type={txn.type} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: "var(--font-body)", fontSize: 15, color: "var(--ink)", letterSpacing: -0.374, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.3 }}>
                        {txn.category.name}
                      </p>
                      <p style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--ink-muted-48)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.3, minHeight: "1em" }}>
                        {txn.note ?? ""}
                      </p>
                      {txn.custom_budgets.length > 0 && (
                        <div style={{ display: "flex", gap: 4, marginTop: 3, alignItems: "center" }}>
                          {txn.custom_budgets.slice(0, 2).map((cb) => (
                            <span key={cb.id} style={{ fontFamily: "var(--font-body)", fontSize: 10, fontWeight: 500, padding: "2px 7px", borderRadius: 10, background: "rgba(0,102,204,0.08)", color: "var(--primary)", whiteSpace: "nowrap", maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis" }}>
                              {cb.name}
                            </span>
                          ))}
                          {txn.custom_budgets.length > 2 && (
                            <span style={{ fontFamily: "var(--font-body)", fontSize: 10, fontWeight: 500, padding: "2px 6px", borderRadius: 10, background: "var(--canvas-parchment)", color: "var(--ink-muted-48)", whiteSpace: "nowrap" }}>
                              +{txn.custom_budgets.length - 2}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <p style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600, color: txn.type === "expense" ? "#ff453a" : "#30d158", letterSpacing: -0.2, flexShrink: 0 }}>
                      {txn.type === "expense" ? "−" : "+"}{fmt(txn.amount)}₫
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {dashboard.monthly_budget && (
        <div style={{ position: "fixed", bottom: 84, right: 20, zIndex: 40 }}>
          <button onClick={() => { setEditTxn(undefined); setFormOpen(true); }}
            style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--primary)", color: "#fff", fontSize: 28, lineHeight: 1, border: "none", cursor: "pointer", boxShadow: "0 4px 16px rgba(0,102,204,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            +
          </button>
        </div>
      )}

      {actionTxn && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          <div onClick={() => setActionTxn(null)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }} />
          <div style={{ position: "relative", background: "var(--canvas)", borderRadius: "20px 20px 0 0", paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}>
            <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 8px" }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--hairline)" }} />
            </div>
            <div style={{ padding: "0 20px 16px", borderBottom: "1px solid var(--hairline)" }}>
              <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--ink-muted-48)", marginBottom: 2 }}>{actionTxn.category.path}</p>
              <p style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 600, color: actionTxn.type === "expense" ? "#ff453a" : "#30d158", letterSpacing: -0.3 }}>
                {actionTxn.type === "expense" ? "−" : "+"}{fmt(actionTxn.amount)}₫
              </p>
              {actionTxn.note && <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--ink-muted-48)", marginTop: 2 }}>{actionTxn.note}</p>}
              {actionTxn.custom_budgets.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                  {actionTxn.custom_budgets.map((cb) => (
                    <span key={cb.id} style={{ fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 500, padding: "3px 10px", borderRadius: 12, background: "rgba(0,102,204,0.08)", color: "var(--primary)" }}>
                      {cb.name}
                    </span>
                  ))}
                </div>
              )}
              {actionTxn.updatedAt && actionTxn.createdAt &&
                actionTxn.updatedAt.toMillis() !== actionTxn.createdAt.toMillis() && (
                <p style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "var(--ink-muted-48)", marginTop: 8 }}>
                  Cập nhật {actionTxn.updatedAt.toDate().toLocaleString("vi-VN", { day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
            </div>
            <div style={{ padding: "12px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
              <button onClick={() => { setEditTxn(actionTxn); setActionTxn(null); setFormOpen(true); }}
                style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", background: "var(--canvas-parchment)", color: "var(--ink)", fontFamily: "var(--font-body)", fontSize: 16, fontWeight: 600, cursor: "pointer" }}>
                Sửa
              </button>
              <button onClick={() => handleDelete(actionTxn)} disabled={deleting}
                style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", background: "rgba(255,69,58,0.1)", color: "#ff453a", fontFamily: "var(--font-body)", fontSize: 16, fontWeight: 600, cursor: deleting ? "not-allowed" : "pointer", opacity: deleting ? 0.6 : 1 }}>
                {deleting ? "Đang xoá…" : "Xoá"}
              </button>
            </div>
          </div>
        </div>
      )}

      <TransactionForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditTxn(undefined); }}
        onSaved={() => { /* onSnapshot auto-refreshes */ }}
        transaction={editTxn}
      />
    </div>
  );
}
