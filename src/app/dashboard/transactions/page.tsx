"use client";

import { useEffect, useState, useCallback } from "react";
import TransactionForm from "@/components/TransactionForm";

type Transaction = {
  id: number;
  amount: number;
  type: "expense" | "income";
  category: { id: number; name: string; path: string };
  note: string | null;
  date: string;
};

function fmt(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n);
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function formatDateHeader(s: string) {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

  if (s === todayStr) return "Hôm nay";
  if (s === yStr) return "Hôm qua";

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

export default function TransactionsPage() {
  const month = currentMonth();
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState({ total_expense: 0, total_income: 0, savings: 0 });
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/transactions?month=${month}`);
    const d = await r.json() as { transactions?: Transaction[]; summary?: typeof summary };
    setTxns(d.transactions ?? []);
    setSummary(d.summary ?? { total_expense: 0, total_income: 0, savings: 0 });
    setLoading(false);
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const groups = groupByDate(txns);
  const dates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  return (
    <div>
      {/* Header */}
      <div style={{
        background: "var(--surface-black)",
        padding: "28px 22px 24px",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
      }}>
        <div>
          <h1 style={{
            fontFamily: "var(--font-display)",
            fontSize: 28,
            fontWeight: 600,
            color: "var(--on-dark)",
            letterSpacing: -0.28,
          }}>
            Giao dịch
          </h1>
        </div>
        <button
          onClick={() => setFormOpen(true)}
          style={{
            background: "var(--primary)",
            color: "#fff",
            border: "none",
            borderRadius: 999,
            padding: "8px 18px",
            fontFamily: "var(--font-body)",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          + Thêm
        </button>
      </div>

      {/* Summary strip */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        background: "var(--surface-tile-1)",
      }}>
        {[
          { label: "Chi", value: summary.total_expense, color: "#ff453a", sign: "-" },
          { label: "Thu", value: summary.total_income, color: "#30d158", sign: "+" },
          { label: "Tiết kiệm", value: summary.savings, color: summary.savings >= 0 ? "#fff" : "#ff453a", sign: summary.savings >= 0 ? "+" : "" },
        ].map((s, i) => (
          <div key={s.label} style={{
            padding: "12px 10px",
            textAlign: "center",
            borderRight: i < 2 ? "1px solid rgba(255,255,255,0.08)" : "none",
          }}>
            <p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-body)", marginBottom: 3 }}>{s.label}</p>
            <p style={{ fontSize: 14, fontWeight: 600, color: s.color, fontFamily: "var(--font-display)", letterSpacing: -0.2 }}>
              {s.sign}{fmt(Math.abs(s.value))}
            </p>
          </div>
        ))}
      </div>

      {/* List */}
      <div style={{ paddingBottom: 8 }}>
        {loading ? (
          <div style={{ padding: "48px", textAlign: "center", color: "var(--ink-muted-48)", fontFamily: "var(--font-body)", fontSize: 14 }}>
            Đang tải…
          </div>
        ) : txns.length === 0 ? (
          <div style={{ padding: "48px 22px", textAlign: "center" }}>
            <p style={{ fontFamily: "var(--font-display)", fontSize: 21, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>
              Chưa có giao dịch
            </p>
            <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--ink-muted-48)", marginBottom: 24 }}>
              Nhấn "+ Thêm" để nhập giao dịch đầu tiên
            </p>
            <button
              onClick={() => setFormOpen(true)}
              className="btn-primary"
              style={{ margin: "0 auto" }}
            >
              + Thêm giao dịch
            </button>
          </div>
        ) : (
          dates.map((d) => (
            <div key={d}>
              {/* Date header */}
              <div style={{
                padding: "10px 20px 6px",
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                marginTop: 4,
              }}>
                <span style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--ink)",
                  letterSpacing: -0.224,
                }}>
                  {formatDateHeader(d)}
                </span>
                <span style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 12,
                  color: "var(--ink-muted-48)",
                }}>
                  {fmt(groups[d].reduce((s, t) => s + (t.type === "expense" ? -t.amount : t.amount), 0))}₫
                </span>
              </div>

              <div style={{ background: "var(--canvas)" }}>
                {groups[d].map((txn, i) => (
                  <div key={txn.id} style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "13px 20px",
                    borderTop: i > 0 ? "1px solid var(--hairline)" : "none",
                  }}>
                    <div style={{
                      width: 38,
                      height: 38,
                      borderRadius: "50%",
                      background: txn.type === "expense" ? "rgba(255,69,58,0.1)" : "rgba(48,209,88,0.1)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 12,
                      flexShrink: 0,
                      color: txn.type === "expense" ? "#ff453a" : "#30d158",
                      fontSize: 16,
                      fontWeight: 600,
                    }}>
                      {txn.type === "expense" ? "↓" : "↑"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontFamily: "var(--font-body)",
                        fontSize: 15,
                        color: "var(--ink)",
                        letterSpacing: -0.374,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}>
                        {txn.category.name}
                      </p>
                      {txn.note && (
                        <p style={{
                          fontFamily: "var(--font-body)",
                          fontSize: 12,
                          color: "var(--ink-muted-48)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          marginTop: 1,
                        }}>
                          {txn.note}
                        </p>
                      )}
                    </div>
                    <p style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 15,
                      fontWeight: 600,
                      color: txn.type === "expense" ? "#ff453a" : "#30d158",
                      letterSpacing: -0.2,
                      marginLeft: 12,
                      flexShrink: 0,
                    }}>
                      {txn.type === "expense" ? "−" : "+"}{fmt(txn.amount)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <TransactionForm open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} />
    </div>
  );
}
