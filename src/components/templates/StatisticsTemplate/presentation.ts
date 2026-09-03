import type { AgentEvent } from "@/lib/statistics";

export function generationProgress(events: AgentEvent[]): string {
  const completedSteps = events.filter((event) => event.type === "tool_result").length;

  if (completedSteps === 0) return "Đang chuẩn bị thông tin thu chi…";
  if (completedSteps < 3) return "Đang tìm những thay đổi đáng chú ý…";
  return "Đang hoàn thiện nhận xét cho bạn…";
}

export function safeStatisticsError(status?: number): string {
  if (status === 401 || status === 403) {
    return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại rồi thử tiếp.";
  }
  if (status === 429) {
    return "Hệ thống đang có nhiều yêu cầu. Vui lòng thử lại sau ít phút.";
  }
  return "Chưa thể hoàn tất phân tích lúc này. Dữ liệu giao dịch của bạn vẫn được giữ nguyên.";
}

export function formatReportTime(unixSeconds: number): string {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(unixSeconds * 1000));
}
