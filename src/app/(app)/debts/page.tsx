"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DebtOverviewTemplate } from "@/components/templates/DebtOverviewTemplate";
import { TransactionForm } from "@/components/organisms/TransactionForm";
import type { DebtWithRepayments } from "@/lib/debt";

type DebtsResponse = {
  lending: DebtWithRepayments[];
  borrowing: DebtWithRepayments[];
  settled: DebtWithRepayments[];
};

export default function DebtsPage() {
  const [data, setData] = useState<DebtsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
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

  if (loading || !data) {
    return (
      <div style={{ minHeight: "100dvh", background: "var(--canvas-parchment)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--ink-muted-48)" }}>Đang tải…</div>
      </div>
    );
  }

  return (
    <>
      <DebtOverviewTemplate
        lending={data.lending}
        borrowing={data.borrowing}
        settled={data.settled}
        onOpenTransactionForm={() => setFormOpen(true)}
      />
      <TransactionForm
        open={formOpen}
        mode={{ kind: "create-debt-open" }}
        onClose={() => setFormOpen(false)}
        onSaved={() => { setFormOpen(false); load(true); }}
      />
    </>
  );
}
