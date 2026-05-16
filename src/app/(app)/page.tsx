"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { DashboardTemplate } from "@/components/templates/DashboardTemplate";
import type { DashboardData, Transaction } from "@/components/templates/DashboardTemplate";

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
  const [suggestingId, setSuggestingId] = useState<number | null>(null);
  const [suggestedIds, setSuggestedIds] = useState<Set<number>>(new Set());
  const { replace } = useRouter();

  const load = useCallback(async (month?: string) => {
    const q = month ? `?month=${month}` : "";
    const [dashRes, txnRes] = await Promise.all([
      fetch(`/api/dashboard${q}`),
      fetch(`/api/transactions${q}`),
    ]);
    if (dashRes.status === 401 || txnRes.status === 401) {
      replace("/sign-in");
      return;
    }
    const [dr, tr] = await Promise.all([
      dashRes.json() as Promise<DashboardData>,
      txnRes.json() as Promise<{ transactions: Transaction[] }>,
    ]);
    setData(dr);
    setTxns(tr.transactions ?? []);
    if (!currentMonthRef.current) currentMonthRef.current = dr.month;
    setSelectedMonth(dr.month);
    setLoading(false);
  }, [replace]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(txn: Transaction) {
    setDeleting(true);
    const r = await fetch(`/api/transactions/${txn.id}`, { method: "DELETE" });
    setDeleting(false);
    if (r.ok) { setActionTxn(null); load(selectedMonth); }
  }

  function prevMonth(m: string) {
    const [y, mo] = m.split("-").map(Number);
    return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`;
  }

  function nextMonth(m: string) {
    const [y, mo] = m.split("-").map(Number);
    return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
  }

  async function handleSuggest(id: number) {
    if (suggestingId !== null) return;
    setSuggestingId(id);
    try {
      const r = await fetch(`/api/transactions/${id}/suggest`, { method: "POST" });
      if (!r.ok) { setSuggestingId(null); return; }
      const d = await r.json() as {
        suggested_category_id: number | null;
        suggested_category_name: string | null;
        category_reason: string | null;
        emoji: string | null;
      };

      const patches: Record<string, unknown> = {};
      if (d.suggested_category_id) patches.category_id = d.suggested_category_id;
      if (d.emoji) patches.emoji = d.emoji;

      if (Object.keys(patches).length > 0) {
        await fetch(`/api/transactions/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patches),
        });
        load(selectedMonth);
      }

      setSuggestedIds((prev) => new Set([...prev, id]));
    } finally {
      setSuggestingId(null);
    }
  }

  function navigate(m: string) {
    setSelectedMonth(m);
    load(m);
  }

  const isCurrentMonth = selectedMonth === currentMonthRef.current;

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
      onSaved={() => load(selectedMonth)}
      onDelete={handleDelete}
      onSuggest={handleSuggest}
      suggestingId={suggestingId}
      suggestedIds={suggestedIds}
    />
  );
}
