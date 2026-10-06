import type { AgentEvent } from "@/lib/statistics-report";

const reportTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Ho_Chi_Minh",
});

export function generationProgress(events: AgentEvent[]): string {
  const phases = events.filter((event): event is Extract<AgentEvent, { type: "step" }> => event.type === "step");
  const latest = phases.at(-1);
  if (latest) return latest.status === "running" ? `${latest.label}…` : `Đã hoàn tất: ${latest.label.toLowerCase()}.`;
  const completedSteps = events.filter((event) => event.type === "tool_result").length;

  if (completedSteps === 0) return "Đang tổng hợp dữ liệu thu nhập và chi tiêu…";
  if (completedSteps < 3) return "Đang so sánh các khoản thu nhập và chi tiêu…";
  return "Đang hoàn thành bản phân tích…";
}

export function safeStatisticsError(status?: number): string {
  if (status === 401 || status === 403) {
    return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại rồi thử tiếp.";
  }
  if (status === 429) {
    return "Hệ thống đang có nhiều yêu cầu. Vui lòng thử lại sau ít phút.";
  }
  return "Không thể hoàn tất bản phân tích. Dữ liệu giao dịch vẫn được giữ nguyên. Vui lòng thử lại.";
}

export function formatReportTime(unixSeconds: number): string {
  return reportTimeFormatter.format(new Date(unixSeconds * 1000));
}
