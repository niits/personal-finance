/**
 * Integration tests for the partial-amount debt link feature.
 *
 * A transaction can represent only a portion of its amount as a debt
 * obligation via the linked_amount field. When set, debt calculations
 * (opening_amount, total_repaid, remaining) use linked_amount instead
 * of the full transaction amount.
 *
 * Endpoints under test:
 *   POST   /api/debts                      — linked_amount on opening tx
 *   POST   /api/transactions               — linked_amount on repayment
 *   PATCH  /api/transactions/[id]          — update linked_amount
 *   PATCH  /api/transactions/[id]/link     — linked_amount when linking
 *   GET    /api/transactions               — linked_amount in response
 *   GET    /api/debts/[id]                 — remaining reflects linked_amount
 */
import { describe, it, expect, beforeAll } from "vitest";
import { SELF } from "cloudflare:test";
import {
  applyMigrations,
  seedUser,
  createTestSession,
  authHeaders,
  seedCategory,
  seedMonthlyBudget,
} from "./helpers";

let cookie: string;
let userId: string;
let categoryId: number;

type DebtTx = { id: number; amount: number; linked_amount: number | null; is_opening: boolean };
type Debt = {
  id: string;
  opening_amount: number;
  total_repaid: number;
  remaining: number;
  transactions: DebtTx[];
};

async function createDebt(opts: {
  type: "lend" | "borrow";
  party: string;
  amount: number;
  linked_amount?: number;
  date?: string;
}) {
  const res = await SELF.fetch("http://localhost/api/debts", {
    method: "POST",
    headers: authHeaders(cookie),
    body: JSON.stringify({ date: "2026-05-01", ...opts }),
  });
  expect(res.status).toBe(201);
  const { debt } = (await res.json()) as { debt: Debt };
  return debt;
}

async function createRepayment(debtId: string, opts: {
  amount: number;
  type: "income" | "expense";
  linked_amount?: number;
}) {
  const res = await SELF.fetch("http://localhost/api/transactions", {
    method: "POST",
    headers: authHeaders(cookie),
    body: JSON.stringify({ date: "2026-05-15", debt_id: debtId, ...opts }),
  });
  expect(res.status).toBe(201);
  const { transaction } = (await res.json()) as { transaction: { id: number; linked_amount: number | null } };
  return transaction;
}

/** Standalone (no debt) transaction. */
async function createStandaloneTx(type: "income" | "expense", amount: number) {
  const res = await SELF.fetch("http://localhost/api/transactions", {
    method: "POST",
    headers: authHeaders(cookie),
    body: JSON.stringify({ amount, type, date: "2026-05-10", category_id: categoryId }),
  });
  expect(res.status).toBe(201);
  const { transaction } = (await res.json()) as { transaction: { id: number } };
  return transaction.id;
}

async function getDebt(id: string) {
  const res = await SELF.fetch(`http://localhost/api/debts/${id}`, {
    headers: authHeaders(cookie),
  });
  expect(res.status).toBe(200);
  const { debt } = (await res.json()) as { debt: Debt };
  return debt;
}

beforeAll(async () => {
  await applyMigrations();
  userId = await seedUser();
  cookie = await createTestSession(userId);
  categoryId = await seedCategory(userId, "Ăn uống", null, 1);
  await seedMonthlyBudget(userId, "2026-05", 10_000_000);
});

// ─── POST /api/debts: linked_amount on opening transaction ───────────────────

describe("POST /api/debts with linked_amount (INT-LA-CREATE)", () => {
  it("INT-LA-CREATE-1: linked_amount sets opening_amount, remaining reflects it", async () => {
    // User spends 500k but only 200k is the loan amount
    const debt = await createDebt({ type: "lend", party: "Minh", amount: 500_000, linked_amount: 200_000 });

    expect(debt.opening_amount).toBe(200_000);
    expect(debt.remaining).toBe(200_000);
    expect(debt.total_repaid).toBe(0);
  });

  it("INT-LA-CREATE-2: opening transaction response includes linked_amount", async () => {
    const debt = await createDebt({ type: "lend", party: "Lan", amount: 600_000, linked_amount: 300_000 });
    const openingTx = debt.transactions.find((t) => t.is_opening)!;

    expect(openingTx.amount).toBe(600_000);
    expect(openingTx.linked_amount).toBe(300_000);
  });

  it("INT-LA-CREATE-3: omitting linked_amount → opening_amount = full transaction amount", async () => {
    const debt = await createDebt({ type: "lend", party: "Bình", amount: 400_000 });

    expect(debt.opening_amount).toBe(400_000);
    expect(debt.remaining).toBe(400_000);
    const openingTx = debt.transactions.find((t) => t.is_opening)!;
    expect(openingTx.linked_amount).toBeNull();
  });

  it("INT-LA-CREATE-4: linked_amount zero or negative → treated as null (full amount used)", async () => {
    const debt = await createDebt({ type: "lend", party: "Zero", amount: 500_000, linked_amount: 0 });

    // 0 is invalid → server ignores it → opening_amount = full amount
    expect(debt.opening_amount).toBe(500_000);
  });

  it("INT-LA-CREATE-5: borrow debt with linked_amount → remaining uses linked_amount", async () => {
    // User receives 1M but only borrowed 700k from the party
    const debt = await createDebt({ type: "borrow", party: "Chị Hoa", amount: 1_000_000, linked_amount: 700_000 });

    expect(debt.opening_amount).toBe(700_000);
    expect(debt.remaining).toBe(700_000);
  });
});

