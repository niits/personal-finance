import { describe, expect, it } from "vitest";
import { formatReportTime, generationProgress, safeStatisticsError } from "./presentation";

describe("statistics presentation", () => {
  it("describes generation without exposing tool labels or row counts", () => {
    const progress = generationProgress([
      { type: "tool_call", tool: "query_metrics", label: "private tool label", callId: "1", stepIndex: 0 },
      { type: "tool_result", tool: "query_metrics", rows: 42, callId: "1", durationMs: 320 },
    ]);

    expect(progress).toBe("Đang tìm những thay đổi đáng chú ý…");
    expect(progress).not.toMatch(/query_metrics|private tool label|42|320/);
  });

  it("never returns a server message, stack, or cause", () => {
    expect(safeStatisticsError(500)).toBe(
      "Chưa thể hoàn tất phân tích lúc này. Dữ liệu giao dịch của bạn vẫn được giữ nguyên.",
    );
  });

  it("formats report timestamps for the user locale", () => {
    expect(formatReportTime(0)).toMatch(/1\/1\/1970/);
  });
});
