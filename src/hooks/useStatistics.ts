"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { Report, ApiError, AgentStep } from "@/components/templates/StatisticsTemplate";
import type { AgentEvent } from "@/lib/statistics";

function currentMonth() {
  return new Date().toISOString().substring(0, 7);
}

function todayUtc() {
  return new Date().toISOString().substring(0, 10);
}

function dayOf(unixSeconds: number) {
  return new Date(unixSeconds * 1000).toISOString().substring(0, 10);
}

export function prevMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`;
}

export function nextMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
}

async function readError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as Omit<ApiError, "status">;
    return { status: res.status, ...body };
  } catch {
    return { status: res.status, error: `HTTP ${res.status} ${res.statusText || "(no body)"}` };
  }
}

export type UseStatisticsReturn = {
  selectedMonth: string;
  isAtUpperBound: boolean;
  status: "loading" | "generating" | "ready" | "error";
  report: Report | null;
  agentSteps: AgentStep[];
  refreshing: boolean;
  error: ApiError | null;
  regenError: ApiError | null;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onRegenerate: () => void;
  onRetry: () => void;
  onDismissRegenError: () => void;
};

export function useStatistics(): UseStatisticsReturn {
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [report, setReport] = useState<Report | null>(null);
  const [status, setStatus] = useState<"loading" | "generating" | "ready" | "error">("loading");
  const [error, setError] = useState<ApiError | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [upperBound] = useState(currentMonth);
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([]);
  const [regenError, setRegenError] = useState<ApiError | null>(null);
  const stepCounter = useRef(0);
  const activeMonth = useRef(selectedMonth);

  const generate = useCallback(async (
    month: string,
    onStep?: (step: AgentStep) => void,
  ): Promise<{ report: Report } | { error: ApiError }> => {
    const res = await fetch(`/api/statistics?period_key=${month}`, { method: "POST" });
    if (!res.ok) return { error: await readError(res) };

    const reader = res.body?.getReader();
    if (!reader) return { error: { status: 500, error: "No response body" } };

    const decoder = new TextDecoder();
    let buffer = "";
    let finalReport: Report | null = null;
    let streamError: ApiError | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";
      for (const part of parts) {
        if (!part.startsWith("data: ")) continue;
        try {
          const event = JSON.parse(part.slice(6)) as AgentEvent | { type: "report"; report: Report };
          if (event.type === "report") {
            finalReport = event.report;
          } else if (event.type === "error") {
            streamError = { status: 500, error: (event as { type: "error"; message: string }).message };
          } else {
            const step: AgentStep = { ...event as AgentEvent, id: ++stepCounter.current };
            onStep?.(step);
          }
        } catch { /* malformed SSE event, skip */ }
      }
    }

    if (streamError) return { error: streamError };
    if (!finalReport) return { error: { status: 500, error: "Stream ended without report" } };
    return { report: finalReport };
  }, []);

  const load = useCallback(async (month: string) => {
    activeMonth.current = month;
    setStatus("loading");
    setReport(null);
    setError(null);
    setRegenError(null);
    setRefreshing(false);

    const res = await fetch(`/api/statistics?period_key=${month}`);

    if (res.status === 404) {
      if (activeMonth.current !== month) return;
      setStatus("generating");
      setAgentSteps([]);
      const result = await generate(month, (step) => {
        if (activeMonth.current === month) setAgentSteps((prev) => [...prev, step]);
      });
      if (activeMonth.current !== month) return;
      if ("error" in result) { setError(result.error); setStatus("error"); return; }
      setReport(result.report);
      setStatus("ready");
      return;
    }

    if (!res.ok) {
      const apiError = await readError(res);
      if (activeMonth.current !== month) return;
      setError(apiError);
      setStatus("error");
      return;
    }

    const data = (await res.json()) as Report;
    if (activeMonth.current !== month) return;

    setReport(data);
    setStatus("ready");

    // Background refresh when report is stale
    const stale = data.is_dirty || (data.is_current_period && dayOf(data.generated_at) < todayUtc());
    if (!stale) return;

    setRefreshing(true);
    const result = await generate(month);
    if (activeMonth.current !== month) return;
    setRefreshing(false);
    if ("report" in result) setReport(result.report);
    else setRegenError(result.error);
  }, [generate]);

  const regenerate = useCallback(async (month: string) => {
    activeMonth.current = month;
    setStatus("generating");
    setAgentSteps([]);
    setError(null);
    setRegenError(null);
    const result = await generate(month, (step) => {
      if (activeMonth.current === month) setAgentSteps((prev) => [...prev, step]);
    });
    if (activeMonth.current !== month) return;
    if ("error" in result) {
      if (!report) { setError(result.error); setStatus("error"); }
      else { setRegenError(result.error); setStatus("ready"); }
      return;
    }
    setReport(result.report);
    setStatus("ready");
  }, [generate, report]);

  useEffect(() => { load(selectedMonth); }, [load, selectedMonth]);

  const isAtUpperBound = selectedMonth === upperBound;

  return {
    selectedMonth,
    isAtUpperBound,
    status,
    report,
    agentSteps,
    refreshing,
    error,
    regenError,
    onPrevMonth: () => setSelectedMonth(prevMonth(selectedMonth)),
    onNextMonth: () => { if (!isAtUpperBound) setSelectedMonth(nextMonth(selectedMonth)); },
    onRegenerate: () => regenerate(selectedMonth),
    onRetry: () => load(selectedMonth),
    onDismissRegenError: () => setRegenError(null),
  };
}
