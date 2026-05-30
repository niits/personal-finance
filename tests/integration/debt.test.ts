/**
 * Schema-level integration tests for the debt model AFTER migration 0013
 * (`0013_debt_model_revision.sql`).
 *
 * The transaction-centric model dropped `debt.amount` and added
 * `opening_transaction_id` + `due_date`. These tests talk to `env.DB` directly
 * (no route handlers) and so verify the live schema and its constraints.
 *
 * Cases trace to docs/specs/debt-tracking-tests.md §4.1 (INT-SCHEMA-*).
 */
import { describe, it, expect, beforeAll } from "vitest";
import { env } from "cloudflare:test";
import { applyMigrations, seedUser } from "./helpers";

beforeAll(async () => {
  await applyMigrations();
  await seedUser();
});

describe("INT-SCHEMA: debt table (post-0013)", () => {
  it("INT-SCHEMA-1: the debt table exists", async () => {
    const res = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='debt'",
    ).first<{ name: string }>();
    expect(res?.name).toBe("debt");
  });

  it("INT-SCHEMA-2: columns match the new model and `amount` is gone", async () => {
    const rows = await env.DB.prepare("PRAGMA table_info(debt)").all<{ name: string }>();
    const cols = rows.results.map((r) => r.name);
    expect(cols).toEqual(
      expect.arrayContaining([
        "id",
        "user_id",
        "type",
        "party",
        "note",
        "due_date",
        "status",
        "opening_transaction_id",
        "created_at",
      ]),
    );
    expect(cols).not.toContain("amount");
  });

  it("INT-SCHEMA-3: CHECK rejects an invalid type", async () => {
    await expect(
      env.DB.prepare(
        "INSERT INTO debt (id, user_id, type, party) VALUES ('d-bad-type', 'user-test-1', 'invalid', 'Minh')",
      ).run(),
    ).rejects.toThrow();
  });

  it("INT-SCHEMA-4: status defaults to 'open' and rejects invalid values", async () => {
    await env.DB.prepare(
      "INSERT INTO debt (id, user_id, type, party) VALUES ('d-default', 'user-test-1', 'lend', 'Minh')",
    ).run();
    const row = await env.DB.prepare(
      "SELECT status FROM debt WHERE id='d-default'",
    ).first<{ status: string }>();
    expect(row?.status).toBe("open");

    await expect(
      env.DB.prepare(
        "INSERT INTO debt (id, user_id, type, party, status) VALUES ('d-bad-status', 'user-test-1', 'lend', 'Minh', 'pending')",
      ).run(),
    ).rejects.toThrow();
  });

  it("INT-SCHEMA-5: deleting the opening tx nulls opening_transaction_id (D-19, FK SET NULL)", async () => {
    // debt → opening tx → link back
    await env.DB.prepare(
      "INSERT INTO debt (id, user_id, type, party) VALUES ('d-fk', 'user-test-1', 'lend', 'Hùng')",
    ).run();
    const tx = await env.DB.prepare(
      `INSERT INTO "transaction" (user_id, amount, type, date, debt_id)
       VALUES ('user-test-1', 500000, 'expense', '2026-05-01', 'd-fk') RETURNING id`,
    ).first<{ id: number }>();
    await env.DB.prepare(
      "UPDATE debt SET opening_transaction_id = ? WHERE id = 'd-fk'",
    ).bind(tx!.id).run();

    await env.DB.prepare(`DELETE FROM "transaction" WHERE id = ?`).bind(tx!.id).run();

    const debt = await env.DB.prepare(
      "SELECT opening_transaction_id FROM debt WHERE id='d-fk'",
    ).first<{ opening_transaction_id: number | null }>();
    expect(debt?.opening_transaction_id).toBeNull();
  });

  it("INT-SCHEMA-6: deleting a debt nulls debt_id on its income transactions (D-18, FK SET NULL)", async () => {
    // A borrow debt's transactions are income, which the CHECK allows with no
    // budget — so SET NULL leaves them valid.
    await env.DB.prepare(
      "INSERT INTO debt (id, user_id, type, party) VALUES ('d-del', 'user-test-1', 'borrow', 'Lan')",
    ).run();
    const tx = await env.DB.prepare(
      `INSERT INTO "transaction" (user_id, amount, type, date, debt_id)
       VALUES ('user-test-1', 700000, 'income', '2026-05-02', 'd-del') RETURNING id`,
    ).first<{ id: number }>();

    await env.DB.prepare("DELETE FROM debt WHERE id='d-del'").run();

    const row = await env.DB.prepare(
      `SELECT debt_id FROM "transaction" WHERE id = ?`,
    ).bind(tx!.id).first<{ debt_id: string | null }>();
    expect(row?.debt_id).toBeNull();
  });

  // KNOWN DEFECT (D-18 vs migration 0012 CHECK): a `lend` debt's opening
  // transaction is an unbudgeted EXPENSE. `ON DELETE SET NULL` then leaves an
  // expense with neither budget nor debt, which violates the transaction CHECK
  // and aborts the delete. So deleting a lend debt currently throws instead of
  // succeeding. Documented here so the constraint interaction is not silently
  // lost; the fix (e.g. cascade-delete debt expenses, or relax the CHECK) is a
  // production change tracked separately.
  it("INT-SCHEMA-6b: deleting a lend debt with an unbudgeted opening expense violates the CHECK (known defect)", async () => {
    await env.DB.prepare(
      "INSERT INTO debt (id, user_id, type, party) VALUES ('d-del-lend', 'user-test-1', 'lend', 'Lan2')",
    ).run();
    await env.DB.prepare(
      `INSERT INTO "transaction" (user_id, amount, type, date, debt_id)
       VALUES ('user-test-1', 700000, 'expense', '2026-05-02', 'd-del-lend')`,
    ).run();

    await expect(
      env.DB.prepare("DELETE FROM debt WHERE id='d-del-lend'").run(),
    ).rejects.toThrow(/CHECK constraint failed/);
  });
});

describe("INT-SCHEMA: transaction CHECK constraint (migration 0012)", () => {
  it("INT-SCHEMA-7a: accepts an expense linked to a debt with no budget/category", async () => {
    await env.DB.prepare(
      "INSERT INTO debt (id, user_id, type, party) VALUES ('d-check', 'user-test-1', 'lend', 'Bình')",
    ).run();
    await expect(
      env.DB.prepare(
        `INSERT INTO "transaction" (user_id, amount, type, date, debt_id)
         VALUES ('user-test-1', 300000, 'expense', '2026-05-03', 'd-check')`,
      ).run(),
    ).resolves.toBeTruthy();
  });

  it("INT-SCHEMA-7b: rejects an expense with neither a budget nor a debt", async () => {
    await expect(
      env.DB.prepare(
        `INSERT INTO "transaction" (user_id, amount, type, date)
         VALUES ('user-test-1', 300000, 'expense', '2026-05-03')`,
      ).run(),
    ).rejects.toThrow();
  });

  it("INT-SCHEMA-7c: income needs neither budget nor debt", async () => {
    await expect(
      env.DB.prepare(
        `INSERT INTO "transaction" (user_id, amount, type, date)
         VALUES ('user-test-1', 300000, 'income', '2026-05-03')`,
      ).run(),
    ).resolves.toBeTruthy();
  });
});
