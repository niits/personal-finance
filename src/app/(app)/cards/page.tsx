"use client";

import { useState } from "react";
import useSWR from "swr";
import { CreditCardsTemplate } from "@/components/templates/CreditCardsTemplate";
import type { CardGroup } from "@/components/templates/CreditCardsTemplate";
import { fetcher } from "@/lib/fetcher";

export default function CardsPage() {
  const [payingStatementId, setPayingStatementId] = useState<string | null>(null);
  const { data, mutate } = useSWR<{ groups: CardGroup[] }>("/api/credit-card-groups", fetcher);
  const groups = data?.groups ?? [];
  async function pay(statementId: string, paidAt: string) {
    setPayingStatementId(statementId);
    const response = await fetch(`/api/credit-card-statements/${statementId}/pay`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paid_at: paidAt }) });
    setPayingStatementId(null);
    if (response.ok) mutate();
  }
  async function createGroup(name: string, statementCloseDay: number) {
    const response = await fetch("/api/credit-card-groups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, statement_close_day: statementCloseDay }) });
    if (response.ok) mutate();
  }
  async function createCard(groupId: string, name: string) {
    const response = await fetch("/api/credit-cards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ group_id: groupId, name }) });
    if (response.ok) mutate();
  }
  return <CreditCardsTemplate groups={groups} payingStatementId={payingStatementId} onPay={pay} onCreateGroup={createGroup} onCreateCard={createCard} />;
}
