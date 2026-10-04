"use client";

import { useState } from "react";
import useSWR from "swr";
import { CreditCardsTemplate } from "@/components/templates/CreditCardsTemplate";
import type { CardGroup, FinanceAccount } from "@/components/templates/CreditCardsTemplate";
import { fetcher } from "@/lib/fetcher";

async function mutation(url: string, options: RequestInit): Promise<string | null> {
  try {
    const response = await fetch(url, options);
    if (response.ok) return null;
    const body = await response.json().catch(() => ({})) as { error?: string };
    return body.error ?? "Không thể hoàn tất thay đổi. Vui lòng thử lại.";
  } catch {
    return "Không thể kết nối. Kiểm tra mạng và thử lại.";
  }
}

export default function CardsPage() {
  const [payingStatementId, setPayingStatementId] = useState<string | null>(null);
  const groupsQuery = useSWR<{ groups: CardGroup[] }>("/api/credit-card-groups", fetcher);
  const accountsQuery = useSWR<{ accounts: FinanceAccount[] }>("/api/finance-accounts", fetcher);

  async function mutateAndRefresh(url: string, options: RequestInit, refresh: () => Promise<unknown>) {
    const error = await mutation(url, options);
    if (!error) await refresh();
    return error;
  }

  async function pay(statementId: string, paidAt: string) {
    setPayingStatementId(statementId);
    const error = await mutateAndRefresh(`/api/credit-card-statements/${statementId}/pay`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paid_at: paidAt }),
    }, groupsQuery.mutate);
    setPayingStatementId(null);
    return error;
  }

  return <CreditCardsTemplate
    groups={groupsQuery.data?.groups ?? []}
    accounts={accountsQuery.data?.accounts ?? []}
    groupsLoading={groupsQuery.isLoading}
    accountsLoading={accountsQuery.isLoading}
    groupsError={groupsQuery.error ? "Tạm thời chưa tải được nhóm thẻ." : null}
    accountsError={accountsQuery.error ? "Tạm thời chưa tải được tài khoản tài chính." : null}
    payingStatementId={payingStatementId}
    onRetryGroups={() => void groupsQuery.mutate()}
    onRetryAccounts={() => void accountsQuery.mutate()}
    onPay={pay}
    onCreateGroup={(input) => mutateAndRefresh("/api/credit-card-groups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }, groupsQuery.mutate)}
    onUpdateGroup={(id, input) => mutateAndRefresh(`/api/credit-card-groups/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }, groupsQuery.mutate)}
    onDeleteGroup={(id) => mutateAndRefresh(`/api/credit-card-groups/${id}`, { method: "DELETE" }, groupsQuery.mutate)}
    onUpdateFinanceAccount={(id, input) => mutateAndRefresh(`/api/finance-accounts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }, accountsQuery.mutate)}
    onDeleteFinanceAccount={(id) => mutateAndRefresh(`/api/finance-accounts/${id}`, { method: "DELETE" }, accountsQuery.mutate)}
  />;
}
