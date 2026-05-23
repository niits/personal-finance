import { describe, it, expect, beforeAll } from "vitest";
import { SELF } from "cloudflare:test";
import { applyMigrations, seedUser, createTestSession, authHeaders } from "./helpers";

let cookie: string;
let userId: string;

beforeAll(async () => {
  await applyMigrations();
  userId = await seedUser();
  cookie = await createTestSession(userId);
});

// ─── auth guard ───────────────────────────────────────────────────────────────

describe("GET /api/debts", () => {
  it("returns 401 without auth", async () => {
    const res = await SELF.fetch("http://localhost/api/debts");
    expect(res.status).toBe(401);
  });

  it("returns empty lists when no debts exist", async () => {
    const res = await SELF.fetch("http://localhost/api/debts", { headers: authHeaders(cookie) });
    expect(res.status).toBe(200);
    const body = await res.json() as { lending: unknown[]; borrowing: unknown[]; settled: unknown[] };
    expect(body.lending).toEqual([]);
    expect(body.borrowing).toEqual([]);
    expect(body.settled).toEqual([]);
  });
});

describe("POST /api/debts", () => {
  it("returns 401 without auth", async () => {
    const res = await SELF.fetch("http://localhost/api/debts", { method: "POST", body: "{}" });
    expect(res.status).toBe(401);
  });

  it("rejects missing party", async () => {
    const res = await SELF.fetch("http://localhost/api/debts", {
      method: "POST",
      headers: { ...authHeaders(cookie), "Content-Type": "application/json" },
      body: JSON.stringify({ type: "lend", amount: 100000 }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects invalid type", async () => {
    const res = await SELF.fetch("http://localhost/api/debts", {
      method: "POST",
      headers: { ...authHeaders(cookie), "Content-Type": "application/json" },
      body: JSON.stringify({ type: "give", party: "Minh", amount: 100000 }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects zero amount", async () => {
    const res = await SELF.fetch("http://localhost/api/debts", {
      method: "POST",
      headers: { ...authHeaders(cookie), "Content-Type": "application/json" },
      body: JSON.stringify({ type: "lend", party: "Minh", amount: 0 }),
    });
    expect(res.status).toBe(400);
  });

  it("creates a lend debt and opening transaction", async () => {
    const res = await SELF.fetch("http://localhost/api/debts", {
      method: "POST",
      headers: { ...authHeaders(cookie), "Content-Type": "application/json" },
      body: JSON.stringify({ type: "lend", party: "Minh", amount: 500000, date: "2026-05-01" }),
    });
    expect(res.status).toBe(201);
    const { debt } = await res.json() as { debt: { type: string; party: string; amount: number; remaining: number; repaid: number; status: string } };
    expect(debt.type).toBe("lend");
    expect(debt.party).toBe("Minh");
    expect(debt.amount).toBe(500000);
    expect(debt.remaining).toBe(500000);
    expect(debt.repaid).toBe(0);
    expect(debt.status).toBe("open");
  });

  it("creates a borrow debt", async () => {
    const res = await SELF.fetch("http://localhost/api/debts", {
      method: "POST",
      headers: { ...authHeaders(cookie), "Content-Type": "application/json" },
      body: JSON.stringify({ type: "borrow", party: "Chị Lan", amount: 1000000, date: "2026-05-10" }),
    });
    expect(res.status).toBe(201);
    const { debt } = await res.json() as { debt: { type: string; status: string } };
    expect(debt.type).toBe("borrow");
    expect(debt.status).toBe("open");
  });
});

describe("GET /api/debts — listing after creation", () => {
  it("returns lend debts in lending array and borrow in borrowing array", async () => {
    const res = await SELF.fetch("http://localhost/api/debts", { headers: authHeaders(cookie) });
    const body = await res.json() as { lending: { party: string }[]; borrowing: { party: string }[] };
    expect(body.lending.some((d) => d.party === "Minh")).toBe(true);
    expect(body.borrowing.some((d) => d.party === "Chị Lan")).toBe(true);
  });
});

describe("POST /api/debts/[id]/repayments", () => {
  let debtId: string;

  beforeAll(async () => {
    const res = await SELF.fetch("http://localhost/api/debts", {
      method: "POST",
      headers: { ...authHeaders(cookie), "Content-Type": "application/json" },
      body: JSON.stringify({ type: "lend", party: "Hùng", amount: 1000000, date: "2026-05-01" }),
    });
    const { debt } = await res.json() as { debt: { id: string } };
    debtId = debt.id;
  });

  it("returns 401 without auth", async () => {
    const res = await SELF.fetch(`http://localhost/api/debts/${debtId}/repayments`, { method: "POST", body: "{}" });
    expect(res.status).toBe(401);
  });

  it("rejects zero amount", async () => {
    const res = await SELF.fetch(`http://localhost/api/debts/${debtId}/repayments`, {
      method: "POST",
      headers: { ...authHeaders(cookie), "Content-Type": "application/json" },
      body: JSON.stringify({ amount: 0 }),
    });
    expect(res.status).toBe(400);
  });

  it("logs a partial repayment and updates remaining", async () => {
    const res = await SELF.fetch(`http://localhost/api/debts/${debtId}/repayments`, {
      method: "POST",
      headers: { ...authHeaders(cookie), "Content-Type": "application/json" },
      body: JSON.stringify({ amount: 400000, date: "2026-05-15", note: "Trả một phần" }),
    });
    expect(res.status).toBe(201);
    const { debt } = await res.json() as { debt: { repaid: number; remaining: number; status: string; repayments: unknown[] } };
    expect(debt.repaid).toBe(400000);
    expect(debt.remaining).toBe(600000);
    expect(debt.status).toBe("open");
    expect(debt.repayments).toHaveLength(1);
  });

  it("auto-settles when fully repaid", async () => {
    await SELF.fetch(`http://localhost/api/debts/${debtId}/repayments`, {
      method: "POST",
      headers: { ...authHeaders(cookie), "Content-Type": "application/json" },
      body: JSON.stringify({ amount: 600000, date: "2026-05-20" }),
    });

    const res = await SELF.fetch(`http://localhost/api/debts/${debtId}`, { headers: authHeaders(cookie) });
    const { debt } = await res.json() as { debt: { status: string; remaining: number } };
    expect(debt.status).toBe("settled");
    expect(debt.remaining).toBe(0);
  });

  it("rejects repayment on a settled debt", async () => {
    const res = await SELF.fetch(`http://localhost/api/debts/${debtId}/repayments`, {
      method: "POST",
      headers: { ...authHeaders(cookie), "Content-Type": "application/json" },
      body: JSON.stringify({ amount: 100000 }),
    });
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/debts/[id]", () => {
  let debtId: string;

  beforeAll(async () => {
    const res = await SELF.fetch("http://localhost/api/debts", {
      method: "POST",
      headers: { ...authHeaders(cookie), "Content-Type": "application/json" },
      body: JSON.stringify({ type: "borrow", party: "Anh Tuấn", amount: 300000 }),
    });
    const { debt } = await res.json() as { debt: { id: string } };
    debtId = debt.id;
  });

  it("updates party name", async () => {
    const res = await SELF.fetch(`http://localhost/api/debts/${debtId}`, {
      method: "PATCH",
      headers: { ...authHeaders(cookie), "Content-Type": "application/json" },
      body: JSON.stringify({ party: "Anh Tuấn Béo" }),
    });
    expect(res.status).toBe(200);
    const { debt } = await res.json() as { debt: { party: string } };
    expect(debt.party).toBe("Anh Tuấn Béo");
  });

  it("returns 404 for unknown debt", async () => {
    const res = await SELF.fetch("http://localhost/api/debts/no-such-id", {
      method: "PATCH",
      headers: { ...authHeaders(cookie), "Content-Type": "application/json" },
      body: JSON.stringify({ party: "X" }),
    });
    expect(res.status).toBe(404);
  });
});
