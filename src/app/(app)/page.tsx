"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { mutate } from "swr";
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
  const [organizeNotice, setOrganizeNotice] = useState<{ message: string; error: boolean } | null>(null);
  const [organizePreview, setOrganizePreview] = useState<OrganizePreview | null>(null);
  const [organizeApplyError, setOrganizeApplyError] = useState<string | null>(null);
  const [organizeApplyBlocked, setOrganizeApplyBlocked] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [ledgerError, setLedgerError] = useState<string | null>(null);
  const { replace } = useRouter();
  const abortRef = useRef<AbortController | null>(null);
  const organizeApplyingRef = useRef(false);

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
          const response = await fetch(url, { signal, cache: "no-cache" });
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

  // Revalidate when the PWA or tab returns to the foreground. Keep the existing
  // data visible while the latest response is requested.
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
        setDeleteError("Không thể xóa giao dịch. Vui lòng thử lại.");
        return;
      }
      setActionTxn(null);
      load(selectedMonth, true);
    } catch {
      setDeleteError("Không thể xóa giao dịch. Kiểm tra kết nối và thử lại.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleOrganize() {
    setOrganizeNotice(null);
    setOrganizeApplyError(null);
    setOrganizeApplyBlocked(false);
    setOrganizeState("loading");
    try {
      const r = await fetch("/api/ai/organize", { method: "POST" });
      if (!r.ok) {
        if (r.status === 401) { replace("/sign-in"); return; }
        const failure = await r.json().catch(() => null) as { error?: string } | null;
        setOrganizeNotice({ message: failure?.error ?? "Không thể tạo đề xuất. Vui lòng thử lại.", error: true });
        setOrganizeState("idle");
        return;
      }
      const preview = await r.json() as OrganizePreview;
      setOrganizePreview(preview);
      setOrganizeState("review");
    } catch {
      setOrganizeNotice({ message: "Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.", error: true });
      setOrganizeState("idle");
    }
  }

  async function handleOrganizeApply(selection: OrganizeSelection) {
    if (organizeApplyingRef.current || organizeApplyBlocked) return;
    organizeApplyingRef.current = true;
    setOrganizeApplyError(null);
    setOrganizeState("applying");
    try {
      const r = await fetch("/api/ai/organize/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selection),
      });
      if (r.ok) {
        const counts = await r.json() as { created_categories: number; emoji_updated: number; transactions_moved: number; merged_categories: number; reorganized_categories: number };
        setOrganizeNotice({ message: `Đã hợp nhất ${counts.merged_categories} danh mục, sắp xếp ${counts.reorganized_categories} danh mục, tạo ${counts.created_categories} danh mục, cập nhật ${counts.emoji_updated} emoji và chuyển ${counts.transactions_moved} giao dịch.`, error: false });
        void mutate((key) => typeof key === "string" && /^\/api\/(categories|transactions|dashboard|monthly-budgets|custom-budgets|pace-line|statistics)(?:[/?]|$)/.test(key));
        setOrganizeState("idle");
        setOrganizePreview(null);
        load(selectedMonth, true);
      } else {
        if (r.status === 401) { replace("/sign-in"); return; }
        const blocked = r.status === 409;
        setOrganizeApplyBlocked(blocked);
        setOrganizeApplyError(blocked
          ? "Dữ liệu đã thay đổi. Vui lòng đóng bảng này và tạo đề xuất mới."
          : "Không thể áp dụng đề xuất. Vui lòng thử lại.");
        setOrganizeState("review");
      }
    } catch {
      setOrganizeApplyError("Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.");
      setOrganizeState("review");
    } finally {
      organizeApplyingRef.current = false;
    }
  }

  function handleOrganizeClose() {
    setOrganizeApplyError(null);
    setOrganizeApplyBlocked(false);
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
      organizeNotice={organizeNotice}
      organizeState={organizeState}
      organizePreview={organizePreview}
      organizeApplyError={organizeApplyError}
      organizeApplyBlocked={organizeApplyBlocked}
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
