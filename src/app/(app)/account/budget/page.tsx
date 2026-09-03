"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { BudgetTemplate } from "@/components/templates/BudgetTemplate";
import type { BudgetDashboard, MonthlyBudget, CustomBudget } from "@/components/templates/BudgetTemplate";

type BudgetPageData = {
  month: string;
  monthly_budget: MonthlyBudget | null;
  start: string;
  end: string;
};

async function request(url: string, options?: RequestInit) {
  try {
    return await fetch(url, options);
  } catch {
    return null;
  }
}

export default function BudgetPage() {
  const [month, setMonth] = useState<string | null>(null);
  const [budget, setBudget] = useState<MonthlyBudget | null>(null);
  const [period, setPeriod] = useState<{ start: string; end: string } | null>(null);
  const [customBudgets, setCustomBudgets] = useState<CustomBudget[]>([]);
  const [dashboard, setDashboard] = useState<BudgetDashboard | null>(null);
  const [defaultMonthlyAmount, setDefaultMonthlyAmount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { replace } = useRouter();

  const load = useCallback(async () => {
    try {
      const [mRes, cRes, configRes, dashboardRes] = await Promise.all([
        fetch("/api/monthly-budgets"),
        fetch("/api/custom-budgets"),
        fetch("/api/budget-config"),
        fetch("/api/dashboard"),
      ]);
      if ([mRes, cRes, configRes, dashboardRes].some((response) => response.status === 401)) {
        replace("/sign-in");
        return;
      }
      if (!mRes.ok || !cRes.ok) throw new Error("Không thể tải dữ liệu ngân sách. Vui lòng thử lại.");

      const [mData, cData] = await Promise.all([
        mRes.json() as Promise<BudgetPageData>,
        cRes.json() as Promise<{ custom_budgets?: CustomBudget[] }>,
      ]);
      setMonth(mData.month);
      setBudget(mData.monthly_budget ?? null);
      setPeriod(mData.start && mData.end ? { start: mData.start, end: mData.end } : null);
      setCustomBudgets(cData.custom_budgets ?? []);

      if (configRes.ok) {
        const configData = await configRes.json() as { budget_config?: { default_monthly_amount?: number } };
        setDefaultMonthlyAmount(configData.budget_config?.default_monthly_amount ?? null);
      }
      if (dashboardRes.ok) setDashboard(await dashboardRes.json() as BudgetDashboard);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Không thể tải dữ liệu ngân sách.");
    } finally {
      setLoading(false);
    }
  }, [replace]);

  useEffect(() => {
    // Fetching is the external synchronization owned by this client page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const isCurrentMonth = true; // budget page always shows current month

  function retry() {
    setLoading(true);
    setError(null);
    void load();
  }

  async function handleCreateMonthlyBudget(amount: number, objective: string | null): Promise<{ error?: string }> {
    if (!month) return { error: "Không có tháng" };
    const r = await request("/api/monthly-budgets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, amount, objective }),
    });
    if (!r) return { error: "Không thể kết nối. Kiểm tra mạng và thử lại." };
    const d = await r.json() as BudgetPageData & { error?: string };
    if (!r.ok) return { error: d.error ?? "Lỗi" };
    setBudget(d.monthly_budget ?? null);
    setDashboard((current) => current ? {
      ...current,
      monthly_budget: { id: d.monthly_budget!.id, amount, remaining: amount - current.total_expense },
      pace_status: current.total_expense > (amount * current.days_elapsed) / current.days_in_period ? "over" : "under",
    } : current);
    if (d.start && d.end) setPeriod({ start: d.start, end: d.end });
    return {};
  }

  async function handleCreateAdjustment(delta: number, note: string | null): Promise<{ error?: string }> {
    if (!budget) return { error: "Không có ngân sách" };
    const r = await request(`/api/monthly-budgets/${budget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delta, note }),
    });
    if (!r) return { error: "Không thể kết nối. Kiểm tra mạng và thử lại." };
    const d = await r.json() as { monthly_budget?: MonthlyBudget; error?: string };
    if (!r.ok) return { error: d.error ?? "Lỗi" };
    setBudget(d.monthly_budget ?? null);
    setDashboard((current) => current?.monthly_budget && d.monthly_budget ? {
      ...current,
      monthly_budget: {
        ...current.monthly_budget,
        amount: d.monthly_budget.amount,
        remaining: current.monthly_budget.remaining + delta,
      },
      pace_status: current.total_expense > (d.monthly_budget.amount * current.days_elapsed) / current.days_in_period ? "over" : "under",
    } : current);
    return {};
  }

  async function handleUpdateMonthlyObjective(objective: string | null): Promise<{ error?: string }> {
    if (!budget) return { error: "Không có ngân sách" };
    const r = await request(`/api/monthly-budgets/${budget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objective }),
    });
    if (!r) return { error: "Không thể kết nối. Kiểm tra mạng và thử lại." };
    const d = await r.json() as { monthly_budget?: MonthlyBudget; error?: string };
    if (!r.ok) return { error: d.error ?? "Không thể lưu mục tiêu" };
    if (d.monthly_budget) setBudget(d.monthly_budget);
    return {};
  }

  async function handleCreateCustomBudget(name: string, amount: number): Promise<{ error?: string }> {
    const r = await request("/api/custom-budgets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, amount }),
    });
    if (!r) return { error: "Không thể kết nối. Kiểm tra mạng và thử lại." };
    const d = await r.json() as { custom_budget?: CustomBudget; error?: string };
    if (!r.ok) return { error: d.error ?? "Lỗi" };
    if (d.custom_budget) setCustomBudgets((prev) => [d.custom_budget!, ...prev]);
    return {};
  }

  async function handleToggleCustomBudget(id: number, active: boolean): Promise<{ error?: string }> {
    const r = await request(`/api/custom-budgets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: active ? 1 : 0 }),
    });
    if (!r) return { error: "Không thể kết nối. Kiểm tra mạng và thử lại." };
    const d = await r.json() as { error?: string };
    if (!r.ok) return { error: d.error ?? "Không thể cập nhật ngân sách" };
    await load();
    return {};
  }

  async function handleEditCustomBudget(id: number, name: string, amount: number): Promise<{ error?: string }> {
    const r = await request(`/api/custom-budgets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, amount }),
    });
    if (!r) return { error: "Không thể kết nối. Kiểm tra mạng và thử lại." };
    const d = await r.json() as { custom_budget?: Pick<CustomBudget, "id" | "name" | "amount">; error?: string };
    if (!r.ok) return { error: d.error ?? "Không thể lưu ngân sách" };
    if (d.custom_budget) {
      setCustomBudgets((current) => current.map((budgetItem) =>
        budgetItem.id === id ? { ...budgetItem, ...d.custom_budget } : budgetItem,
      ));
    }
    return {};
  }

  async function handleDeleteCustomBudget(id: number): Promise<{ error?: string; affectedCount?: number }> {
    const r = await request(`/api/custom-budgets/${id}`, { method: "DELETE" });
    if (!r) return { error: "Không thể kết nối. Kiểm tra mạng và thử lại." };
    const d = await r.json() as { error?: string; details?: { affected_count?: number } };
    if (!r.ok) return { error: d.error ?? "Không thể xoá ngân sách", affectedCount: d.details?.affected_count };
    setCustomBudgets((prev) => prev.filter((c) => c.id !== id));
    return {};
  }

  return (
    <BudgetTemplate
      month={month}
      period={period}
      monthlyBudget={budget}
      customBudgets={customBudgets}
      dashboard={dashboard}
      defaultMonthlyAmount={defaultMonthlyAmount}
      loading={loading}
      error={error}
      isCurrentMonth={isCurrentMonth}
      onRetry={retry}
      onCreateMonthlyBudget={handleCreateMonthlyBudget}
      onCreateAdjustment={handleCreateAdjustment}
      onUpdateMonthlyObjective={handleUpdateMonthlyObjective}
      onCreateCustomBudget={handleCreateCustomBudget}
      onEditCustomBudget={handleEditCustomBudget}
      onToggleCustomBudget={handleToggleCustomBudget}
      onDeleteCustomBudget={handleDeleteCustomBudget}
    />
  );
}
