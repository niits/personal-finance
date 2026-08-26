"use client";

import useSWR from "swr";
import { DebtOverviewTemplate } from "@/components/templates/DebtOverviewTemplate";
import type { FinanceAccountOverview } from "@/components/templates/DebtOverviewTemplate";
import { fetcher } from "@/lib/fetcher";

export default function DebtsPage() {
  const { data } = useSWR<{ accounts: FinanceAccountOverview[] }>("/api/finance-accounts", fetcher);

  if (!data) {
    return (
      <div style={{ minHeight: "100dvh", background: "var(--canvas-parchment)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--ink-muted-48)" }}>Đang tải…</div>
      </div>
    );
  }

  return (
    <>
      <DebtOverviewTemplate
        accounts={data.accounts}
      />
    </>
  );
}
