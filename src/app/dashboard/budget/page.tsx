"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { BudgetTemplate } from "@/components/templates/BudgetTemplate";
import type { MonthlyBudget, CustomBudget } from "@/components/templates/BudgetTemplate";

type BudgetPageData = {
  month: string;
  monthly_budget: MonthlyBudget | null;
  start: string;
  end: string;
};

export default function BudgetPage() {
  const [month, setMonth] = useState<string | null>(null);
  const [budget, setBudget] = useState<MonthlyBudget | null>(null);
  const [period, setPeriod] = useState<{ start: string; end: string } | null>(null);
  const [customBudgets, setCustomBudgets] = useState<CustomBudget[]>([]);
  const [loading, setLoading] = useState(true);
  const { replace } = useRouter();

  const load = useCallback(async () => {
    const [mRes, cRes] = await Promise.all([
      fetch("/api/monthly-budgets"),
      fetch("/api/custom-budgets"),
    ]);
    if (mRes.status === 401 || cRes.status === 401) {
      replace("/");
      return;
    }
    const mData = await mRes.json() as BudgetPageData;
    const cData = await cRes.json() as { custom_budgets?: CustomBudget[] };
    setMonth(mData.month);
    setBudget(mData.monthly_budget ?? null);
    setPeriod(mData.start && mData.end ? { start: mData.start, end: mData.end } : null);
    setCustomBudgets(cData.custom_budgets ?? []);
    setLoading(false);
  }, [replace]);

  useEffect(() => { load(); }, [load]);

  const isCurrentMonth = true; // budget page always shows current month

  async function handleCreateMonthlyBudget(amount: number): Promise<{ error?: string }> {
    if (!month) return { error: "Không có tháng" };
    const r = await fetch("/api/monthly-budgets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, amount }),
    });
    const d = await r.json() as BudgetPageData & { error?: string };
    if (!r.ok) return { error: d.error ?? "Lỗi" };
    setBudget(d.monthly_budget ?? null);
    if (d.start && d.end) setPeriod({ start: d.start, end: d.end });
    return {};
  }

  async function handleCreateAdjustment(delta: number, note: string | null): Promise<{ error?: string }> {
    if (!budget) return { error: "Không có ngân sách" };
    const r = await fetch(`/api/monthly-budgets/${budget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delta, note }),
    });
    const d = await r.json() as { monthly_budget?: MonthlyBudget; error?: string };
    if (!r.ok) return { error: d.error ?? "Lỗi" };
    setBudget(d.monthly_budget ?? null);
    return {};
  }

  async function handleCreateCustomBudget(name: string, amount: number): Promise<{ error?: string }> {
    const r = await fetch("/api/custom-budgets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, amount }),
    });
    const d = await r.json() as { custom_budget?: CustomBudget; error?: string };
    if (!r.ok) return { error: d.error ?? "Lỗi" };
    if (d.custom_budget) setCustomBudgets((prev) => [d.custom_budget!, ...prev]);
    return {};
  }

  async function handleToggleCustomBudget(id: number, active: boolean): Promise<{ error?: string }> {
    const r = await fetch(`/api/custom-budgets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: active ? 1 : 0 }),
    });
    if (!r.ok) return { error: "Lỗi" };
    await load();
    return {};
  }

  async function handleDeleteCustomBudget(id: number): Promise<{ error?: string }> {
    await fetch(`/api/custom-budgets/${id}`, { method: "DELETE" });
    setCustomBudgets((prev) => prev.filter((c) => c.id !== id));
    return {};
  }

  return (
    <BudgetTemplate
      month={month}
      period={period}
      monthlyBudget={budget}
      customBudgets={customBudgets}
      loading={loading}
      isCurrentMonth={isCurrentMonth}
      onCreateMonthlyBudget={handleCreateMonthlyBudget}
      onCreateAdjustment={handleCreateAdjustment}
      onCreateCustomBudget={handleCreateCustomBudget}
      onToggleCustomBudget={handleToggleCustomBudget}
      onDeleteCustomBudget={handleDeleteCustomBudget}
    />
  );
}