// ─── POST /api/transactions: linked_amount on repayment ─────────────────────

describe("POST /api/transactions repayment with linked_amount (INT-LA-REP)", () => {
  it("INT-LA-REP-1: repayment linked_amount reduces remaining correctly", async () => {
    const debt = await createDebt({ type: "lend", party: "RepPartial", amount: 1_000_000 });

    // User receives 500k total, but only 300k applies to this debt
    const rep = await createRepayment(debt.id, { type: "income", amount: 500_000, linked_amount: 300_000 });

    expect(rep.linked_amount).toBe(300_000);
    const updated = await getDebt(debt.id);
    expect(updated.total_repaid).toBe(300_000);
    expect(updated.remaining).toBe(700_000);
  });

  it("INT-LA-REP-2: repayment without linked_amount → full amount counts toward debt", async () => {
    const debt = await createDebt({ type: "lend", party: "RepFull", amount: 1_000_000 });

    await createRepayment(debt.id, { type: "income", amount: 400_000 });

    const updated = await getDebt(debt.id);
    expect(updated.total_repaid).toBe(400_000);
    expect(updated.remaining).toBe(600_000);
  });

  it("INT-LA-REP-3: multiple partial repayments accumulate by linked_amount", async () => {
    const debt = await createDebt({ type: "lend", party: "RepMulti", amount: 1_000_000 });

    // First repayment: 500k transaction, 200k toward debt
    await createRepayment(debt.id, { type: "income", amount: 500_000, linked_amount: 200_000 });
    // Second repayment: 400k transaction, 350k toward debt
    await createRepayment(debt.id, { type: "income", amount: 400_000, linked_amount: 350_000 });

    const updated = await getDebt(debt.id);
    expect(updated.total_repaid).toBe(550_000);      // 200k + 350k
    expect(updated.remaining).toBe(450_000);          // 1M - 550k
  });

  it("INT-LA-REP-4: mixed partial and full repayments", async () => {
    const debt = await createDebt({ type: "lend", party: "RepMixed", amount: 900_000 });

    // Full repayment
    await createRepayment(debt.id, { type: "income", amount: 300_000 });
    // Partial repayment
    await createRepayment(debt.id, { type: "income", amount: 500_000, linked_amount: 200_000 });

    const updated = await getDebt(debt.id);
    expect(updated.total_repaid).toBe(500_000);      // 300k + 200k
    expect(updated.remaining).toBe(400_000);          // 900k - 500k
  });
});

// ─── PATCH /api/transactions/[id]: updating linked_amount ───────────────────

describe("PATCH /api/transactions/[id] linked_amount (INT-LA-PATCH)", () => {
  it("INT-LA-PATCH-1: setting linked_amount on an opening tx updates opening_amount", async () => {
    const debt = await createDebt({ type: "lend", party: "PatchOpen", amount: 800_000 });
    const openingTxId = debt.transactions[0].id;

    const res = await SELF.fetch(`http://localhost/api/transactions/${openingTxId}`, {
      method: "PATCH",
      headers: authHeaders(cookie),
      body: JSON.stringify({ linked_amount: 300_000 }),
    });
    expect(res.status).toBe(200);

    const updated = await getDebt(debt.id);
    expect(updated.opening_amount).toBe(300_000);
    expect(updated.remaining).toBe(300_000);
  });

  it("INT-LA-PATCH-2: setting linked_amount on a repayment tx updates total_repaid", async () => {
    const debt = await createDebt({ type: "lend", party: "PatchRep", amount: 600_000 });
    const rep = await createRepayment(debt.id, { type: "income", amount: 400_000 });

    const res = await SELF.fetch(`http://localhost/api/transactions/${rep.id}`, {
      method: "PATCH",
      headers: authHeaders(cookie),
      body: JSON.stringify({ linked_amount: 150_000 }),
    });
    expect(res.status).toBe(200);

    const updated = await getDebt(debt.id);
    expect(updated.total_repaid).toBe(150_000);
    expect(updated.remaining).toBe(450_000);
  });

  it("INT-LA-PATCH-3: clearing linked_amount (null) reverts to full transaction amount", async () => {
    const debt = await createDebt({ type: "lend", party: "PatchClear", amount: 500_000, linked_amount: 200_000 });

    const openingTxId = debt.transactions[0].id;
    const res = await SELF.fetch(`http://localhost/api/transactions/${openingTxId}`, {
      method: "PATCH",
      headers: authHeaders(cookie),
      body: JSON.stringify({ linked_amount: null }),
    });
    expect(res.status).toBe(200);

    const updated = await getDebt(debt.id);
    expect(updated.opening_amount).toBe(500_000);  // reverts to full tx amount
  });
});

