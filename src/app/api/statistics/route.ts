import type { NextRequest } from "next/server";
import { getKysely } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { Errors } from "@/lib/errors";
import { parseMonth, currentBudgetMonth } from "@/lib/validators";
import { generateStatisticsReport } from "@/lib/statistics";
import type { Insight, AgentEvent } from "@/lib/statistics";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession(request);
    if (!session) return Errors.unauthorized();

    const periodKey = parseMonth(request.nextUrl.searchParams.get("period_key"));
    if (!periodKey) return Errors.validation("period_key phải có dạng YYYY-MM");

    const db = await getKysely();
    const row = await db
      .selectFrom("statistics_report")
      .select(["insights", "is_dirty", "generated_at"])
      .where("user_id", "=", session.user.id)
      .where("period_type", "=", "monthly")
      .where("period_key", "=", periodKey)
      .executeTakeFirst();

    const isCurrentPeriod = periodKey === currentBudgetMonth();

    if (!row) return Response.json({ found: false, period_key: periodKey, is_current_period: isCurrentPeriod }, { status: 404 });

    const insights = JSON.parse(row.insights) as Insight[];

    return Response.json(
      {
        found: true,
        period_key: periodKey,
        period_type: "monthly",
        insights,
        is_dirty: row.is_dirty === 1,
        is_current_period: isCurrentPeriod,
        generated_at: row.generated_at,
      },
      // Cache headers stay short for current-period reports; the client also forces
      // a daily refresh via POST when generated_at falls on a previous day.
      { headers: { "Cache-Control": "private, max-age=60" } },
    );
  } catch (e) {
    return Errors.internal(e);
  }
}

// User-triggered generation — returns a Server-Sent Events stream so the UI can
// display live agent steps. Emits {type:"tool_call"}, {type:"tool_result"} events
// as the agent works, then {type:"done", report:{...}} on completion.
export async function POST(request: NextRequest) {
  const session = await requireSession(request);
  if (!session) return Errors.unauthorized();

  const periodKey = parseMonth(request.nextUrl.searchParams.get("period_key"));
  if (!periodKey) return Errors.validation("period_key phải có dạng YYYY-MM");

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

  (async () => {
    try {
      await generateStatisticsReport(userId, "monthly", periodKey, send);

      const db = await getKysely();
      const row = await db
        .selectFrom("statistics_report")
        .select(["insights", "generated_at"])
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
          is_dirty: false,
          is_current_period: periodKey === currentBudgetMonth(),
          generated_at: row?.generated_at ?? Math.floor(Date.now() / 1000),
        },
      });
    } catch (e) {
      send({ type: "error", message: e instanceof Error ? e.message : String(e) });
    } finally {
      try { ctrl.close(); } catch { /* already closed */ }
    }
  })();

  return new Response(stream as unknown as BodyInit, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
