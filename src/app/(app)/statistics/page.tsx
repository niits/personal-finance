"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { StatisticsTemplate } from "@/components/templates/StatisticsTemplate";
import { useStatistics } from "@/hooks/useStatistics";
import { signOut } from "@/lib/auth-client";

export default function StatisticsPage() {
  const stats = useStatistics();
  const router = useRouter();
  useEffect(() => {
    if (stats.error?.status === 401 || stats.regenError?.status === 401) {
      void signOut().finally(() => router.replace("/sign-in"));
    }
  }, [router, stats.error?.status, stats.regenError?.status]);
  return <StatisticsTemplate {...stats} />;
}
