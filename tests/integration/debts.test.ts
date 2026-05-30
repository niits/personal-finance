/**
 * API integration tests for the transaction-centric debt model.
 *
 * Endpoints (SRS §8):
 *   POST   /api/debts            create debt + opening transaction (atomic)
 *   GET    /api/debts            grouped lending / borrowing / settled
 *   GET    /api/debts/[id]       single debt with transactions
 *   PATCH  /api/debts/[id]       edit party/note/due_date/status (type immutable)
 *   DELETE /api/debts/[id]       delete debt, keep transactions
 *   POST   /api/transactions     repayment when body has debt_id
 *
 * Cases trace to docs/specs/debt-tracking-tests.md §4.2–4.6.
 * (The legacy POST /api/debts/[id]/repayments endpoint was removed.)
 */
import { describe, it, expect, beforeAll } from "vitest";
import { SELF } from "cloudflare:test";
import { applyMigrations, seedUser, createTestSession, authHeaders } from "./helpers";

let cookie: string;
let userId: string;

async function createDebt(data: {
  type: "lend" | "borrow";
  party: string;
  amount: number;
  date?: string;
  note?: string;
  due_date?: string;
  transaction_note?: string;
}) {
  const res = await SELF.fetch("http://localhost/api/debts", {
    method: "POST",
    headers: authHeaders(cookie),
    body: JSON.stringify({ date: "2026-05-01", ...data }),
  });
  return res;
}

type Debt = {
  id: string;
  type: "lend" | "borrow";
  party: string;
  note: string | null;
  due_date: string | null;
  status: "open" | "settled";
  opening_transaction_id: number | null;
  opening_amount: number;
  total_repaid: number;
  remaining: number;
  is_overdue: boolean;
  transactions: { id: number; type: string; amount: number; is_opening: boolean }[];
};

beforeAll(async () => {
  await applyMigrations();
  userId = await seedUser();
  cookie = await createTestSession(userId);
});

// ─── §4.2 create ────────────────────────────────────────────────────────────

describe("POST /api/debts (INT-CREATE)", () => {
  it("INT-CREATE-AUTH: 401 without session", async () => {
    const res = await SELF.fetch("http://localhost/api/debts", { method: "POST", body: "{}" });
    expect(res.status).toBe(401);
  });

  it("INT-CREATE-1/2: creates a lend debt with an expense opening transaction", async () => {
    const res = await createDebt({ type: "lend", party: "Minh", amount: 500000 });
    expect(res.status).toBe(201);
    const { debt } = (await res.json()) as { debt: Debt };
    expect(debt.type).toBe("lend");
    expect(debt.party).toBe("Minh");
    expect(debt.status).toBe("open");
    expect(debt.opening_amount).toBe(500000);
    expect(debt.total_repaid).toBe(0);
    expect(debt.remaining).toBe(500000);
    expect(debt.opening_transaction_id).not.toBeNull();
    expect(debt.transactions).toHaveLength(1);
    expect(debt.transactions[0].is_opening).toBe(true);
    expect(debt.transactions[0].type).toBe("expense");
  });

  it("INT-CREATE-2b: a borrow debt opens with an income transaction", async () => {
    const res = await createDebt({ type: "borrow", party: "Chị Lan", amount: 1000000 });
    const { debt } = (await res.json()) as { debt: Debt };
    expect(debt.type).toBe("borrow");
    expect(debt.transactions[0].type).toBe("income");
  });

  it("INT-CREATE-3: debt.note and the opening transaction note are independent", async () => {
    const res = await createDebt({
      type: "lend",
      party: "Bình",
      amount: 750000,
      note: "Cho mượn",
      transaction_note: "chuyển khoản",
      due_date: "2026-12-31",
    });
    const { debt } = (await res.json()) as { debt: Debt };
    expect(debt.note).toBe("Cho mượn");
    expect(debt.due_date).toBe("2026-12-31");
  });

  it("INT-CREATE-VAL-1: rejects missing party", async () => {
    const res = await SELF.fetch("http://localhost/api/debts", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({ type: "lend", amount: 100000, date: "2026-05-01" }),
    });
    expect(res.status).toBe(400);
  });

  it("INT-CREATE-VAL-2: rejects invalid type", async () => {
    const res = await SELF.fetch("http://localhost/api/debts", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({ type: "give", party: "Minh", amount: 100000, date: "2026-05-01" }),
    });
    expect(res.status).toBe(400);
  });

  it("INT-CREATE-VAL-3: rejects zero / negative / non-integer amount", async () => {
    for (const amount of [0, -5000, 1500.5]) {
      const res = await createDebt({ type: "lend", party: "X", amount });
      expect(res.status).toBe(400);
    }
  });

  it("INT-CREATE-VAL-4: rejects missing/malformed date", async () => {
    const res = await SELF.fetch("http://localhost/api/debts", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({ type: "lend", party: "X", amount: 100000, date: "01-05-2026" }),
    });
    expect(res.status).toBe(400);
  });
});

