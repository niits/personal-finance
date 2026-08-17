"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LedgerBudgetTemplate } from "@/components/templates/LedgerBudgetTemplate";
import type { BudgetPeriodDto, CustomEnvelopeDto } from "@/lib/ledger/contracts";

type Pending = { signature: string; key: string };

async function message(response: Response) {
  const body = await response.json().catch(() => null) as { error?: string } | null;
  return body?.error ?? "Không thể hoàn tất yêu cầu.";
}

export default function BudgetPage() {
  const router = useRouter();
  const [periods, setPeriods] = useState<BudgetPeriodDto[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [envelopes, setEnvelopes] = useState<CustomEnvelopeDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [envelopesLoading, setEnvelopesLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<Pending | null>(null);
  const selectedIdRef = useRef<number | null>(null);
  const periodRequest = useRef(0);
  const envelopeRequest = useRef(0);
  const envelopeController = useRef<AbortController | null>(null);

  const loadEnvelopes = useCallback(async (periodId: number) => {
    const request = ++envelopeRequest.current;
    envelopeController.current?.abort();
    const controller = new AbortController();
    envelopeController.current = controller;
    setEnvelopes([]);
    setError(null);
    setEnvelopesLoading(true);
    try {
      const response = await fetch(`/api/budget-periods/${periodId}/custom-budgets`, { signal: controller.signal });
      if (response.status === 401) { router.replace("/sign-in"); return; }
      if (!response.ok) throw new Error(await message(response));
      const data = await response.json() as { customBudgets: CustomEnvelopeDto[] };
      if (request === envelopeRequest.current && selectedIdRef.current === periodId) setEnvelopes(data.customBudgets);
    } catch (caught) {
      if (controller.signal.aborted) return;
      if (request === envelopeRequest.current && selectedIdRef.current === periodId) {
        setEnvelopes([]);
        setError(caught instanceof Error ? caught.message : "Không thể tải phong bì của kỳ đã chọn.");
      }
    } finally {
      if (request === envelopeRequest.current) setEnvelopesLoading(false);
    }
  }, [router]);

  const loadPeriods = useCallback(async (preferred?: number, initial = false) => {
    const request = ++periodRequest.current;
    if (initial) setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/budget-periods");
      if (response.status === 401) { router.replace("/sign-in"); return; }
      if (!response.ok) throw new Error(await message(response));
      const data = await response.json() as { budgetPeriods: BudgetPeriodDto[] };
      if (request !== periodRequest.current) return;
      setPeriods(data.budgetPeriods);
      const today = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const requested = preferred ?? selectedIdRef.current;
      const next = data.budgetPeriods.some((period) => period.id === requested)
        ? requested
        : data.budgetPeriods.find((period) => period.startDate <= today && period.endDate >= today)?.id
          ?? data.budgetPeriods[0]?.id
          ?? null;
      selectedIdRef.current = next;
      setSelectedId(next);
      setEnvelopes([]);
      if (next !== null) await loadEnvelopes(next);
      else setEnvelopesLoading(false);
    } catch (caught) {
      if (request === periodRequest.current) {
        setPeriods([]);
        setEnvelopes([]);
        setError(caught instanceof Error ? caught.message : "Không thể tải ngân sách.");
      }
    } finally {
      if (initial && request === periodRequest.current) setLoading(false);
    }
  }, [loadEnvelopes, router]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => void loadPeriods(undefined, true));
    return () => {
      cancelAnimationFrame(frame);
      periodRequest.current += 1;
      envelopeRequest.current += 1;
      envelopeController.current?.abort();
    };
  }, [loadPeriods]);

  function selectPeriod(id: number) {
    selectedIdRef.current = id;
    setSelectedId(id);
    setEnvelopes([]);
    setError(null);
    void loadEnvelopes(id);
  }

  async function mutate(endpoint: string, method: "POST" | "PATCH", body: unknown, refreshId?: number) {
    const signature = JSON.stringify({ endpoint, method, body });
    if (!pending.current || pending.current.signature !== signature) pending.current = { signature, key: crypto.randomUUID() };
    setSubmitting(true);
    try {
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json", "Idempotency-Key": pending.current.key },
        body: JSON.stringify(body),
      });
      if (!response.ok) return { error: await message(response) };
      pending.current = null;
      await loadPeriods(refreshId);
      return {};
    } catch (caught) {
      return { error: caught instanceof Error ? caught.message : "Lỗi kết nối" };
    } finally {
      setSubmitting(false);
    }
  }

  return <LedgerBudgetTemplate
    periods={periods}
    selectedId={selectedId}
    envelopes={envelopes}
    loading={loading}
    envelopesLoading={envelopesLoading}
    submitting={submitting}
    error={error}
    onSelect={selectPeriod}
    onCreatePeriod={(draft) => mutate("/api/budget-periods", "POST", draft)}
    onPatchPeriod={(id, draft) => mutate(`/api/budget-periods/${id}`, "PATCH", draft, id)}
    onAdjustPeriod={(id, target, delta, note) => mutate(`/api/budget-periods/${id}/adjustments`, "POST", { target, delta, note }, id)}
    onCreateEnvelope={(periodId, name, amount) => mutate(`/api/budget-periods/${periodId}/custom-budgets`, "POST", { name, amount }, periodId)}
    onRenameEnvelope={(id, name) => mutate(`/api/ledger/custom-budgets/${id}`, "PATCH", { name }, selectedIdRef.current ?? undefined)}
    onAdjustEnvelope={(id, delta, note) => mutate(`/api/ledger/custom-budgets/${id}/adjustments`, "POST", { delta, note }, selectedIdRef.current ?? undefined)}
    onCloseEnvelope={(id) => mutate(`/api/ledger/custom-budgets/${id}/close`, "POST", {}, selectedIdRef.current ?? undefined)}
  />;
}