// ─── PATCH /api/transactions/[id]/link: linked_amount when linking ───────────

describe("PATCH /api/transactions/[id]/link with linked_amount (INT-LA-LINK)", () => {
  it("INT-LA-LINK-1: link with linked_amount → repayment uses linked_amount", async () => {
    const debt = await createDebt({ type: "lend", party: "LinkPartial", amount: 1_000_000 });

    // Standalone income tx of 600k; only 250k applies to debt
    const txId = await createStandaloneTx("income", 600_000);

    const res = await SELF.fetch(`http://localhost/api/transactions/${txId}/link`, {
      method: "PATCH",
      headers: authHeaders(cookie),
      body: JSON.stringify({ debt_id: debt.id, linked_amount: 250_000 }),
    });
    expect(res.status).toBe(200);

    const updated = await getDebt(debt.id);
    expect(updated.total_repaid).toBe(250_000);
    expect(updated.remaining).toBe(750_000);
  });

  it("INT-LA-LINK-2: link without linked_amount → full tx amount counts", async () => {
    const debt = await createDebt({ type: "lend", party: "LinkFull", amount: 1_000_000 });
    const txId = await createStandaloneTx("income", 400_000);

    const res = await SELF.fetch(`http://localhost/api/transactions/${txId}/link`, {
      method: "PATCH",
      headers: authHeaders(cookie),
      body: JSON.stringify({ debt_id: debt.id }),
    });
    expect(res.status).toBe(200);

    const updated = await getDebt(debt.id);
    expect(updated.total_repaid).toBe(400_000);
    expect(updated.remaining).toBe(600_000);
  });
});

// ─── GET /api/transactions: linked_amount in response ───────────────────────

describe("GET /api/transactions linked_amount field (INT-LA-GET)", () => {
  it("INT-LA-GET-1: debt transaction exposes linked_amount in list response", async () => {
    const debt = await createDebt({ type: "lend", party: "GetLinked", amount: 500_000, linked_amount: 200_000 });
    const openingTxId = debt.transactions[0].id;

    const res = await SELF.fetch("http://localhost/api/transactions?month=2026-05", {
      headers: authHeaders(cookie),
    });
    expect(res.status).toBe(200);
    const { transactions } = (await res.json()) as { transactions: { id: number; linked_amount: number | null }[] };
    const tx = transactions.find((t) => t.id === openingTxId);
    expect(tx).toBeDefined();
    expect(tx!.linked_amount).toBe(200_000);
  });

  it("INT-LA-GET-2: non-debt transaction has linked_amount null", async () => {
    const txId = await createStandaloneTx("expense", 100_000);

    const res = await SELF.fetch("http://localhost/api/transactions?month=2026-05", {
      headers: authHeaders(cookie),
    });
    const { transactions } = (await res.json()) as { transactions: { id: number; linked_amount: number | null }[] };
    const tx = transactions.find((t) => t.id === txId);
    expect(tx).toBeDefined();
    expect(tx!.linked_amount).toBeNull();
  });
});

// ─── End-to-end: partial opening + partial repayment ────────────────────────

describe("full lifecycle with partial amounts (INT-LA-E2E)", () => {
  it("INT-LA-E2E-1: partial opening + partial repayment → remaining is correct", async () => {
    // Scenario: dinner for 3 people costs 900k total.
    // User pays the bill (900k expense). Only 300k is a loan (one friend's share).
    // The friend later gives back 200k in cash, of which only 150k is repaying the debt.
    const debt = await createDebt({
      type: "lend", party: "Bạn Tùng",
      amount: 900_000,      // full dinner bill
      linked_amount: 300_000, // only 300k is the loan
    });

    expect(debt.opening_amount).toBe(300_000);
    expect(debt.remaining).toBe(300_000);

    await createRepayment(debt.id, {
      type: "income",
      amount: 200_000,       // received 200k cash
      linked_amount: 150_000, // 150k goes toward the debt
    });

    const updated = await getDebt(debt.id);
    expect(updated.opening_amount).toBe(300_000);
    expect(updated.total_repaid).toBe(150_000);
    expect(updated.remaining).toBe(150_000);
  });

  it("INT-LA-E2E-2: partial-then-full repayment can settle the debt", async () => {
    const debt = await createDebt({
      type: "lend", party: "Bạn Nam",
      amount: 800_000,
      linked_amount: 400_000,
    });

    // First: partial payment
    await createRepayment(debt.id, { type: "income", amount: 300_000, linked_amount: 250_000 });
    // Second: settle the rest exactly
    await createRepayment(debt.id, { type: "income", amount: 150_000 });

    const updated = await getDebt(debt.id);
    expect(updated.remaining).toBe(0);  // 400k - 250k - 150k = 0
  });
});
