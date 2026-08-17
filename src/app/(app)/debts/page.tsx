"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PositionCreateSheet } from "@/components/organisms/PositionCreateSheet";
import type { CreatePositionIntent } from "@/components/organisms/PositionCreateSheet";
import { PositionsTemplate } from "@/components/templates/PositionsTemplate";
import type { PositionListResponse } from "@/lib/ledger/positions";

type PendingCreate = { signature: string; key: string };

async function responseError(response: Response): Promise<string> {
  const body = await response.json().catch(() => null) as { error?: string } | null;
  return body?.error ?? "Không thể hoàn tất yêu cầu.";
}

export default function PositionsPage() {
  const router = useRouter();
  const [data, setData] = useState<PositionListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSession, setCreateSession] = useState(0);
  const pendingCreate = useRef<PendingCreate | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await fetch("/api/positions?includeClosed=true");
      if (response.status === 401) { router.replace("/sign-in"); return; }
      if (!response.ok) throw new Error(await responseError(response));
      setError(null);
      setData(await response.json() as PositionListResponse);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể tải vị thế.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/positions?includeClosed=true")
      .then(async (response) => {
        if (response.status === 401) { router.replace("/sign-in"); return null; }
        if (!response.ok) throw new Error(await responseError(response));
        return response.json() as Promise<PositionListResponse>;
      })
      .then((responseData) => {
        if (!cancelled && responseData) { setError(null); setData(responseData); }
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Không thể tải vị thế.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [router]);

  async function createPosition(intent: CreatePositionIntent) {
    setCreating(true);
    setCreateError(null);
    const positionInput = {
      name: intent.name,
      kind: intent.kind,
      counterparty: intent.counterparty,
      dueDate: intent.dueDate,
      note: intent.note,
    };
    const signature = JSON.stringify(positionInput);
    if (!pendingCreate.current || pendingCreate.current.signature !== signature) {
      pendingCreate.current = { signature, key: crypto.randomUUID() };
    }
    try {
      const response = await fetch("/api/positions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": pendingCreate.current.key },
        body: JSON.stringify(positionInput),
      });
      if (!response.ok) throw new Error(await responseError(response));
      const created = await response.json() as { position: { id: string } };
      pendingCreate.current = null;
      setCreateOpen(false);
      router.push(`/debts/${created.position.id}`);
    } catch (caught) {
      setCreateError(caught instanceof Error ? caught.message : "Không thể tạo vị thế.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <PositionsTemplate
        data={data}
        loading={loading}
        error={error}
        historyExpanded={historyExpanded}
        onToggleHistory={() => setHistoryExpanded((expanded) => !expanded)}
        onCreatePosition={() => {
          setCreateError(null);
          setCreateSession((session) => session + 1);
          setCreateOpen(true);
        }}
        onRetry={() => void load()}
      />
      <PositionCreateSheet
        key={createSession}
        open={createOpen}
        submitting={creating}
        error={createError}
        onSubmit={(intent) => void createPosition(intent)}
        onClose={() => { if (!creating) setCreateOpen(false); }}
      />
    </>
  );
}
