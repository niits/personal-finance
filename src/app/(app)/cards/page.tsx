"use client";

import { useState } from "react";
import useSWR from "swr";
import { CreditCardsTemplate } from "@/components/templates/CreditCardsTemplate";
import type { CardGroup, FinanceAccount } from "@/components/templates/CreditCardsTemplate";
import { fetcher } from "@/lib/fetcher";

export default function CardsPage() {
  const [payingStatementId, setPayingStatementId] = useState<string | null>(null);
  const { data, mutate } = useSWR<{ groups: CardGroup[] }>("/api/credit-card-groups", fetcher);
  const { data: financeAccountData, mutate: mutateFinanceAccounts } = useSWR<{ accounts: FinanceAccount[] }>("/api/finance-accounts", fetcher);
  const groups = data?.groups ?? [];
  const accounts = financeAccountData?.accounts ?? [];
  async function pay(statementId: string, paidAt: string) {
    setPayingStatementId(statementId);
    const response = await fetch(`/api/credit-card-statements/${statementId}/pay`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paid_at: paidAt }) });
    setPayingStatementId(null);
    if (response.ok) mutate();
  }
  async function createGroup(input: { name: string; statement_close_day: number }) {
    const response = await fetch("/api/credit-card-groups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
    if (response.ok) mutate();
  }
  async function updateGroup(id: string, input: { name: string; statement_close_day: number }) {
    const response = await fetch(`/api/credit-card-groups/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
    if (response.ok) mutate();
  }
  async function deleteGroup(id: string) {
    const response = await fetch(`/api/credit-card-groups/${id}`, { method: "DELETE" });
    if (response.ok) mutate();
  }
  async function accountMutation(url: string, options: RequestInit) {
    const response = await fetch(url, options);
    if (response.ok) {
      await mutateFinanceAccounts();
      return null;
    }
    return (await response.json().catch(() => ({})) as { error?: string }).error ?? "Không thể lưu tài khoản";
  }
  return <CreditCardsTemplate groups={groups} accounts={accounts} payingStatementId={payingStatementId} onPay={pay} onCreateGroup={createGroup} onUpdateGroup={updateGroup} onDeleteGroup={deleteGroup} onCreateFinanceAccount={(input) => accountMutation("/api/finance-accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) })} onUpdateFinanceAccount={(id, input) => accountMutation(`/api/finance-accounts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) })} onDeleteFinanceAccount={(id) => accountMutation(`/api/finance-accounts/${id}`, { method: "DELETE" })} />;
}
