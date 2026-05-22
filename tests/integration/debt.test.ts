import { describe, it, expect, beforeAll } from "vitest";
import { env } from "cloudflare:test";
import { applyMigrations, seedUser, seedCategory } from "./helpers";

let categoryId: number;

beforeAll(async () => {
  await applyMigrations();
  await seedUser();
  categoryId = await seedCategory("user-test-1", "Test income", null, 1);

  // Seed a debt used by FK tests
  await env.DB.prepare(
    "INSERT INTO debt (id, user_id, type, party, amount) VALUES ('d-fixture', 'user-test-1', 'lend', 'Minh', 500000)"
  ).run();
});

describe("Migration 0011 — debt table", () => {
  it("creates the debt table", async () => {
    const res = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='debt'"
    ).first<{ name: string }>();
    expect(res?.name).toBe("debt");
  });

  it("has expected columns", async () => {
    const rows = await env.DB.prepare("PRAGMA table_info(debt)").all<{ name: string }>();
    const cols = rows.results.map((r) => r.name);
    expect(cols).toEqual(
      expect.arrayContaining(["id", "user_id", "type", "party", "amount", "note", "status", "created_at"])
    );
  });

  it("rejects invalid type values", async () => {
    await expect(
      env.DB.prepare(
        "INSERT INTO debt (id, user_id, type, party, amount) VALUES ('d-bad-type', 'user-test-1', 'invalid', 'Minh', 1000)"
      ).run()
    ).rejects.toThrow();
  });

  it("rejects amount <= 0", async () => {
    await expect(
      env.DB.prepare(
        "INSERT INTO debt (id, user_id, type, party, amount) VALUES ('d-bad-amt', 'user-test-1', 'lend', 'Minh', 0)"
      ).run()
    ).rejects.toThrow();
  });

  it("defaults status to 'open'", async () => {
    const row = await env.DB.prepare(
      "SELECT status FROM debt WHERE id='d-fixture'"
    ).first<{ status: string }>();
    expect(row?.status).toBe("open");
  });

  it("rejects invalid status values", async () => {
    await expect(
      env.DB.prepare(
        "INSERT INTO debt (id, user_id, type, party, amount, status) VALUES ('d-bad-status', 'user-test-1', 'lend', 'Minh', 1000, 'pending')"
      ).run()
    ).rejects.toThrow();
  });
});

describe("Migration 0011 — transaction.debt_id column", () => {
  it("transaction table has debt_id column", async () => {
    const rows = await env.DB.prepare("PRAGMA table_info('transaction')").all<{ name: string }>();
    const cols = rows.results.map((r) => r.name);
    expect(cols).toContain("debt_id");
  });

  it("debt_id defaults to NULL", async () => {
    await env.DB.prepare(
      `INSERT INTO "transaction" (user_id, amount, type, category_id, date)
       VALUES ('user-test-1', 100000, 'income', ?, '2026-05-22')`
    ).bind(categoryId).run();

    const tx = await env.DB.prepare(
      `SELECT debt_id FROM "transaction" WHERE user_id='user-test-1' ORDER BY id DESC LIMIT 1`
    ).first<{ debt_id: string | null }>();
    expect(tx?.debt_id).toBeNull();
  });

  it("accepts a valid debt_id FK reference", async () => {
    await env.DB.prepare(
      `INSERT INTO "transaction" (user_id, amount, type, category_id, date, debt_id)
       VALUES ('user-test-1', 500000, 'income', ?, '2026-05-22', 'd-fixture')`
    ).bind(categoryId).run();

    const tx = await env.DB.prepare(
      `SELECT debt_id FROM "transaction" WHERE debt_id='d-fixture' LIMIT 1`
    ).first<{ debt_id: string }>();
    expect(tx?.debt_id).toBe("d-fixture");
  });
});
