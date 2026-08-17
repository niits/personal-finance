"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/atoms/Spinner";
import { StatisticsTemplate } from "@/components/templates/StatisticsTemplate";
import { useStatistics } from "@/hooks/useStatistics";
import type { LedgerProfileResponse } from "@/lib/ledger/contracts";

export default function StatisticsPage() {
  const router = useRouter();
  const [mode, setMode] = useState<LedgerProfileResponse["mode"] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ledger/profile")
      .then(async (response) => {
        if (response.status === 401) { router.replace("/sign-in"); return null; }
        if (!response.ok) throw new Error("Profile unavailable");
        return response.json() as Promise<LedgerProfileResponse>;
      })
      .then((profile) => {
        if (cancelled || !profile) return;
        if (profile.mode === "ledger") router.replace("/");
        else setMode(profile.mode);
      })
      .catch(() => { if (!cancelled) router.replace("/"); });
    return () => { cancelled = true; };
  }, [router]);

  if (mode === null) return <main className="min-h-[60svh] bg-canvas-parchment"><Spinner label="Đang kiểm tra chế độ sổ…" /></main>;
  return <LegacyStatistics />;
}

function LegacyStatistics() {
  const stats = useStatistics();
  return <StatisticsTemplate {...stats} />;
}
