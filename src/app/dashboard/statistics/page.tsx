"use client";

import { StatisticsTemplate } from "@/components/templates/StatisticsTemplate";
import { useStatistics } from "@/hooks/useStatistics";

export default function StatisticsPage() {
  const stats = useStatistics();
  return <StatisticsTemplate {...stats} />;
}
