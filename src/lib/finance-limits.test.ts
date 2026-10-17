import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { financeAmountLimit, exceedsFinanceBalance } from "./finance-limits";
import { withFinanceLimit } from "./finance-limit-response";

const migration = readFileSync(new URL("../../migrations/0022_finance_balance_limits.sql", import.meta.url), "utf8");
const scenarios = [
  { type: "savings", debt_direction: null, opening: "expense", reduction: "income", balance: -1500000 },
  { type: "debt", debt_direction: "lend", opening: "expense", reduction: "income", balance: -1500000 },
  { type: "debt", debt_direction: "borrow", opening: "income", reduction: "expense", balance: 1500000 },
] as const;

function createDatabase(installGuards = true) {
  const db = new Database(":memory:");
  db.exec(`CREATE TABLE finance_account (id TEXT PRIMARY KEY, user_id TEXT, type TEXT, debt_direction TEXT);
    CREATE TABLE "transaction" (id INTEGER PRIMARY KEY, user_id TEXT, finance_account_id TEXT, type TEXT, amount INTEGER, note TEXT);`);
  if (installGuards) db.exec(migration);
  return db;
}

// Contract: docs/product/behavior/transactions.md, Debt And Savings Movements.
describe.each(scenarios)("Finance ceilings for $type $debt_direction", (scenario) => {
  it("uses the remaining account balance and excludes an edited reduction", () => {
    expect(financeAmountLimit(scenario, scenario.reduction)).toBe(1500000);
    expect(financeAmountLimit(scenario, scenario.reduction, { type: scenario.reduction, amount: 500000 })).toBe(2000000);
    expect(financeAmountLimit(scenario, scenario.opening)).toBeNull();
    expect(exceedsFinanceBalance(scenario, undefined, { type: scenario.reduction, amount: 1500000 })).toBe(false);
    expect(exceedsFinanceBalance(scenario, undefined, { type: scenario.reduction, amount: 1500001 })).toBe(true);
    expect(exceedsFinanceBalance(scenario, { type: scenario.opening, amount: 2000000 }, { type: scenario.opening, amount: 499999 })).toBe(true);
  });

  it("atomically rejects excessive creation, edits, deletion, and source reassignment", () => {
    const db = createDatabase();
    try {
      db.prepare("INSERT INTO finance_account VALUES ('source', 'owner', ?, ?), ('destination', 'owner', ?, ?)")
        .run(scenario.type, scenario.debt_direction, scenario.type, scenario.debt_direction);
      const insert = db.prepare('INSERT INTO "transaction" (id,user_id,finance_account_id,type,amount) VALUES (?,\'owner\',\'source\',?,?)');
      insert.run(1, scenario.opening, 2000000);
      insert.run(2, scenario.opening, 500000);
      insert.run(3, scenario.reduction, 1000000);
      expect(() => insert.run(4, scenario.reduction, 1500001)).toThrow("FINANCE_BALANCE_EXCEEDED");
      expect(() => db.prepare('UPDATE "transaction" SET amount=2500001 WHERE id=3').run()).toThrow("FINANCE_BALANCE_EXCEEDED");
      expect(() => db.prepare('UPDATE "transaction" SET amount=499999 WHERE id=1').run()).toThrow("FINANCE_BALANCE_EXCEEDED");
      expect(() => db.prepare('UPDATE "transaction" SET finance_account_id=\'destination\' WHERE id=1').run()).toThrow("FINANCE_BALANCE_EXCEEDED");
      expect(() => db.prepare('UPDATE "transaction" SET finance_account_id=\'destination\' WHERE id=3').run()).toThrow("FINANCE_BALANCE_EXCEEDED");
      expect(() => db.prepare('DELETE FROM "transaction" WHERE id=1').run()).toThrow("FINANCE_BALANCE_EXCEEDED");
      expect(() => db.prepare('UPDATE "transaction" SET type=? WHERE id=1').run(scenario.reduction)).toThrow("FINANCE_BALANCE_EXCEEDED");
      expect(db.prepare('SELECT amount, finance_account_id FROM "transaction" WHERE id=1').get()).toEqual({amount:2000000,finance_account_id:"source"});
      expect(db.prepare('SELECT amount FROM "transaction" WHERE id=3').get()).toEqual({amount:1000000});
      insert.run(4, scenario.reduction, 1500000);
      expect(() => insert.run(5, scenario.reduction, 1)).toThrow("FINANCE_BALANCE_EXCEEDED");
      db.prepare('UPDATE "transaction" SET amount=900000 WHERE id=3').run();
      insert.run(5, scenario.reduction, 100000);
      expect(db.prepare('SELECT COUNT(*) AS count FROM "transaction"').get()).toEqual({count:5});
    } finally { db.close(); }
  });
});

