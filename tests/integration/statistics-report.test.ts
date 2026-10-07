import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:test";
import { Kysely } from "kysely";
import { D1Dialect } from "kysely-d1";
import { NextRequest } from "next/server";
import type { Database } from "@/lib/schema";
import type { StatisticsSnapshot } from "@/lib/statistics-report";
import { applyMigrations, seedCategory, seedMonthlyBudget, seedUser } from "./helpers";

const control = vi.hoisted(() => ({ user: "statistics-owner" as string | null, beforeGeneration: null as null | (() => Promise<void>), fail: false }));
vi.mock("@/lib/db", () => ({ getKysely: async () => new Kysely<Database>({ dialect: new D1Dialect({ database: env.DB }) }) }));
vi.mock("@/lib/session", () => ({ requireSession: async () => control.user ? { user: { id: control.user } } : null }));
vi.mock("@/lib/llm", () => ({ getStatisticsModel: async () => ({ model: {}, modelId: "openai/gpt-6.1-sol" }) }));
vi.mock("@/lib/telemetry", () => ({ startAITrace: () => ({ telemetry: undefined, flush: async () => {} }) }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: async () => ({ env: {}, ctx: { waitUntil: () => {} } }) }));
vi.mock("@/lib/validators", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/validators")>(), currentDate: () => "2026-10-05", currentBudgetMonth: () => "2026-10" }));
vi.mock("ai", async importOriginal => ({
  ...await importOriginal<typeof import("ai")>(),
  generateText: async () => {
    if (control.beforeGeneration) await control.beforeGeneration();
    if (control.fail) throw new Error("Private model failure");
    return { output: { insights: [
      { type: "analysis", topic: "cards", title: "Chi thẻ thuộc tổng chi tiêu.", summary: "Trong kỳ, một phần chi thẻ chưa thanh toán.", chart_id: "payment_methods", chart_type: "horizontal_bar", highlight_ids: [JSON.stringify(["Thẻ tín dụng", ""])] },
      { type: "recommendation", topic: "budget", title: "Đối chiếu hạn mức trước khi chi thêm.", summary: "Duy trì theo dõi phần ngân sách còn lại.", chart_id: null, chart_type: null, highlight_ids: [] },
    ] } };
  },
}));
import { generateStatisticsReport, loadStatisticsSnapshot } from "@/lib/statistics";
import { GET, POST } from "@/app/api/statistics/route";

let category: number;
let nonBudget: number;
let budget: number;
const user = "statistics-owner";
beforeAll(async () => {
  await applyMigrations();
  await seedUser({ id: user, email: "statistics-owner@example.com" });
  await seedUser({ id: "statistics-other", email: "statistics-other@example.com" });
  category = await seedCategory(user, "Ăn uống");
  nonBudget = await seedCategory(user, "Tiết kiệm");
  await env.DB.prepare("UPDATE category SET budget_behavior = 'non_budget' WHERE id = ?").bind(nonBudget).run();
  budget = (await seedMonthlyBudget(user, "2026-10", 1_000_000)).id;
  await env.DB.prepare("INSERT INTO credit_card_group (id, user_id, name, statement_close_day) VALUES ('statistics-card', ?, 'Thẻ A', 3)").bind(user).run();
  for (const t of [
    { amount: 200_000, date: "2026-10-01", cat: category, card: "statistics-card" },
    { amount: 300_000, date: "2026-10-04", cat: category, card: "statistics-card" },
    { amount: 100_000, date: "2026-10-05", cat: category, card: null },
    { amount: 2_000_000, date: "2026-10-02", cat: nonBudget, card: null },
  ]) {
    await env.DB.prepare('INSERT INTO "transaction" (user_id, amount, type, category_id, date, monthly_budget_id, credit_card_group_id) VALUES (?, ?, \'expense\', ?, ?, ?, ?)').bind(user, t.amount, t.cat, t.date, budget, t.card).run();
  }
  await env.DB.prepare("INSERT INTO credit_card_statement (id, user_id, group_id, period_start, period_end, status, paid_at) VALUES ('statistics-statement', ?, 'statistics-card', '2026-09-03', '2026-10-03', 'paid', '2026-10-03')").bind(user).run();
});
beforeEach(() => { control.user = user; control.beforeGeneration = null; control.fail = false; });
const request = (method = "GET") => new NextRequest("http://localhost/api/statistics?period_key=2026-10", { method });

describe("statistics report contracts", () => {
  it("computes consumption and the period-specific unpaid card subset", async () => {
    const { snapshot } = await loadStatisticsSnapshot(user, "2026-10");
    expect(snapshot.metrics).toMatchObject({ consumption_expense: 600_000, total_outflow: 2_600_000, card_spend: 500_000, cash_spend: 100_000, unpaid_card_spend: 300_000, budget_remaining: 400_000 });
    expect(snapshot.period.through).toBe("2026-10-05");
    expect(snapshot.previous_period.through).toBe("2026-09-05");
  });
  it("scopes source data and reports to the authenticated user", async () => {
    expect((await loadStatisticsSnapshot("statistics-other", "2026-10")).snapshot.metrics.consumption_expense).toBe(0);
    await generateStatisticsReport(user, "monthly", "2026-10");
    control.user = "statistics-other";
    expect((await GET(request())).status).toBe(404);
    control.user = null;
    expect((await GET(request())).status).toBe(401);
    expect((await POST(request("POST"))).status).toBe(401);
  });
  it("streams processing steps before the model finishes", async () => {
    let resolve!: () => void;
    control.beforeGeneration = () => new Promise<void>(r => { resolve = r; });
    const response = await POST(request("POST"));
    const reader = response.body!.getReader();
    let streamed = "";
    while (!streamed.includes('"key":"narrative"')) {
      const chunk = await reader.read();
      if (chunk.done) throw new Error(`Stream ended before narrative: ${streamed}`);
      streamed += new TextDecoder().decode(chunk.value);
    }
    expect(streamed).toContain('"type":"step"');
    expect(streamed).not.toContain('"type":"report"');
    resolve();
    while (true) { const chunk = await reader.read(); if (chunk.done) break; streamed += new TextDecoder().decode(chunk.value); }
    expect(streamed).toContain('"type":"report"');
    expect(streamed).toContain('"model_id":"openai/gpt-6.1-sol"');
  });
  it("preserves a visible report after failed regeneration and hides internal errors", async () => {
    await generateStatisticsReport(user, "monthly", "2026-10");
    const before = await env.DB.prepare("SELECT insights FROM statistics_report WHERE user_id = ?").bind(user).first();
    control.fail = true;
    const stream = await (await POST(request("POST"))).text();
    expect(stream).toContain('"type":"error"');
    expect(stream).not.toContain("Private model failure");
    expect(await env.DB.prepare("SELECT insights FROM statistics_report WHERE user_id = ?").bind(user).first()).toEqual(before);
  });
  it("stores reproducible evidence and remains dirty when data change during generation", async () => {
    control.beforeGeneration = async () => { await env.DB.prepare("UPDATE monthly_budget SET amount = 1100000 WHERE id = ?").bind(budget).run(); };
    await generateStatisticsReport(user, "monthly", "2026-10");
    const result = await env.DB.prepare("SELECT is_dirty, snapshot, model_id, report_version FROM statistics_report WHERE user_id = ?").bind(user).first<{ is_dirty: number; snapshot: string; model_id: string; report_version: number }>();
    expect(result).toMatchObject({ is_dirty: 1, model_id: "openai/gpt-6.1-sol", report_version: 3 });
    expect((JSON.parse(result!.snapshot) as StatisticsSnapshot).metrics.budget_amount).toBe(1_000_000);
  });
  it("marks historical reports dirty for transaction moves and statement payments", async () => {
    await env.DB.prepare("INSERT INTO statistics_report (user_id, period_type, period_key) VALUES (?, 'monthly', '2026-09'), (?, 'monthly', '2026-10')").bind(user, user).run();
    await env.DB.prepare("UPDATE statistics_report SET is_dirty = 0 WHERE user_id = ?").bind(user).run();
    await env.DB.prepare('UPDATE "transaction" SET date = \'2026-09-15\' WHERE user_id = ? AND date = \'2026-10-01\'').bind(user).run();
    const changed = await env.DB.prepare("SELECT is_dirty FROM statistics_report WHERE user_id = ? ORDER BY period_key").bind(user).all<{ is_dirty: number }>();
    expect(changed.results.map(r => r.is_dirty)).toEqual([1, 1]);
    await env.DB.prepare("UPDATE statistics_report SET is_dirty = 0 WHERE user_id = ?").bind(user).run();
    await env.DB.prepare("UPDATE credit_card_statement SET status = 'unpaid', paid_at = NULL WHERE id = 'statistics-statement'").run();
    expect((await env.DB.prepare("SELECT is_dirty FROM statistics_report WHERE user_id = ?").bind(user).all<{ is_dirty: number }>()).results.every(r => r.is_dirty === 1)).toBe(true);
  });
});