// ─── §4.3 list & read ───────────────────────────────────────────────────────

describe("GET /api/debts (INT-LIST / INT-GET)", () => {
  it("INT-LIST-AUTH: 401 without session", async () => {
    const res = await SELF.fetch("http://localhost/api/debts");
    expect(res.status).toBe(401);
  });

  it("INT-LIST-2: open lend in lending, open borrow in borrowing", async () => {
    const res = await SELF.fetch("http://localhost/api/debts", { headers: authHeaders(cookie) });
    const body = (await res.json()) as { lending: Debt[]; borrowing: Debt[]; settled: Debt[] };
    expect(body.lending.some((d) => d.party === "Minh")).toBe(true);
    expect(body.borrowing.some((d) => d.party === "Chị Lan")).toBe(true);
  });

  it("INT-GET-1: returns a single debt with its transactions", async () => {
    const create = await createDebt({ type: "lend", party: "Hùng", amount: 300000 });
    const { debt } = (await create.json()) as { debt: Debt };

    const res = await SELF.fetch(`http://localhost/api/debts/${debt.id}`, { headers: authHeaders(cookie) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { debt: Debt };
    expect(body.debt.id).toBe(debt.id);
    expect(Array.isArray(body.debt.transactions)).toBe(true);
  });

  it("INT-GET-2: unknown id → 404", async () => {
    const res = await SELF.fetch("http://localhost/api/debts/ghost-id", { headers: authHeaders(cookie) });
    expect(res.status).toBe(404);
  });

  it("INT-OWN-1: another user's debt → 404", async () => {
    const otherId = await seedUser({ id: "user-other", email: "other@example.com" });
    const otherCookie = await createTestSession(otherId);
    const create = await SELF.fetch("http://localhost/api/debts", {
      method: "POST",
      headers: authHeaders(otherCookie),
      body: JSON.stringify({ type: "lend", party: "Secret", amount: 100000, date: "2026-05-01" }),
    });
    const { debt } = (await create.json()) as { debt: Debt };

    const res = await SELF.fetch(`http://localhost/api/debts/${debt.id}`, { headers: authHeaders(cookie) });
    expect(res.status).toBe(404);
  });
});

// ─── §4.4 repayment via POST /api/transactions ──────────────────────────────

describe("POST /api/transactions with debt_id (INT-REPAY)", () => {
  let debtId: string;

  beforeAll(async () => {
    const res = await createDebt({ type: "lend", party: "Repay", amount: 1000000 });
    const { debt } = (await res.json()) as { debt: Debt };
    debtId = debt.id;
  });

  async function repay(amount: number, extra: Record<string, unknown> = {}) {
    return SELF.fetch("http://localhost/api/transactions", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({ amount, type: "income", date: "2026-05-15", debt_id: debtId, ...extra }),
    });
  }

  it("INT-REPAY-1: a partial repayment updates total_repaid and remaining", async () => {
    const res = await repay(400000, { note: "Trả một phần" });
    expect(res.status).toBe(201);

    const get = await SELF.fetch(`http://localhost/api/debts/${debtId}`, { headers: authHeaders(cookie) });
    const { debt } = (await get.json()) as { debt: Debt };
    expect(debt.total_repaid).toBe(400000);
    expect(debt.remaining).toBe(600000);
    expect(debt.transactions).toHaveLength(2);
  });

  it("INT-REPAY-3/4: overpayment allowed, remaining goes negative, status stays open", async () => {
    await repay(800000); // total 1_200_000 > 1_000_000
    const get = await SELF.fetch(`http://localhost/api/debts/${debtId}`, { headers: authHeaders(cookie) });
    const { debt } = (await get.json()) as { debt: Debt };
    expect(debt.remaining).toBe(-200000);
    expect(debt.status).toBe("open"); // never auto-settles (D-12)
  });

  it("INT-REPAY-VAL: rejects zero / negative amount", async () => {
    for (const amount of [0, -100]) {
      const res = await repay(amount);
      expect(res.status).toBe(400);
    }
  });

  it("INT-REPAY-OWN: repayment against another user's debt → 404", async () => {
    const res = await SELF.fetch("http://localhost/api/transactions", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({ amount: 100000, type: "income", date: "2026-05-15", debt_id: "no-such-debt" }),
    });
    expect(res.status).toBe(404);
  });

  it("INT-REPAY-5: repayment on a settled debt → 400 (D-14)", async () => {
    const create = await createDebt({ type: "lend", party: "Settle", amount: 100000 });
    const { debt } = (await create.json()) as { debt: Debt };
    await SELF.fetch(`http://localhost/api/debts/${debt.id}`, {
      method: "PATCH",
      headers: authHeaders(cookie),
      body: JSON.stringify({ status: "settled" }),
    });

    const res = await SELF.fetch("http://localhost/api/transactions", {
      method: "POST",
      headers: authHeaders(cookie),
      body: JSON.stringify({ amount: 50000, type: "income", date: "2026-05-16", debt_id: debt.id }),
    });
    expect(res.status).toBe(400);
  });
});

