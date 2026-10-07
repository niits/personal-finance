import { test, expect } from "@playwright/test";

declare global {
  interface Window {
    finishStatistics: (fail?: boolean) => void;
  }
}

const report = {
  found: true,
  period_key: "2026-10",
  insights: [{ type: "analysis", topic: "cards", title: "Chi thẻ chiếm 75% chi tiêu tiêu dùng.", summary: "Chi thẻ là 3.000.000 ₫ trong tổng chi tiêu tiêu dùng 4.000.000 ₫.", chart_type: "bar", value_unit: "currency", chart_data: [{ name: "Thẻ tín dụng", value: 3_000_000, highlight: true }, { name: "Tiền mặt", value: 1_000_000 }] }],
  is_dirty: false,
  is_current_period: true,
  generated_at: Math.floor(Date.now() / 1000),
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ report }) => {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      if (typeof input !== "string" || !input.startsWith("/api/statistics?") || init?.method !== "POST") return nativeFetch(input, init);
      const encoder = new TextEncoder();
      let controller!: ReadableStreamDefaultController<Uint8Array>;
      const body = new ReadableStream<Uint8Array>({ start(c) { controller = c; } });
      const send = (event: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      send({ type: "step", key: "spending", label: "Tổng hợp chi tiêu tiêu dùng và thu chi", status: "completed" });
      send({ type: "step", key: "cards", label: "Đối chiếu chi tiêu thẻ và trạng thái thanh toán", status: "running" });
      window.finishStatistics = (fail = false) => {
        if (fail) send({ type: "error", message: "Private model error" });
        else send({ type: "report", report: { ...report, period_key: new URL(input, location.origin).searchParams.get("period_key") } });
        controller.close();
      };
      return new Response(body, { headers: { "Content-Type": "text/event-stream" } });
    };
  }, { report });
});

test("shows streamed steps before rendering the completed card report", async ({ page }) => {
  await page.route("**/api/statistics?*", route => route.fulfill({ status: 404, json: { found: false } }));
  await page.goto("/statistics");
  await page.getByRole("button", { name: "Tạo bản phân tích" }).click();
  await expect(page.getByLabel("Tiến độ phân tích")).toContainText("Đối chiếu chi tiêu thẻ và trạng thái thanh toán");
  await expect(page.getByText("Đang xử lý", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: report.insights[0].title })).not.toBeVisible();
  await page.evaluate(() => window.finishStatistics());
  await expect(page.getByRole("heading", { name: report.insights[0].title })).toBeVisible();
  await expect(page.locator("[data-statistics-chart] svg").first()).toBeVisible();
  await page.getByText("Xem dữ liệu biểu đồ", { exact: true }).click();
  await expect(page.getByRole("table")).toContainText("3.000.000 ₫");
});

test("preserves the previous report and progress when background generation fails", async ({ page }) => {
  await page.route("**/api/statistics?*", route => route.fulfill({ json: { ...report, is_dirty: true } }));
  await page.goto("/statistics");
  await expect(page.getByRole("heading", { name: report.insights[0].title })).toBeVisible();
  await expect(page.getByLabel("Tiến độ phân tích")).toBeVisible();
  await page.evaluate(() => window.finishStatistics(true));
  await expect(page.getByText("Chưa cập nhật được bản phân tích", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: report.insights[0].title })).toBeVisible();
  await expect(page.getByText("Chưa hoàn tất", { exact: true })).toBeVisible();
  await expect(page.getByText("Private model error", { exact: true })).not.toBeVisible();
});
