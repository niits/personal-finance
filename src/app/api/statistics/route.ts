import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { NextRequest } from "next/server";
import { getKysely } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { Errors } from "@/lib/errors";
import { parseMonth, currentBudgetMonth } from "@/lib/validators";
import { generateStatisticsReport } from "@/lib/statistics";
import type { Insight, AgentEvent } from "@/lib/statistics";
import { REPORT_VERSION } from "@/lib/statistics-report";
import { privateJsonResponse } from "@/lib/private-revalidation";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (!session) return Errors.unauthorized();

    const periodKey = parseMonth(request.nextUrl.searchParams.get("period_key"));
    if (!periodKey) return Errors.validation("Tháng phân tích phải có định dạng YYYY-MM.");

    const db = await getKysely();
    const row = await db
      .selectFrom("statistics_report")
      .select(["insights", "is_dirty", "generated_at", "snapshot", "model_id", "report_version"])
      .where("user_id", "=", session.user.id)
      .where("period_type", "=", "monthly")
      .where("period_key", "=", periodKey)
      .executeTakeFirst();

    const isCurrentPeriod = periodKey === currentBudgetMonth();

    if (!row) return Response.json(
      { found: false, period_key: periodKey, is_current_period: isCurrentPeriod },
      { status: 404, headers: { "Cache-Control": "private, no-cache" } },
    );

    const insights = JSON.parse(row.insights) as Insight[];

    return privateJsonResponse(request, session.user.id, {
        found: true,
        period_key: periodKey,
        period_type: "monthly",
        insights,
        is_dirty: row.is_dirty === 1 || row.report_version < REPORT_VERSION,
        is_current_period: isCurrentPeriod,
        generated_at: row.generated_at,
        snapshot: row.snapshot ? JSON.parse(row.snapshot) : null,
        model_id: row.model_id,
        report_version: row.report_version,
    });
  } catch (e) {
    return Errors.internal(e);
  }
}

// Generation emits trusted processing steps, followed by the persisted report.
export async function POST(request: NextRequest) {
  const session = await requireSession(request);
  if (!session) return Errors.unauthorized();

  const periodKey = parseMonth(request.nextUrl.searchParams.get("period_key"));
  if (!periodKey) return Errors.validation("Tháng phân tích phải có định dạng YYYY-MM.");

  if (periodKey > currentBudgetMonth()) {
    return Errors.validation("Không thể tạo thống kê cho tháng tương lai");
  }

  const userId = session.user.id;
  const encoder = new TextEncoder();
  let ctrl!: ReadableStreamDefaultController<Uint8Array>;

  const stream = new ReadableStream<Uint8Array>({ start(c) { ctrl = c; } });

  const send = (event: AgentEvent | { type: "report"; report: Record<string, unknown> }) => {
    try { ctrl.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`)); } catch { /* closed */ }
  };

  const generation = (async () => {
    try {
      await generateStatisticsReport(userId, "monthly", periodKey, send);

      const db = await getKysely();
      const row = await db
        .selectFrom("statistics_report")
        .select(["insights", "generated_at", "is_dirty", "snapshot", "model_id", "report_version"])
        .where("user_id", "=", userId)
        .where("period_type", "=", "monthly")
        .where("period_key", "=", periodKey)
        .executeTakeFirst();

      const insights = row ? (JSON.parse(row.insights) as Insight[]) : [];
      send({
        type: "report",
        report: {
          found: true,
          period_key: periodKey,
          period_type: "monthly",
          insights,
          is_dirty: row?.is_dirty === 1 || (row?.report_version ?? 0) < REPORT_VERSION,
          snapshot: row?.snapshot ? JSON.parse(row.snapshot) : null,
          model_id: row?.model_id ?? null,
          report_version: row?.report_version ?? REPORT_VERSION,
          is_current_period: periodKey === currentBudgetMonth(),
          generated_at: row?.generated_at ?? Math.floor(Date.now() / 1000),
        },
      });
    } catch (e) {
      console.error("[statistics] generation failed", e);
      send({ type: "error", message: "Không thể hoàn tất bản phân tích. Vui lòng thử lại." });
    } finally {
      try { ctrl.close(); } catch { /* already closed */ }
    }
  })();

  const context = await getCloudflareContext({ async: true });
  context.ctx.waitUntil(generation);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