it("keeps balances separate across accounts and owners", () => {
  const db = createDatabase();
  try {
    db.exec("INSERT INTO finance_account VALUES ('a','owner','savings',NULL),('b','owner','savings',NULL),('c','other','savings',NULL)");
    db.exec(`INSERT INTO "transaction" VALUES (1,'owner','a','expense',100,NULL),(2,'other','c','expense',1000,NULL)`);
    expect(() => db.exec(`INSERT INTO "transaction" VALUES (3,'owner','b','income',1,NULL)`)).toThrow("FINANCE_BALANCE_EXCEEDED");
    expect(() => db.exec(`INSERT INTO "transaction" VALUES (3,'owner','a','income',101,NULL)`)).toThrow("FINANCE_BALANCE_EXCEEDED");
    db.exec(`INSERT INTO "transaction" VALUES (4,'other','a','expense',1000,NULL)`);
    expect(() => db.exec(`INSERT INTO "transaction" VALUES (3,'owner','a','income',101,NULL)`)).toThrow("FINANCE_BALANCE_EXCEEDED");
  } finally { db.close(); }
});

it("preserves legacy reverse balances while allowing corrections without further overdraw", () => {
  const db = createDatabase(false);
  try {
    db.exec(`INSERT INTO finance_account VALUES ('a','owner','savings',NULL);
      INSERT INTO "transaction" VALUES (1,'owner','a','income',500,NULL);`);
    db.exec(migration);
    expect(financeAmountLimit({ type: "savings", debt_direction: null, balance: 500 }, "income", { type: "income", amount: 500 })).toBe(500);
    db.exec(`INSERT INTO "transaction" VALUES (2,'owner','a','expense',100,NULL); UPDATE "transaction" SET note='Correction' WHERE id=1;`);
    expect(() => db.exec(`INSERT INTO "transaction" VALUES (3,'owner','a','income',1,NULL)`)).toThrow("FINANCE_BALANCE_EXCEEDED");
    db.exec('UPDATE "transaction" SET amount=100 WHERE id=1');
    expect(() => db.exec('UPDATE "transaction" SET amount=101 WHERE id=1')).toThrow("FINANCE_BALANCE_EXCEEDED");
  } finally { db.close(); }
});

it("rolls back earlier writes in the same transaction when a ceiling is rejected", () => {
  const db = createDatabase();
  try {
    db.exec(`INSERT INTO finance_account VALUES ('a','owner','savings',NULL); INSERT INTO "transaction" VALUES (1,'owner','a','expense',100,NULL);`);
    const mutate = db.transaction(() => {
      db.exec(`UPDATE "transaction" SET note='Changed' WHERE id=1; INSERT INTO "transaction" VALUES (2,'owner','a','income',101,NULL);`);
    });
    expect(mutate).toThrow("FINANCE_BALANCE_EXCEEDED");
    expect(db.prepare('SELECT note FROM "transaction" WHERE id=1').get()).toEqual({note:null});
  } finally { db.close(); }
});

it("returns an actionable 422 for a nested database ceiling error", async () => {
  const response = await withFinanceLimit(async () => { throw new Error("Database failure", {cause:new Error("D1_ERROR: FINANCE_BALANCE_EXCEEDED")}); });
  expect(response.status).toBe(422);
  expect(await response.json()).toMatchObject({code:"FINANCE_BALANCE_EXCEEDED"});
  const unrelated = new Error("Unrelated failure");
  await expect(withFinanceLimit(async () => { throw unrelated; })).rejects.toBe(unrelated);
});
