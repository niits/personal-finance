import { describe, it, expect, beforeAll } from "vitest";
import { SELF } from "cloudflare:test";
import { applyMigrations, seedUser, createTestSession, authHeaders } from "./helpers";

let cookie: string;

beforeAll(async () => {
  await applyMigrations();
  const userId = await seedUser({ id: "user-mb", email: "mb@example.com" });
  cookie = await createTestSession(userId);
});

describe("GET /api/monthly-budgets", () => {
  it("returns null when no budget exists", async () => {
    const res = await SELF.fetch("http://localhost/api/monthly-budgets?month=2030-01", {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const body = await res.json<{ monthly_budget: null }>();
    expect(body.monthly_budget).toBeNull();
  });
});

describe("POST /api/monthly-budgets", () => {
  it("creates a monthly budget", async () => {
    const res = await SELF.fetch("http://localhost/api/monthly-budgets", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({ month: "2026-07", amount: 12_000_000 }),
    });

    expect(res.status).toBe(201);
    const body = await res.json<{ monthly_budget: { month: string; amount: number; adjustments: unknown[] } }>();
    expect(body.monthly_budget.month).toBe("2026-07");
    expect(body.monthly_budget.amount).toBe(12_000_000);
    expect(body.monthly_budget.adjustments).toEqual([]);
  });

  it("returns 409 for duplicate month", async () => {
    const res = await SELF.fetch("http://localhost/api/monthly-budgets", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({ month: "2026-07", amount: 10_000_000 }),
    });
    expect(res.status).toBe(409);
  });

  it("returns 400 for amount = 0", async () => {
    const res = await SELF.fetch("http://localhost/api/monthly-budgets", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({ month: "2026-08", amount: 0 }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid month format", async () => {
    const res = await SELF.fetch("http://localhost/api/monthly-budgets", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({ month: "07-2026", amount: 5_000_000 }),
    });
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/monthly-budgets/:id", () => {
  it("adjusts budget and creates audit record", async () => {
    const createRes = await SELF.fetch("http://localhost/api/monthly-budgets", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({ month: "2026-09", amount: 10_000_000 }),
    });
    const { monthly_budget } = await createRes.json<{ monthly_budget: { id: number; amount: number } }>();

    const patchRes = await SELF.fetch(`http://localhost/api/monthly-budgets/${monthly_budget.id}`, {
      method: "PATCH",
      headers: authHeaders(cookie),
      body: JSON.stringify({ delta: 500_000, note: "Lương thưởng" }),
    });

    expect(patchRes.status).toBe(200);
    const body = await patchRes.json<{
      monthly_budget: { amount: number; adjustments: { delta: number; note: string }[] };
      adjustment: { delta: number };
    }>();
    expect(body.monthly_budget.amount).toBe(10_500_000);
    expect(body.monthly_budget.adjustments).toHaveLength(1);
    expect(body.adjustment.delta).toBe(500_000);
  });

  it("returns 400 for delta = 0", async () => {
    const createRes = await SELF.fetch("http://localhost/api/monthly-budgets", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({ month: "2026-10", amount: 10_000_000 }),
    });
    const { monthly_budget } = await createRes.json<{ monthly_budget: { id: number } }>();

    const res = await SELF.fetch(`http://localhost/api/monthly-budgets/${monthly_budget.id}`, {
      method: "PATCH",
      headers: authHeaders(cookie),
      body: JSON.stringify({ delta: 0 }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when delta would reduce amount to 0 or below", async () => {
    const createRes = await SELF.fetch("http://localhost/api/monthly-budgets", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({ month: "2026-11", amount: 5_000_000 }),
    });
    const { monthly_budget } = await createRes.json<{ monthly_budget: { id: number } }>();

    const res = await SELF.fetch(`http://localhost/api/monthly-budgets/${monthly_budget.id}`, {
      method: "PATCH",
      headers: authHeaders(cookie),
      body: JSON.stringify({ delta: -6_000_000 }),
    });
    expect(res.status).toBe(400);
  });
});
