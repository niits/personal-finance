import { beforeAll, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { applyMigrations, seedUser } from "./helpers";

beforeAll(async () => { await applyMigrations(); await seedUser(); });

describe("finance account schema", () => {
  it("stores typed accounts and transaction links", async () => {
    const columns = (await env.DB.prepare("PRAGMA table_info(finance_account)").all<{ name: string }>()).results.map((row) => row.name);
    expect(columns).toEqual(expect.arrayContaining(["id", "user_id", "type", "name", "debt_direction"]));
    const transactionColumns = (await env.DB.prepare('PRAGMA table_info("transaction")').all<{ name: string }>()).results.map((row) => row.name);
    expect(transactionColumns).toEqual(expect.arrayContaining(["finance_account_id", "credit_card_group_id"]));
  });
});
