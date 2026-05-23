"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DebtOverviewTemplate } from "@/components/templates/DebtOverviewTemplate";
import type { DebtWithRepayments } from "@/lib/debt";

type DebtsResponse = {
  lending: DebtWithRepayments[];
  borrowing: DebtWithRepayments[];
  settled: DebtWithRepayments[];
};

export default function DebtsPage() {
  const [data, setData] = useState<DebtsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const { replace } = useRouter();

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/debts");
      if (res.status === 401) { replace("/sign-in"); return; }
      if (!res.ok) return;
      setData(await res.json() as DebtsResponse);
    } finally {
      setLoading(false);
    }
  }, [replace]);

  useEffect(() => { load(); }, [load]);

  async function handleAddDebt(body: { type: "lend" | "borrow"; party: string; amount: number; note: string; date: string }) {
    const res = await fetch("/api/debts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("Failed to create debt");
    await load(true);
  }

  async function handleAddRepayment(debtId: string, body: { amount: number; note: string; date: string }) {
    const res = await fetch(`/api/debts/${debtId}/repayments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("Failed to add repayment");
    await load(true);
  }

  if (loading || !data) {
    return (
      <div style={{ minHeight: "100dvh", background: "var(--canvas-parchment)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--ink-muted-48)" }}>Đang tải...</div>
      </div>
    );
  }

  return (
    <DebtOverviewTemplate
      lending={data.lending}
      borrowing={data.borrowing}
      settled={data.settled}
      onAddDebt={handleAddDebt}
      onAddRepayment={handleAddRepayment}
    />
  );
}
