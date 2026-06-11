"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { DashboardTemplate } from "@/components/templates/DashboardTemplate";
import type { DashboardData, Transaction } from "@/components/templates/DashboardTemplate";
import type { OrganizePreview, OrganizeSelection } from "@/components/organisms/OrganizeReviewSheet";

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState("");
  const currentMonthRef = useRef("");
  const [formOpen, setFormOpen] = useState(false);
  const [editTxn, setEditTxn] = useState<Transaction | undefined>(undefined);
  const [actionTxn, setActionTxn] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [organizeState, setOrganizeState] = useState<"idle" | "loading" | "review" | "applying">("idle");
  const [organizePreview, setOrganizePreview] = useState<OrganizePreview | null>(null);
  const [error, setError] = useState(false);
  const { replace } = useRouter();
  const abortRef = useRef<AbortController | null>(null);

  // silent=true: reload in background without showing spinner (visibilitychange / post-mutation)
  const load = useCallback(async (month?: string, silent = false) => {
    // Abort any in-flight request before starting a new one (dedup + abort)
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const { signal } = ctrl;

    setError(false);
    if (!silent) setLoading(true);

    const q = month ? `?month=${month}` : "";

    // Retry up to 3 attempts with 500ms / 1000ms backoff
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await new Promise<void>((r) => setTimeout(r, attempt * 500));
      if (signal.aborted) return;

      try {
        const [dashRes, txnRes] = await Promise.all([
          fetch(`/api/dashboard${q}`, { signal }),
          fetch(`/api/transactions${q}`, { signal }),
        ]);

        if (signal.aborted) return;

        if (dashRes.status === 401 || txnRes.status === 401) {
          replace("/sign-in");
          return;
        }

        if (!dashRes.ok) throw new Error(`dashboard: ${dashRes.status}`);
        if (!txnRes.ok) throw new Error(`transactions: ${txnRes.status}`);

        const [dr, tr] = await Promise.all([
          dashRes.json() as Promise<DashboardData>,
          txnRes.json() as Promise<{ transactions: Transaction[] }>,
        ]);

        if (signal.aborted) return;

        setData(dr);
        setTxns(tr.transactions ?? []);
        if (!currentMonthRef.current) currentMonthRef.current = dr.month;
        setSelectedMonth(dr.month);
        setLoading(false);
        return; // success — stop retrying
      } catch (err) {
        if ((err as DOMException)?.name === "AbortError") return;
        if (attempt < 2) continue; // retry
        if (!signal.aborted) {
          setError(true);
          setLoading(false);
        }
      }
    }
  }, [replace]);

  // Abort on unmount to avoid state updates on unmounted component
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  useEffect(() => { load(); }, [load]);

  // Reload when the PWA/tab is brought back to the foreground after being suspended.
  // HTTP cache (stale-while-revalidate) serves instantly on resume; pass silent=true
  // so existing data stays visible while revalidation happens in the background.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") load(undefined, true);
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [load]);

  async function handleDelete(txn: Transaction) {
    setDeleting(true);
    const r = await fetch(`/api/transactions/${txn.id}`, { method: "DELETE" });
    setDeleting(false);
    if (r.ok) { setActionTxn(null); load(selectedMonth, true); }
  }

  function prevMonth(m: string) {
    const [y, mo] = m.split("-").map(Number);
    return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`;
  }

  function nextMonth(m: string) {
    const [y, mo] = m.split("-").map(Number);
    return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
  }

  async function handleOrganize() {
    setOrganizeState("loading");
    try {
      const r = await fetch("/api/ai/organize", { method: "POST" });
      if (!r.ok) { setOrganizeState("idle"); return; }
      const preview = await r.json() as OrganizePreview;
      setOrganizePreview(preview);
      setOrganizeState("review");
    } catch {
      setOrganizeState("idle");
    }
  }

  async function handleOrganizeApply(selection: OrganizeSelection) {
    setOrganizeState("applying");
    try {
      const r = await fetch("/api/ai/organize/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selection),
      });
      if (r.ok) {
        setOrganizeState("idle");
        setOrganizePreview(null);
        load(selectedMonth, true);
      } else {
        setOrganizeState("review");
      }
    } catch {
      setOrganizeState("review");
    }
  }

  function handleOrganizeClose() {
    setOrganizeState("idle");
    setOrganizePreview(null);
  }

  function navigate(m: string) {
    setSelectedMonth(m);
    load(m);
  }

  const isCurrentMonth = selectedMonth === currentMonthRef.current;

  if (error && !data) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60svh", gap: 16, padding: 24 }}>
        <p style={{ fontFamily: "var(--font-body)", fontSize: 15, color: "var(--ink-muted-48)", textAlign: "center" }}>
          Không tải được dữ liệu. Kiểm tra kết nối mạng và thử lại.
        </p>
        <button type="button"
          onClick={() => load()}
          className="font-body text-[15px] font-semibold text-primary bg-transparent border-none cursor-pointer px-4 py-2"
        >
          Thử lại
        </button>
      </div>
    );
  }

  return (
    <DashboardTemplate
      data={data}
      transactions={txns}
      loading={loading}
      selectedMonth={selectedMonth}
      isCurrentMonth={isCurrentMonth}
      deleting={deleting}
      actionTxn={actionTxn}
      formOpen={formOpen}
      editTxn={editTxn}
      onPrevMonth={() => navigate(prevMonth(selectedMonth))}
      onNextMonth={() => !isCurrentMonth && navigate(nextMonth(selectedMonth))}
      onSetActionTxn={setActionTxn}
      onOpenForm={(txn) => { setEditTxn(txn); setFormOpen(true); }}
      onCloseForm={() => { setFormOpen(false); setEditTxn(undefined); }}
      onSaved={() => load(selectedMonth, true)}
      onDelete={handleDelete}
      organizeState={organizeState}
      organizePreview={organizePreview}
      onOrganize={handleOrganize}
      onOrganizeApply={handleOrganizeApply}
      onOrganizeClose={handleOrganizeClose}
    />
  );
}
