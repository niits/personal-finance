"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { getDB } from "@/lib/firebase-client";
import {
  customBudgetsCol,
  monthlyBudgetsCol,
  adjustmentsCol,
} from "@/lib/firestore-refs";
import { useCollection } from "@/lib/hooks/useFirestore";
import { query, where, limit, orderBy } from "firebase/firestore";
import { currentBudgetMonth, getBudgetPeriodInclusive } from "@/lib/validators";
import {
  createMonthlyBudget,
  adjustMonthlyBudget,
  BudgetError,
} from "@/lib/data/monthly-budgets";
import {
  createCustomBudget,
  deleteCustomBudget,
  updateCustomBudget,
  CustomBudgetError,
  listCustomBudgets,
  type CustomBudgetWithSpent,
} from "@/lib/data/custom-budgets";
import { useEffect } from "react";

function fmt(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n);
}
function parseVND(s: string): number | null {
  const n = parseInt(s.replace(/[^\d]/g, ""), 10);
  return isNaN(n) || n <= 0 ? null : n;
}
function fmtPeriodDate(s: string) {
  const [, m, d] = s.split("-");
  return `${parseInt(d)}/${parseInt(m)}`;
}

export default function BudgetPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const uid = session?.user.id;
  const db = getDB();

  const [month] = useState(() => currentBudgetMonth());
  const monthLabel = useMemo(() => {
    const [y, m] = month.split("-");
    return `Tháng ${parseInt(m)}/${y}`;
  }, [month]);
  const period = useMemo(() => getBudgetPeriodInclusive(month), [month]);

  const budgetQuery = useMemo(
    () =>
      uid
        ? query(monthlyBudgetsCol(db, uid), where("month", "==", month), limit(1))
        : null,
    [db, uid, month],
  );
  const budgetState = useCollection(budgetQuery, [uid, month]);
  const budget = budgetState.data?.[0] ?? null;

  const budgetId = budget?.id;
  const adjQuery = useMemo(
    () =>
      uid && budgetId ? query(adjustmentsCol(db, uid, budgetId), orderBy("createdAt", "asc")) : null,
    [db, uid, budgetId],
  );
  const adjustmentsState = useCollection(adjQuery, [uid, budget?.id]);
  const adjustments = adjustmentsState.data ?? [];

  // Custom budgets need spent computation; useCollection returns raw budgets.
  // Spent is recomputed when transactions change, so subscribe to transactions
  // via listCustomBudgets-style logic. For simplicity, use a local effect.
  const cbQuery = useMemo(() => (uid ? customBudgetsCol(db, uid) : null), [db, uid]);
  const cbState = useCollection(cbQuery, [uid]);
  const [withSpent, setWithSpent] = useState<CustomBudgetWithSpent[]>([]);
  useEffect(() => {
    let alive = true;
    if (!uid) return;
    listCustomBudgets(db, uid).then((rows) => {
      if (alive) setWithSpent(rows);
    });
    return () => {
      alive = false;
    };
    // Recompute when raw budgets change (id list / amounts change).
  }, [db, uid, cbState.data]);
  const customBudgets = withSpent;

  if (!isPending && !session) router.replace("/");

  const [createStr, setCreateStr] = useState("");
  const [createErr, setCreateErr] = useState("");
  const [createSaving, setCreateSaving] = useState(false);

  const [adjOpen, setAdjOpen] = useState(false);
  const [adjDeltaStr, setAdjDeltaStr] = useState("");
  const [adjSign, setAdjSign] = useState<1 | -1>(1);
  const [adjNote, setAdjNote] = useState("");
  const [adjErr, setAdjErr] = useState("");
  const [adjSaving, setAdjSaving] = useState(false);

  const [cbOpen, setCbOpen] = useState(false);
  const [cbName, setCbName] = useState("");
  const [cbAmountStr, setCbAmountStr] = useState("");
  const [cbErr, setCbErr] = useState("");
  const [cbSaving, setCbSaving] = useState(false);

  async function createBudget() {
    if (!uid) return;
    const amount = parseVND(createStr);
    if (!amount) { setCreateErr("Số tiền không hợp lệ"); return; }
    setCreateSaving(true); setCreateErr("");
    try {
      await createMonthlyBudget(db, uid, { month, amount });
      setCreateStr("");
    } catch (e) {
      setCreateErr(e instanceof BudgetError ? e.message : "Lỗi");
    } finally {
      setCreateSaving(false);
    }
  }

  async function adjust() {
    if (!uid || !budget) return;
    const abs = parseInt(adjDeltaStr.replace(/[^\d]/g, ""), 10);
    if (!abs || abs <= 0) { setAdjErr("Nhập số tiền hợp lệ"); return; }
    const delta = abs * adjSign;
    if (budget.amount + delta <= 0) { setAdjErr("Ngân sách sau điều chỉnh phải lớn hơn 0"); return; }
    setAdjSaving(true); setAdjErr("");
    try {
      await adjustMonthlyBudget(db, uid, budget.id, { delta, note: adjNote || null });
      setAdjOpen(false); setAdjDeltaStr(""); setAdjNote("");
    } catch (e) {
      setAdjErr(e instanceof BudgetError ? e.message : "Lỗi");
    } finally {
      setAdjSaving(false);
    }
  }

  async function createCustom() {
    if (!uid) return;
    if (!cbName.trim()) { setCbErr("Nhập tên"); return; }
    const amount = parseVND(cbAmountStr);
    if (!amount) { setCbErr("Số tiền không hợp lệ"); return; }
    setCbSaving(true); setCbErr("");
    try {
      await createCustomBudget(db, uid, { name: cbName.trim(), amount });
      setCbOpen(false); setCbName(""); setCbAmountStr("");
    } catch (e) {
      setCbErr(e instanceof CustomBudgetError ? e.message : "Lỗi");
    } finally {
      setCbSaving(false);
    }
  }

  async function toggleActive(cb: CustomBudgetWithSpent) {
    if (!uid) return;
    await updateCustomBudget(db, uid, cb.id, { isActive: !cb.isActive });
  }

  async function deleteCustom(id: string) {
    if (!uid) return;
    await deleteCustomBudget(db, uid, id);
  }

  if (isPending || budgetState.loading) {
    return (
      <div style={{ padding: "48px", textAlign: "center", color: "var(--ink-muted-48)", fontFamily: "var(--font-body)", fontSize: 14 }}>
        Đang tải…
      </div>
    );
  }

  return (
    <div>
      <div style={{ background: "var(--surface-black)", padding: "28px 22px 24px" }}>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-body)", marginBottom: 2 }}>
          {monthLabel}
        </p>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-body)", marginBottom: 6 }}>
          {fmtPeriodDate(period.start_date)} – {fmtPeriodDate(period.end_date)}
        </p>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 600, color: "var(--on-dark)", letterSpacing: -0.28 }}>
          Ngân sách
        </h1>
      </div>

      <div style={{ padding: "16px 16px 32px", display: "flex", flexDirection: "column", gap: 16 }}>

        <div style={{ background: "var(--canvas)", borderRadius: "var(--radius-lg)", border: "1px solid var(--hairline)", overflow: "hidden" }}>
          <div style={{ padding: "20px", borderBottom: "1px solid var(--hairline)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
              <p style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--ink-muted-48)" }}>
                Ngân sách tháng
              </p>
              <p style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "var(--ink-muted-48)" }}>
                {fmtPeriodDate(period.start_date)} – {fmtPeriodDate(period.end_date)}
              </p>
            </div>

            {budget ? (
              <>
                <p style={{ fontFamily: "var(--font-display)", fontSize: 34, fontWeight: 600, color: "var(--ink)", letterSpacing: -0.374 }}>
                  {fmt(budget.amount)}₫
                </p>
                {adjustments.length > 0 && (
                  <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                    {adjustments.map((a) => (
                      <p key={a.id} style={{ fontSize: 12, color: a.delta > 0 ? "#30d158" : "#ff453a", fontFamily: "var(--font-body)" }}>
                        {a.delta > 0 ? "+" : ""}{fmt(a.delta)}₫{a.note ? ` — ${a.note}` : ""}
                      </p>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--ink-muted-48)" }}>
                Chưa đặt ngân sách {monthLabel}
              </p>
            )}
          </div>

          {!budget && (
            <div style={{ padding: "16px 20px" }}>
              <div style={{ position: "relative", marginBottom: 10 }}>
                <input type="text" inputMode="numeric" placeholder="5,000,000" value={createStr}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^\d]/g, "");
                    setCreateStr(raw ? fmt(parseInt(raw, 10)) : "");
                    setCreateErr("");
                  }}
                  style={{ width: "100%", padding: "12px 44px 12px 16px", borderRadius: 11,
                    border: createErr ? "1px solid #ff453a" : "1px solid var(--hairline)",
                    fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600,
                    color: "var(--ink)", background: "var(--canvas-parchment)", outline: "none" }} />
                <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", fontSize: 18, color: "var(--ink-muted-48)", fontFamily: "var(--font-display)", fontWeight: 600 }}>₫</span>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                {[3000000, 5000000, 7000000, 10000000].map((n) => (
                  <button key={n} onClick={() => { setCreateStr(fmt(n)); setCreateErr(""); }}
                    style={{ padding: "5px 12px", borderRadius: 999,
                      border: "1px solid var(--hairline)",
                      background: createStr === fmt(n) ? "var(--primary)" : "var(--canvas-parchment)",
                      color: createStr === fmt(n) ? "#fff" : "var(--ink-muted-80)",
                      fontFamily: "var(--font-body)", fontSize: 13, cursor: "pointer", transition: "all 0.12s" }}>
                    {n / 1000000}tr
                  </button>
                ))}
              </div>
              {createErr && <p style={{ color: "#ff453a", fontSize: 13, fontFamily: "var(--font-body)", marginBottom: 10 }}>{createErr}</p>}
              <button onClick={createBudget} disabled={createSaving || !createStr}
                style={{ width: "100%", padding: "12px", borderRadius: 999, border: "none",
                  background: createStr ? "var(--primary)" : "var(--hairline)",
                  color: createStr ? "#fff" : "var(--ink-muted-48)",
                  fontFamily: "var(--font-body)", fontSize: 15,
                  cursor: createStr ? "pointer" : "default", transition: "all 0.15s" }}>
                {createSaving ? "Đang lưu…" : "Xác nhận ngân sách"}
              </button>
            </div>
          )}

          {budget && !adjOpen && (
            <button onClick={() => setAdjOpen(true)}
              style={{ width: "100%", padding: "14px 20px", background: "transparent", border: "none",
                color: "var(--primary)", fontFamily: "var(--font-body)", fontSize: 14,
                cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 18 }}>±</span> Điều chỉnh ngân sách
            </button>
          )}

          {budget && adjOpen && (
            <div style={{ padding: "16px 20px", borderTop: "1px solid var(--hairline)" }}>
              <p style={{ fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>
                Điều chỉnh ngân sách
              </p>
              <div style={{ display: "flex", background: "var(--canvas-parchment)", borderRadius: 10, padding: 3, marginBottom: 12 }}>
                {([1, -1] as const).map((s) => (
                  <button key={s} onClick={() => setAdjSign(s)}
                    style={{ flex: 1, padding: "8px", borderRadius: 8, border: "none",
                      background: adjSign === s ? (s === 1 ? "#30d158" : "#ff453a") : "transparent",
                      color: adjSign === s ? "#fff" : "var(--ink-muted-48)",
                      fontFamily: "var(--font-body)", fontSize: 15,
                      fontWeight: adjSign === s ? 600 : 400, cursor: "pointer", transition: "all 0.15s" }}>
                    {s === 1 ? "+ Tăng" : "− Giảm"}
                  </button>
                ))}
              </div>

              <div style={{ position: "relative", marginBottom: 10 }}>
                <input type="text" inputMode="numeric" placeholder="500,000" value={adjDeltaStr}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^\d]/g, "");
                    setAdjDeltaStr(raw ? fmt(parseInt(raw, 10)) : "");
                    setAdjErr("");
                  }}
                  autoFocus
                  style={{ width: "100%", padding: "11px 44px 11px 16px", borderRadius: 11,
                    border: adjErr ? "1px solid #ff453a" : "1px solid var(--hairline)",
                    fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600,
                    color: "var(--ink)", background: "var(--canvas-parchment)", outline: "none" }} />
                <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, color: "var(--ink-muted-48)", fontFamily: "var(--font-display)", fontWeight: 600 }}>₫</span>
              </div>

              <input type="text" placeholder="Lý do (tuỳ chọn)" value={adjNote}
                onChange={(e) => setAdjNote(e.target.value)}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 11,
                  border: "1px solid var(--hairline)", fontFamily: "var(--font-body)",
                  fontSize: 14, color: "var(--ink)", background: "var(--canvas-parchment)",
                  outline: "none", marginBottom: 10 }} />

              {adjErr && <p style={{ color: "#ff453a", fontSize: 13, fontFamily: "var(--font-body)", marginBottom: 10 }}>{adjErr}</p>}

              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { setAdjOpen(false); setAdjDeltaStr(""); setAdjNote(""); setAdjErr(""); }}
                  style={{ flex: 1, padding: "11px", borderRadius: 999,
                    border: "1px solid var(--hairline)", background: "transparent",
                    color: "var(--ink-muted-48)", fontFamily: "var(--font-body)", fontSize: 14, cursor: "pointer" }}>
                  Huỷ
                </button>
                <button onClick={adjust} disabled={adjSaving || !adjDeltaStr}
                  style={{ flex: 2, padding: "11px", borderRadius: 999, border: "none",
                    background: adjDeltaStr ? (adjSign === 1 ? "#30d158" : "#ff453a") : "var(--hairline)",
                    color: adjDeltaStr ? "#fff" : "var(--ink-muted-48)",
                    fontFamily: "var(--font-body)", fontSize: 14,
                    cursor: adjDeltaStr ? "pointer" : "default", transition: "all 0.15s" }}>
                  {adjSaving ? "Đang lưu…" : `${adjSign === 1 ? "Tăng" : "Giảm"} ${adjDeltaStr || "0"}₫`}
                </button>
              </div>
            </div>
          )}
        </div>

        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <p style={{ fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 600, color: "var(--ink-muted-48)", letterSpacing: 0.5, textTransform: "uppercase" }}>
              Ngân sách riêng
            </p>
            <button onClick={() => setCbOpen(!cbOpen)}
              style={{ background: "var(--primary)", color: "#fff", border: "none",
                borderRadius: 999, padding: "5px 14px",
                fontFamily: "var(--font-body)", fontSize: 13, cursor: "pointer" }}>
              + Thêm
            </button>
          </div>

          {cbOpen && (
            <div style={{ background: "var(--canvas)", borderRadius: "var(--radius-lg)",
              border: "1px solid var(--hairline)", padding: "16px 16px 12px", marginBottom: 10 }}>
              <p style={{ fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>
                Ngân sách riêng mới
              </p>
              <input type="text" placeholder="Tên (vd: Du lịch, Mua laptop…)" value={cbName}
                onChange={(e) => { setCbName(e.target.value); setCbErr(""); }} autoFocus
                style={{ width: "100%", padding: "11px 14px", borderRadius: 11,
                  border: "1px solid var(--hairline)", fontFamily: "var(--font-body)",
                  fontSize: 15, color: "var(--ink)", background: "var(--canvas-parchment)",
                  outline: "none", marginBottom: 8 }} />
              <div style={{ position: "relative", marginBottom: 8 }}>
                <input type="text" inputMode="numeric" placeholder="Mục tiêu" value={cbAmountStr}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^\d]/g, "");
                    setCbAmountStr(raw ? fmt(parseInt(raw, 10)) : "");
                    setCbErr("");
                  }}
                  style={{ width: "100%", padding: "11px 44px 11px 16px", borderRadius: 11,
                    border: "1px solid var(--hairline)", fontFamily: "var(--font-display)",
                    fontSize: 20, fontWeight: 600, color: "var(--ink)",
                    background: "var(--canvas-parchment)", outline: "none" }} />
                <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, color: "var(--ink-muted-48)", fontFamily: "var(--font-display)", fontWeight: 600 }}>₫</span>
              </div>
              {cbErr && <p style={{ color: "#ff453a", fontSize: 13, fontFamily: "var(--font-body)", marginBottom: 8 }}>{cbErr}</p>}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { setCbOpen(false); setCbName(""); setCbAmountStr(""); setCbErr(""); }}
                  style={{ flex: 1, padding: "10px", borderRadius: 999,
                    border: "1px solid var(--hairline)", background: "transparent",
                    color: "var(--ink-muted-48)", fontFamily: "var(--font-body)", fontSize: 14, cursor: "pointer" }}>
                  Huỷ
                </button>
                <button onClick={createCustom} disabled={cbSaving}
                  style={{ flex: 2, padding: "10px", borderRadius: 999, border: "none",
                    background: "var(--primary)", color: "#fff",
                    fontFamily: "var(--font-body)", fontSize: 14, cursor: "pointer" }}>
                  {cbSaving ? "Đang lưu…" : "Tạo"}
                </button>
              </div>
            </div>
          )}

          {customBudgets.length === 0 && !cbOpen ? (
            <div style={{ background: "var(--canvas)", borderRadius: "var(--radius-lg)",
              border: "1px solid var(--hairline)", padding: "24px 20px", textAlign: "center" }}>
              <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--ink-muted-48)" }}>
                Chưa có ngân sách riêng
              </p>
              <p style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--ink-muted-48)", marginTop: 4, lineHeight: 1.5 }}>
                Tạo quỹ riêng cho từng mục tiêu — du lịch, mua sắm, khẩn cấp…
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {customBudgets.map((cb) => {
                const pct = Math.min((cb.spent / cb.amount) * 100, 100);
                const over = cb.spent > cb.amount;
                return (
                  <div key={cb.id} style={{ background: "var(--canvas)", borderRadius: "var(--radius-lg)",
                    border: "1px solid var(--hairline)", padding: "16px",
                    opacity: cb.isActive ? 1 : 0.6 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                      <div>
                        <p style={{ fontFamily: "var(--font-body)", fontSize: 15, fontWeight: 600, color: "var(--ink)", marginBottom: 2 }}>
                          {cb.name}
                        </p>
                        <p style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--ink-muted-48)" }}>
                          {fmt(cb.spent)}₫ / {fmt(cb.amount)}₫
                        </p>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => toggleActive(cb)}
                          style={{ padding: "4px 10px", borderRadius: 999,
                            border: "1px solid var(--hairline)",
                            background: cb.isActive ? "var(--canvas-parchment)" : "var(--ink)",
                            color: cb.isActive ? "var(--ink-muted-48)" : "#fff",
                            fontFamily: "var(--font-body)", fontSize: 12, cursor: "pointer" }}>
                          {cb.isActive ? "Tắt" : "Bật"}
                        </button>
                        <button onClick={() => deleteCustom(cb.id)}
                          style={{ padding: "4px 8px", borderRadius: 999,
                            border: "1px solid #ff453a", background: "transparent",
                            color: "#ff453a", fontFamily: "var(--font-body)", fontSize: 12, cursor: "pointer" }}>
                          ✕
                        </button>
                      </div>
                    </div>
                    <div style={{ height: 4, background: "var(--hairline)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`,
                        background: over ? "#ff453a" : "var(--primary)",
                        borderRadius: 2, transition: "width 0.4s ease" }} />
                    </div>
                    {over && (
                      <p style={{ fontSize: 11, color: "#ff453a", fontFamily: "var(--font-body)", marginTop: 4 }}>
                        Vượt {fmt(cb.spent - cb.amount)}₫
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
