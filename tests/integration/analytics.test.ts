import { describe, it, expect, beforeAll } from "vitest";
import { env } from "cloudflare:test";
import { Kysely } from "kysely";
import { D1Dialect } from "kysely-d1";
import type { Database } from "@/lib/schema";
import { createAnalyticsService } from "@/lib/analytics/service";
import { applyMigrations, seedUser, seedCategory, seedMonthlyBudget } from "./helpers";

// ─── Setup ────────────────────────────────────────────────────────────────────

let userId: string;
let catFood: number;
let catSalary: number;
let catTransport: number;

beforeAll(async () => {
  await applyMigrations();
  userId = await seedUser({ id: "analytics-test-user" });

  catFood      = await seedCategory(userId, "Ăn uống",   null, 1);
  catSalary    = await seedCategory(userId, "Lương",     null, 1);
  catTransport = await seedCategory(userId, "Di chuyển", null, 1);

  const budgetMay = await seedMonthlyBudget(userId, "2026-05", 10_000_000);
  const budgetApr = await seedMonthlyBudget(userId, "2026-04", 10_000_000);

  const now = Math.floor(Date.now() / 1000);
  const txns: { user_id: string; amount: number; type: string; category_id: number; note: string; date: string; monthly_budget_id: number | null }[] = [
    // May expenses
    { user_id: userId, amount: 200_000, type: "expense", category_id: catFood,      date: "2026-05-01", note: "cà phê",       monthly_budget_id: budgetMay.id },
    { user_id: userId, amount: 500_000, type: "expense", category_id: catFood,      date: "2026-05-10", note: "ăn trưa",      monthly_budget_id: budgetMay.id },
    { user_id: userId, amount: 150_000, type: "expense", category_id: catTransport, date: "2026-05-05", note: "grab",          monthly_budget_id: budgetMay.id },
    { user_id: userId, amount: 100_000, type: "expense", category_id: catTransport, date: "2026-05-20", note: "xăng",          monthly_budget_id: budgetMay.id },
    // May income
    { user_id: userId, amount: 15_000_000, type: "income", category_id: catSalary, date: "2026-05-01", note: "lương tháng 5", monthly_budget_id: null },

    // April expenses (for comparison)
    { user_id: userId, amount: 300_000, type: "expense", category_id: catFood,      date: "2026-04-15", note: "ăn tối",       monthly_budget_id: budgetApr.id },
    { user_id: userId, amount: 80_000,  type: "expense", category_id: catTransport, date: "2026-04-10", note: "grab",          monthly_budget_id: budgetApr.id },
    { user_id: userId, amount: 12_000_000, type: "income", category_id: catSalary, date: "2026-04-01", note: "lương tháng 4", monthly_budget_id: null },
  ];

  for (const t of txns) {
    await env.DB.prepare(
      `INSERT INTO "transaction" (user_id, amount, type, category_id, note, date, monthly_budget_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(t.user_id, t.amount, t.type, t.category_id, t.note, t.date, t.monthly_budget_id, now, now).run();
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeService() {
  const db = new Kysely<Database>({ dialect: new D1Dialect({ database: env.DB }) });
  return createAnalyticsService(db);
}

const MAY = { from: "2026-05-01", to: "2026-05-31" };
const APR = { from: "2026-04-01", to: "2026-04-30" };

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("AnalyticsService — queryMetric", () => {
  it("total_expense: sums only expense rows", async () => {
    const svc = makeService();
    const result = await svc.queryMetric({ userId, metric: "total_expense", ...MAY });
    // 200k + 500k + 150k + 100k = 950k
    expect(result).toEqual({ value: 950_000 });
  });

  it("total_income: sums only income rows", async () => {
    const svc = makeService();
    const result = await svc.queryMetric({ userId, metric: "total_income", ...MAY });
    expect(result).toEqual({ value: 15_000_000 });
  });

  it("net: income minus expense", async () => {
    const svc = makeService();
    const result = await svc.queryMetric({ userId, metric: "net", ...MAY });
    // 15_000_000 - 950_000 = 14_050_000
    expect(result).toEqual({ value: 14_050_000 });
  });

  it("transaction_count: counts all rows in period", async () => {
    const svc = makeService();
    const result = await svc.queryMetric({ userId, metric: "transaction_count", ...MAY });
    expect(result).toEqual({ value: 5 });
  });

  it("breakdown by category: groups and sorts desc", async () => {
    const svc = makeService();
    const rows = await svc.queryMetric({ userId, metric: "total_expense", ...MAY, breakdown: "category" });
    expect(Array.isArray(rows)).toBe(true);
    const arr = rows as { dimension: string; value: number }[];
    // Food: 700k, Transport: 250k
    expect(arr[0]).toEqual({ dimension: "Ăn uống",   value: 700_000 });
    expect(arr[1]).toEqual({ dimension: "Di chuyển", value: 250_000 });
  });

  it("breakdown by category with topN", async () => {
    const svc = makeService();
    const rows = await svc.queryMetric({ userId, metric: "total_expense", ...MAY, breakdown: "category", topN: 1 });
    expect(Array.isArray(rows)).toBe(true);
    expect((rows as any[]).length).toBe(1);
    expect((rows as any[])[0].dimension).toBe("Ăn uống");
  });

  it("breakdown by date: one row per day with activity", async () => {
    const svc = makeService();
    const rows = await svc.queryMetric({ userId, metric: "total_expense", ...MAY, breakdown: "date" }) as any[];
    const dates = rows.map((r) => r.dimension);
    expect(dates).toContain("2026-05-01");
    expect(dates).toContain("2026-05-10");
    expect(dates).toContain("2026-05-20");
  });

  it("scopes to userId — another user's data is invisible", async () => {
    const svc = makeService();
    const result = await svc.queryMetric({ userId: "other-user-xyz", metric: "total_expense", ...MAY });
    expect(result).toEqual({ value: 0 });
  });

  it("period boundary is inclusive on both ends", async () => {
    const svc = makeService();
    // Only May 1 transactions: 200k expense + 15m income
    const result = await svc.queryMetric({ userId, metric: "total_expense", from: "2026-05-01", to: "2026-05-01" });
    expect(result).toEqual({ value: 200_000 });
  });
});

describe("AnalyticsService — compareMetric", () => {
  it("total without breakdown: computes change_abs and change_pct", async () => {
    const svc = makeService();
    const rows = await svc.compareMetric({
      userId,
      metric: "total_expense",
      currentFrom: MAY.from, currentTo: MAY.to,
      previousFrom: APR.from, previousTo: APR.to,
    });
    // May: 950k, April: 380k → change_abs: +570k, change_pct: +150%
    expect(rows).toHaveLength(1);
    expect(rows[0].dimension).toBe("_total");
    expect(rows[0].current).toBe(950_000);
    expect(rows[0].previous).toBe(380_000);
    expect(rows[0].change_abs).toBe(570_000);
    expect(rows[0].change_pct).toBe(150);
  });

  it("breakdown by category: shows per-category comparison", async () => {
    const svc = makeService();
    const rows = await svc.compareMetric({
      userId,
      metric: "total_expense",
      currentFrom: MAY.from, currentTo: MAY.to,
      previousFrom: APR.from, previousTo: APR.to,
      breakdown: "category",
    });
    const food = rows.find((r) => r.dimension === "Ăn uống");
    expect(food).toBeDefined();
    // May food: 700k, April food: 300k
    expect(food!.current).toBe(700_000);
    expect(food!.previous).toBe(300_000);
    expect(food!.change_pct).toBe(133); // Math.round((400/300)*100)
  });

  it("change_pct is null when previous is zero", async () => {
    const svc = makeService();
    // Use a period with no prior data
    const rows = await svc.compareMetric({
      userId,
      metric: "total_expense",
      currentFrom: MAY.from, currentTo: MAY.to,
      previousFrom: "2020-01-01", previousTo: "2020-01-31",
    });
    expect(rows[0].change_pct).toBeNull();
  });
});

describe("AnalyticsService — getTimeSeries", () => {
  it("returns daily expense series", async () => {
    const svc = makeService();
    const series = await svc.getTimeSeries({
      userId,
      metric: "total_expense",
      ...MAY,
      granularity: "daily",
    });
    expect(Array.isArray(series)).toBe(true);
    const may1 = series.find((r) => r.date === "2026-05-01");
    expect(may1).toBeDefined();
    expect(may1!.value).toBe(200_000);
  });
});
