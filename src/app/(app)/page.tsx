"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { DashboardTemplate } from "@/components/templates/DashboardTemplate";
import type { DashboardData, Transaction } from "@/components/templates/DashboardTemplate";
import type { OrganizePreview, OrganizeSelection } from "@/components/organisms/OrganizeReviewSheet";
import { currentBudgetMonth } from "@/lib/validators";

export default function DashboardPage() {
  const initialMonth = currentBudgetMonth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [currentMonth, setCurrentMonth] = useState(initialMonth);
  const [formOpen, setFormOpen] = useState(false);
  const [editTxn, setEditTxn] = useState<Transaction | undefined>(undefined);
  const [actionTxn, setActionTxn] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [organizeState, setOrganizeState] = useState<"idle" | "loading" | "review" | "applying">("idle");
  const [organizePreview, setOrganizePreview] = useState<OrganizePreview | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [ledgerError, setLedgerError] = useState<string | null>(null);
  const { replace } = useRouter();
  const abortRef = useRef<AbortController | null>(null);

  // silent=true: reload in background without showing spinner (visibilitychange / post-mutation)
  const load = useCallback(async (month?: string, silent = false) => {
    // Abort any in-flight request before starting a new one (dedup + abort)
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const { signal } = ctrl;

    setSummaryError(null);
    setLedgerError(null);
    if (!silent) {
      setLoading(true);
      setData(null);
      setTxns([]);
    }

    const q = month ? `?month=${month}` : "";

    async function fetchWithRetry(url: string) {
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) await new Promise<void>((resolve) => setTimeout(resolve, attempt * 500));
        if (signal.aborted) throw new DOMException("Aborted", "AbortError");
        try {
          const response = await fetch(url, { signal });
          if (response.ok || response.status === 401 || attempt === 2) return response;
        } catch (requestError) {
          if ((requestError as DOMException)?.name === "AbortError" || attempt === 2) throw requestError;
        }
      }
      throw new Error(`Không thể tải ${url}`);
    }

    const [dashboardResult, transactionResult] = await Promise.allSettled([
      fetchWithRetry(`/api/dashboard${q}`),
      fetchWithRetry(`/api/transactions${q}`),
    ]);

    if (signal.aborted) return;
    const unauthorized = [dashboardResult, transactionResult].some(
      (result) => result.status === "fulfilled" && result.value.status === 401,
    );
    if (unauthorized) {
      replace("/sign-in");
      return;
    }

    if (dashboardResult.status === "fulfilled" && dashboardResult.value.ok) {
      try {
        const dashboard = await dashboardResult.value.json() as DashboardData;
        if (!signal.aborted) {
          setData(dashboard);
          if (!month) setCurrentMonth(dashboard.month);
          setSelectedMonth(dashboard.month);
        }
      } catch {
        setSummaryError("Không tải được tổng quan kỳ này.");
      }
    } else {
      setSummaryError("Không tải được tổng quan kỳ này.");
    }

    if (transactionResult.status === "fulfilled" && transactionResult.value.ok) {
      try {
        const result = await transactionResult.value.json() as { transactions: Transaction[] };
        if (!signal.aborted) setTxns(result.transactions ?? []);
      } catch {
        setLedgerError("Không tải được sổ giao dịch.");
      }
    } else {
      setLedgerError("Không tải được sổ giao dịch.");
    }

    if (!signal.aborted) setLoading(false);
  }, [replace]);

  // Abort on unmount to avoid state updates on unmounted component
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  useEffect(() => {
    const pendingLoad = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(pendingLoad);
  }, [load]);

  // Reload when the PWA/tab is brought back to the foreground after being suspended.
  // HTTP cache (stale-while-revalidate) serves instantly on resume; pass silent=true
  // so existing data stays visible while revalidation happens in the background.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return;
      const latestMonth = currentBudgetMonth();
      if (selectedMonth === currentMonth && latestMonth !== currentMonth) {
        setCurrentMonth(latestMonth);
        setSelectedMonth(latestMonth);
        load(latestMonth, true);
      } else {
        load(selectedMonth, true);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [currentMonth, load, selectedMonth]);

  async function handleDelete(txn: Transaction) {
    setDeleting(true);
    setDeleteError(null);
    try {
      const response = await fetch(`/api/transactions/${txn.id}`, { method: "DELETE" });
      if (!response.ok) {
        setDeleteError("Không thể xoá giao dịch. Vui lòng thử lại.");
        return;
      }
      setActionTxn(null);
      load(selectedMonth, true);
    } catch {
      setDeleteError("Không thể xoá giao dịch. Kiểm tra kết nối và thử lại.");
    } finally {
      setDeleting(false);
    }
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

  return (
    <DashboardTemplate
      data={data}
      transactions={txns}
      loading={loading}
      selectedMonth={selectedMonth}
      currentMonth={currentMonth}
      deleting={deleting}
      actionTxn={actionTxn}
      formOpen={formOpen}
      editTxn={editTxn}
      onSelectMonth={navigate}
      onSetActionTxn={(txn) => { setDeleteError(null); setActionTxn(txn); }}
      onOpenForm={(txn) => { setEditTxn(txn); setFormOpen(true); }}
      onCloseForm={() => { setFormOpen(false); setEditTxn(undefined); }}
      onSaved={() => load(selectedMonth, true)}
      onDelete={handleDelete}
      organizeState={organizeState}
      organizePreview={organizePreview}
      onOrganize={handleOrganize}
      onOrganizeApply={handleOrganizeApply}
      onOrganizeClose={handleOrganizeClose}
      summaryError={summaryError}
      ledgerError={ledgerError}
      deleteError={deleteError}
      onRetrySummary={() => load(selectedMonth || undefined)}
      onRetryLedger={() => load(selectedMonth || undefined)}
    />
  );
}
