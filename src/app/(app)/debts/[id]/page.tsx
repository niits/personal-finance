"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PositionActionSheet } from "@/components/organisms/PositionActionSheet";
import type { PositionActionIntent } from "@/components/organisms/PositionActionSheet";
import { PositionCloseCorrectionSheet } from "@/components/organisms/PositionCloseCorrectionSheet";
import { PositionDetailTemplate } from "@/components/templates/PositionDetailTemplate";
import type { PositionAvailableAction, PositionDetailResponse } from "@/lib/ledger/positions";

type PendingAction = { signature: string; key: string };

async function responseError(response: Response): Promise<string> {
  const body = await response.json().catch(() => null) as { error?: string } | null;
  return body?.error ?? "Không thể hoàn tất yêu cầu.";
}

export default function PositionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<PositionDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAction, setSelectedAction] = useState<PositionAvailableAction | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [closeCorrectionOpen, setCloseCorrectionOpen] = useState(false);
  const pendingAction = useRef<PendingAction | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await fetch(`/api/positions/${id}`);
      if (response.status === 401) { router.replace("/sign-in"); return; }
      if (response.status === 404) { router.replace("/debts"); return; }
      if (!response.ok) throw new Error(await responseError(response));
      setError(null);
      setData(await response.json() as PositionDetailResponse);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể tải chi tiết vị thế.");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/positions/${id}`)
      .then(async (response) => {
        if (response.status === 401) { router.replace("/sign-in"); return null; }
        if (response.status === 404) { router.replace("/debts"); return null; }
        if (!response.ok) throw new Error(await responseError(response));
        return response.json() as Promise<PositionDetailResponse>;
      })
      .then((responseData) => {
        if (!cancelled && responseData) { setError(null); setData(responseData); }
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Không thể tải chi tiết vị thế.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, router]);

  async function submitAction(intent: PositionActionIntent) {
    setSubmitting(true);
    setActionError(null);
    const signature = JSON.stringify({ id, ...intent });
    if (!pendingAction.current || pendingAction.current.signature !== signature) {
      pendingAction.current = { signature, key: crypto.randomUUID() };
    }
    try {
      const response = await fetch(`/api/positions/${id}/${intent.action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": pendingAction.current.key },
        body: JSON.stringify(intent.action === "close" ? { date: intent.date } : { amount: intent.amount, date: intent.date }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      pendingAction.current = null;
      setSelectedAction(null);
      await load(true);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Không thể ghi nhận thao tác.");
    } finally {
      setSubmitting(false);
    }
  }

  async function reverseClose() {
    const signature = JSON.stringify({ id, action: "close_reverse" });
    if (!pendingAction.current || pendingAction.current.signature !== signature) {
      pendingAction.current = { signature, key: crypto.randomUUID() };
    }
    setSubmitting(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/positions/${id}/close/reverse`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": pendingAction.current.key },
        body: "{}",
      });
      if (!response.ok) throw new Error(await responseError(response));
      pendingAction.current = null;
      setCloseCorrectionOpen(false);
      await load(true);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Không thể điều chỉnh lần tất toán.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PositionDetailTemplate
        data={data}
        loading={loading}
        error={error}
        onBack={() => router.push("/debts")}
        onRetry={() => void load()}
        onSelectAction={(action) => { setActionError(null); setSelectedAction(action); }}
        onReverseClose={() => { setActionError(null); setCloseCorrectionOpen(true); }}
      />
      {data ? (
        <PositionActionSheet
          key={selectedAction?.code ?? "closed"}
          position={data.position}
          action={selectedAction}
          submitting={submitting}
          error={actionError}
          onSubmit={(intent) => void submitAction(intent)}
          onClose={() => { if (!submitting) setSelectedAction(null); }}
        />
      ) : null}
      {data?.closure ? <PositionCloseCorrectionSheet key={closeCorrectionOpen ? data.closure.id : "closed"} open={closeCorrectionOpen} position={data.position} closedDate={data.closure.date} submitting={submitting} error={actionError} onConfirm={() => void reverseClose()} onClose={() => { if (!submitting) setCloseCorrectionOpen(false); }} /> : null}
    </>
  );
}