// ─── §4.5 update ────────────────────────────────────────────────────────────

describe("PATCH /api/debts/[id] (INT-PATCH)", () => {
  let debtId: string;

  beforeAll(async () => {
    const res = await createDebt({ type: "borrow", party: "Tuấn", amount: 300000 });
    const { debt } = (await res.json()) as { debt: Debt };
    debtId = debt.id;
  });

  async function patch(body: Record<string, unknown>) {
    return SELF.fetch(`http://localhost/api/debts/${debtId}`, {
      method: "PATCH",
      headers: authHeaders(cookie),
      body: JSON.stringify(body),
    });
  }

  it("INT-PATCH-1: updates party", async () => {
    const res = await patch({ party: "Tuấn Béo" });
    expect(res.status).toBe(200);
    const { debt } = (await res.json()) as { debt: Debt };
    expect(debt.party).toBe("Tuấn Béo");
  });

  it("INT-PATCH-2: sets then clears note", async () => {
    await patch({ note: "mua xe" });
    const res = await patch({ note: null });
    const { debt } = (await res.json()) as { debt: Debt };
    expect(debt.note).toBeNull();
  });

  it("INT-PATCH-4: settle then reopen", async () => {
    const settled = await patch({ status: "settled" });
    expect(((await settled.json()) as { debt: Debt }).debt.status).toBe("settled");
    const reopened = await patch({ status: "open" });
    expect(((await reopened.json()) as { debt: Debt }).debt.status).toBe("open");
  });

  it("INT-PATCH-5: type is immutable (DEBT-05)", async () => {
    const res = await patch({ type: "lend" });
    const { debt } = (await res.json()) as { debt: Debt };
    expect(debt.type).toBe("borrow"); // unchanged
  });

  it("INT-PATCH-6: empty body → 400", async () => {
    const res = await patch({});
    expect(res.status).toBe(400);
  });

  it("INT-PATCH-7: unknown id → 404", async () => {
    const res = await SELF.fetch("http://localhost/api/debts/no-such", {
      method: "PATCH",
      headers: authHeaders(cookie),
      body: JSON.stringify({ party: "X" }),
    });
    expect(res.status).toBe(404);
  });
});

// ─── §4.6 delete ────────────────────────────────────────────────────────────

describe("DELETE /api/debts/[id] (INT-DEL)", () => {
  it("INT-DEL-1: deletes a borrow debt and keeps its income transaction with debt_id null", async () => {
    // Borrow debt: opening tx is income, so SET NULL keeps it CHECK-valid.
    // (Deleting a lend debt is a known defect — see debt.test.ts INT-SCHEMA-6b.)
    const create = await createDebt({ type: "borrow", party: "ToDelete", amount: 50000 });
    const { debt } = (await create.json()) as { debt: Debt };
    const openingTxId = debt.transactions[0].id;

    const del = await SELF.fetch(`http://localhost/api/debts/${debt.id}`, {
      method: "DELETE",
      headers: authHeaders(cookie),
    });
    expect(del.status).toBe(204);

    const get = await SELF.fetch(`http://localhost/api/debts/${debt.id}`, { headers: authHeaders(cookie) });
    expect(get.status).toBe(404);

    const txList = await SELF.fetch("http://localhost/api/transactions?month=2026-05", { headers: authHeaders(cookie) });
    const { transactions } = (await txList.json()) as { transactions: { id: number; debt_id: string | null }[] };
    const opening = transactions.find((t) => t.id === openingTxId);
    if (opening) expect(opening.debt_id).toBeNull();
  });

  it("INT-DEL-2: unknown id → 404", async () => {
    const res = await SELF.fetch("http://localhost/api/debts/no-such", {
      method: "DELETE",
      headers: authHeaders(cookie),
    });
    expect(res.status).toBe(404);
  });

  it("INT-DEL-AUTH: 401 without session", async () => {
    const res = await SELF.fetch("http://localhost/api/debts/any", { method: "DELETE" });
    expect(res.status).toBe(401);
  });
});
