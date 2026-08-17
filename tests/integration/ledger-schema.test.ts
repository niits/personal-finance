import { beforeAll, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { applyMigrations, seedUser } from "./helpers";

const run = (sql: string, ...bindings: unknown[]) => env.DB.prepare(sql).bind(...bindings).run();

async function expectAbort(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toThrow(code);
}

async function periodId() {
  const period = await env.DB.prepare(
    "SELECT id FROM budget_period WHERE user_id='ledger-u1' AND label='Aug'",
  ).first<{ id: number }>();
  return period!.id;
}

async function insertAllocatedExpense(prefix: string, allocation = 60) {
  const period = await periodId();
  await run(
    "INSERT INTO ledger_custom_budget (id,user_id,budget_period_id,name,amount) VALUES (?,?,?,'Envelope',300)",
    `${prefix}-envelope`,
    "ledger-u1",
    period,
  );
  await run(
    "INSERT INTO financial_event (id,user_id,write_key,kind,amount,cash_delta,expense_delta,category_id,budget_period_id,date) VALUES (?,'ledger-u1','setup','expense_cash',100,-100,100,1,?,'2026-08-10')",
    `${prefix}-expense`,
    period,
  );
  await run(
    "INSERT INTO financial_event_custom_budget_allocation VALUES (?,?,?,?)",
    `${prefix}-expense`,
    `${prefix}-envelope`,
    "ledger-u1",
    allocation,
  );
  await run(
    "INSERT INTO financial_event_commit (event_id,user_id,write_key) VALUES (?,'ledger-u1','setup')",
    `${prefix}-expense`,
  );
  return period;
}

beforeAll(async () => {
  await applyMigrations({ through: "0016_transaction_credit_card.sql" });
  await seedUser({ id: "ledger-u1", email: "ledger-u1@example.com" });
  await seedUser({ id: "ledger-u2", email: "ledger-u2@example.com" });

  await run(
    "INSERT INTO category (user_id,name,level,sort_order,type) VALUES ('ledger-u1','Food',1,0,'expense'),('ledger-u2','Other',1,0,'expense')",
  );
  await run("INSERT INTO monthly_budget (user_id,month,amount) VALUES ('ledger-u1','2026-08',1000)");
  const legacyBudget = await env.DB.prepare(
    "SELECT id FROM monthly_budget WHERE user_id='ledger-u1'",
  ).first<{ id: number }>();
  await run(
    'INSERT INTO "transaction" (user_id,amount,type,category_id,date,monthly_budget_id) VALUES (?,?,?,?,?,?)',
    "ledger-u1",
    25,
    "expense",
    1,
    "2026-08-01",
    legacyBudget!.id,
  );
  await run("INSERT INTO custom_budget (user_id,name,amount) VALUES ('ledger-u1','Legacy envelope',100)");
  await run("INSERT INTO budget_adjustment (monthly_budget_id,delta,note) VALUES (?,10,'Legacy adjustment')", legacyBudget!.id);
  await run("INSERT INTO transaction_custom_budget (transaction_id,custom_budget_id) SELECT t.id,cb.id FROM \"transaction\" t JOIN custom_budget cb ON cb.user_id=t.user_id WHERE t.user_id='ledger-u1' LIMIT 1");
  await run("INSERT INTO budget_config (user_id,default_monthly_amount) VALUES ('ledger-u1',1000)");
  await run("INSERT INTO statistics_report (user_id,period_type,period_key) VALUES ('ledger-u1','monthly','2026-08')");
  await run("INSERT INTO ai_suggestion_run (user_id,status) VALUES ('ledger-u1','pending')");
  await run("INSERT INTO debt (id,user_id,type,party,status) VALUES ('legacy-debt','ledger-u1','lend','Legacy party','open')");

  await applyMigrations({ from: "0017_single_cash_ledger.sql" });

  for (const user of ["ledger-u1", "ledger-u2"]) {
    await run(
      "INSERT INTO financial_write_request (user_id,idempotency_key,operation,request_hash,response_json) VALUES (?,?,?,?,?)",
      user,
      "setup",
      "setup",
      "hash",
      "{}",
    );
    await run(
      "INSERT INTO financial_profile (user_id,ledger_start_date,minimum_cash_reserve,legacy_data_consent_at,legacy_data_archive_state) VALUES (?,?,0,?,?)",
      user,
      "2026-08-01",
      user === "ledger-u1" ? 1 : null,
      user === "ledger-u1" ? "preserved" : "not_applicable",
    );
  }
  await run(
    "INSERT INTO budget_period (user_id,label,start_date,end_date,planned_income,savings_target,spending_limit) VALUES ('ledger-u1','Aug','2026-08-01','2026-08-31',1000,200,700)",
  );
  await run(
    "INSERT INTO financial_position (id,user_id,name,kind,reserve_against_cash) VALUES ('card-u1','ledger-u1','Card','credit_card',1),('deposit-u1','ledger-u1','Deposit','term_deposit',0),('card-u2','ledger-u2','Other card','credit_card',1)",
  );
});

describe("0017 additive upgrade", () => {
  it("preserves populated legacy rows and adds all ledger tables", async () => {
    expect(
      await env.DB.prepare('SELECT amount FROM "transaction" WHERE user_id=?')
        .bind("ledger-u1")
        .first(),
    ).toMatchObject({ amount: 25 });

    const names = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'financial_%'",
    ).all<{ name: string }>();
    expect(names.results.map(({ name }) => name).sort()).toEqual([
      "financial_event",
      "financial_event_commit",
      "financial_event_custom_budget_allocation",
      "financial_position",
      "financial_position_closure",
      "financial_position_closure_reversal",
      "financial_profile",
      "financial_profile_adjustment",
      "financial_write_request",
    ]);
  });

  it("rejects cross-user composite references", async () => {
    await expectAbort(
      run(
        "INSERT INTO financial_event (id,user_id,write_key,kind,amount,position_id,position_delta,equity_delta,date) VALUES ('cross','ledger-u1','setup','opening_position',10,'card-u2',10,10,'2026-08-01')",
      ),
      "FOREIGN KEY constraint failed",
    );
  });

  it("rejects balanced but invalid event shapes and attribution", async () => {
    await expectAbort(
      run(
        "INSERT INTO financial_event (id,user_id,write_key,kind,amount,cash_delta,income_delta,date) VALUES ('bad-shape','ledger-u1','setup','expense_cash',10,10,10,'2026-08-02')",
      ),
      "CHECK constraint failed",
    );
  });

  it("rejects invalid opening, future, and expense-period dates at commit", async () => {
    await run(
      "INSERT INTO financial_event (id,user_id,write_key,kind,amount,cash_delta,equity_delta,date) VALUES ('wrong-opening-date','ledger-u1','setup','opening_cash',10,10,10,'2026-08-02')",
    );
    await expectAbort(
      run("INSERT INTO financial_event_commit (event_id,user_id,write_key,created_at) VALUES ('wrong-opening-date','ledger-u1','setup',unixepoch())"),
      "ledger_opening_date",
    );

    await run(
      "INSERT INTO financial_event (id,user_id,write_key,kind,amount,cash_delta,income_delta,category_id,date) VALUES ('future-event','ledger-u1','setup','income_cash',10,10,10,1,'9999-01-01')",
    );
    await expectAbort(
      run("INSERT INTO financial_event_commit (event_id,user_id,write_key,created_at) VALUES ('future-event','ledger-u1','setup',unixepoch())"),
      "ledger_future_event",
    );

    const period = await env.DB.prepare(
      "INSERT INTO budget_period (user_id,label,start_date,end_date,planned_income,savings_target,spending_limit) VALUES ('ledger-u2','Short','2026-08-01','2026-08-10',100,0,100) RETURNING id",
    ).first<{ id: number }>();
    await run(
      "INSERT INTO financial_event (id,user_id,write_key,kind,amount,cash_delta,expense_delta,category_id,budget_period_id,date) VALUES ('outside-period','ledger-u2','setup','expense_cash',10,-10,10,2,?,'2026-08-11')",
      period!.id,
    );
    await expectAbort(
      run("INSERT INTO financial_event_commit (event_id,user_id,write_key,created_at) VALUES ('outside-period','ledger-u2','setup',unixepoch())"),
      "ledger_event_outside_period",
    );
  });

  it("rejects overlapping periods for one user but permits another user", async () => {
    await expectAbort(
      run(
        "INSERT INTO budget_period (user_id,label,start_date,end_date,planned_income,savings_target,spending_limit) VALUES ('ledger-u1','Overlap','2026-08-31','2026-09-30',100,0,100)",
      ),
      "ledger_period_overlap",
    );
    await run(
      "INSERT INTO budget_period (user_id,label,start_date,end_date,planned_income,savings_target,spending_limit) VALUES ('ledger-u2','Aug','2026-08-01','2026-08-31',100,0,100)",
    );
  });

  it("rejects null text identities", async () => {
    await expectAbort(
      run(
        "INSERT INTO financial_profile (user_id,ledger_start_date,minimum_cash_reserve) VALUES (NULL,'2026-08-01',0)",
      ),
      "NOT NULL constraint failed: financial_profile.user_id",
    );
    await expectAbort(
      run(
        "INSERT INTO financial_event (id,user_id,write_key,kind,amount,cash_delta,equity_delta,date) VALUES (NULL,'ledger-u1','setup','opening_cash',1,1,1,'2026-08-01')",
      ),
      "NOT NULL constraint failed: financial_event.id",
    );
    await expectAbort(
      run(
        "INSERT INTO financial_position (id,user_id,name,kind,reserve_against_cash) VALUES (NULL,'ledger-u1','Null','credit_card',1)",
      ),
      "NOT NULL constraint failed: financial_position.id",
    );
    await expectAbort(
      run(
        "INSERT INTO financial_event_commit (event_id,user_id,write_key) VALUES (NULL,'ledger-u1','setup')",
      ),
      "ledger_null_identity",
    );
  });

  it("makes budget period ownership immutable", async () => {
    await expectAbort(
      run("UPDATE budget_period SET user_id='ledger-u2' WHERE user_id='ledger-u1' AND label='Aug'"),
      "ledger_period_user_immutable",
    );
  });
});

describe("append-only and idempotency hardening", () => {
  it("blocks INSERT OR REPLACE before it can delete append-only rows", async () => {
    const period = await insertAllocatedExpense("replace");
    await run(
      "INSERT INTO financial_profile_adjustment (id,user_id,target,delta,note,write_key) VALUES ('replace-adjustment','ledger-u1','minimum_cash_reserve',1,'adjust','setup')",
    );

    await expectAbort(
      run(
        "INSERT OR REPLACE INTO financial_write_request (user_id,idempotency_key,operation,request_hash,response_json) VALUES ('ledger-u1','setup','changed','changed','changed')",
      ),
      "ledger_append_only",
    );
    await expectAbort(
      run(
        "INSERT OR REPLACE INTO financial_profile (user_id,ledger_start_date,minimum_cash_reserve) VALUES ('ledger-u1','2026-08-01',99)",
      ),
      "ledger_append_only",
    );
    await expectAbort(
      run(
        "INSERT OR REPLACE INTO financial_profile_adjustment (id,user_id,target,delta,note,write_key) VALUES ('replace-adjustment','ledger-u1','minimum_cash_reserve',2,'replace','setup')",
      ),
      "ledger_append_only",
    );
    await expectAbort(
      run(
        "INSERT OR REPLACE INTO financial_event (id,user_id,write_key,kind,amount,cash_delta,expense_delta,category_id,budget_period_id,date) VALUES ('replace-expense','ledger-u1','setup','expense_cash',100,-100,100,1,?,'2026-08-10')",
        period,
      ),
      "ledger_append_only",
    );
    await expectAbort(
      run(
        "INSERT OR REPLACE INTO financial_event_custom_budget_allocation VALUES ('replace-expense','replace-envelope','ledger-u1',60)",
      ),
      "ledger_append_only",
    );
    await expectAbort(
      run(
        "INSERT OR REPLACE INTO financial_event_commit (event_id,user_id,write_key,created_at) VALUES ('replace-expense','ledger-u1','setup',unixepoch())",
      ),
      "ledger_append_only",
    );
    await expectAbort(
      run("INSERT OR REPLACE INTO financial_position (id,user_id,name,kind,reserve_against_cash) VALUES ('card-u1','ledger-u1','Replaced','credit_card',1)"),
      "ledger_append_only",
    );
    await expectAbort(
      run("INSERT OR REPLACE INTO budget_period (id,user_id,label,start_date,end_date,planned_income,savings_target,spending_limit) VALUES (?,'ledger-u1','Aug','2026-08-01','2026-08-31',1000,200,700)", period),
      "ledger_append_only",
    );
    await expectAbort(
      run("INSERT OR REPLACE INTO ledger_custom_budget (id,user_id,budget_period_id,name,amount) VALUES ('replace-envelope','ledger-u1',?,'Replaced',300)", period),
      "ledger_append_only",
    );
    await run(
      "INSERT INTO financial_event (id,user_id,write_key,kind,amount,cash_delta,equity_delta,date) VALUES ('replace-opening','ledger-u1','setup','opening_cash',1,1,1,'2026-08-01')",
    );
    await expectAbort(
      run(
        "INSERT OR REPLACE INTO financial_event (id,user_id,write_key,kind,amount,cash_delta,equity_delta,date) VALUES ('replacement-opening-id','ledger-u1','setup','opening_cash',2,2,2,'2026-08-01')",
      ),
      "ledger_append_only",
    );
  });

  it("installs duplicate-insert guards for every append-only table", async () => {
    const expected = [
      "financial_write_request",
      "financial_profile",
      "financial_profile_adjustment",
      "ledger_budget_adjustment",
      "ledger_custom_budget_adjustment",
      "financial_event",
      "financial_event_custom_budget_allocation",
      "financial_event_commit",
      "budget_period_lock",
      "financial_position_closure",
      "financial_position_closure_reversal",
      "financial_position",
      "ledger_custom_budget_closure",
      "ledger_custom_budget_closure_reversal",
      "ledger_custom_budget",
      "budget_period",
    ];
    const triggers = await env.DB.prepare(
      "SELECT tbl_name,sql FROM sqlite_master WHERE type='trigger' AND name LIKE 'trg_%_duplicate'",
    ).all<{ tbl_name: string; sql: string }>();
    expect(triggers.results.map(({ tbl_name }) => tbl_name).sort()).toEqual(expected.sort());
    expect(triggers.results.every(({ sql }) => sql.includes("BEFORE INSERT"))).toBe(true);
  });

  it("rejects duplicate claims and immutable replay responses", async () => {
    await expectAbort(
      run(
        "INSERT INTO financial_write_request (user_id,idempotency_key,operation,request_hash,response_json) VALUES ('ledger-u1','setup','setup','hash','{}')",
      ),
      "ledger_append_only",
    );
    await expectAbort(
      run(
        "UPDATE financial_write_request SET response_json='changed' WHERE user_id='ledger-u1' AND idempotency_key='setup'",
      ),
      "ledger_append_only",
    );
  });

  it("rolls back an idempotency claim when a D1 batch fails", async () => {
    await expectAbort(
      env.DB.batch([
        env.DB.prepare(
          "INSERT INTO financial_write_request (user_id,idempotency_key,operation,request_hash,response_json) VALUES ('ledger-u1','failed-batch','test','hash','{}')",
        ),
        env.DB.prepare(
          "INSERT INTO financial_event (id,user_id,write_key,kind,amount,cash_delta,date) VALUES ('invalid-batch-event','ledger-u1','failed-batch','opening_cash',10,-10,'2026-08-01')",
        ),
      ]),
      "CHECK constraint failed",
    );
    expect(
      await env.DB.prepare(
        "SELECT idempotency_key FROM financial_write_request WHERE user_id='ledger-u1' AND idempotency_key='failed-batch'",
      ).first(),
    ).toBeNull();
  });
});

describe("profile commit boundary", () => {
  it("rejects events and profile adjustments before profile initialization", async () => {
    await seedUser({ id: "ledger-uninitialized", email: "uninitialized@example.com" });
    await run(
      "INSERT INTO financial_write_request (user_id,idempotency_key,operation,request_hash,response_json) VALUES ('ledger-uninitialized','write','test','hash','{}')",
    );
    await run(
      "INSERT INTO financial_event (id,user_id,write_key,kind,amount,cash_delta,equity_delta,date) VALUES ('pre-init','ledger-uninitialized','write','opening_cash',10,10,10,'2026-08-01')",
    );
    await expectAbort(
      run(
        "INSERT INTO financial_event_commit (event_id,user_id,write_key) VALUES ('pre-init','ledger-uninitialized','write')",
      ),
      "ledger_profile_required",
    );
    await expectAbort(
      run(
        "INSERT INTO financial_profile_adjustment (id,user_id,target,delta,note,write_key) VALUES ('pre-init-adjustment','ledger-uninitialized','minimum_cash_reserve',1,'bad','write')",
      ),
      "ledger_profile_required",
    );
  });
});

describe("durable ledger cutover boundary", () => {
  it("blocks insert, update, and delete for every legacy financial table after activation", async () => {
    const statements = [
      `INSERT INTO "transaction" (user_id,amount,type,category_id,date) VALUES ('ledger-u1',1,'income',1,'2026-08-10')`,
      `UPDATE "transaction" SET note='changed' WHERE user_id='ledger-u1'`,
      `DELETE FROM "transaction" WHERE user_id='ledger-u1'`,
      `INSERT INTO monthly_budget (user_id,month,amount) VALUES ('ledger-u1','2026-09',100)`,
      `UPDATE monthly_budget SET amount=1001 WHERE user_id='ledger-u1'`,
      `DELETE FROM monthly_budget WHERE user_id='ledger-u1'`,
      `INSERT INTO custom_budget (user_id,name,amount) VALUES ('ledger-u1','Blocked',100)`,
      `UPDATE custom_budget SET name='changed' WHERE user_id='ledger-u1'`,
      `DELETE FROM custom_budget WHERE user_id='ledger-u1'`,
      `INSERT INTO debt (id,user_id,type,party,status) VALUES ('blocked-debt','ledger-u1','lend','Blocked','open')`,
      `UPDATE debt SET party='changed' WHERE user_id='ledger-u1'`,
      `DELETE FROM debt WHERE user_id='ledger-u1'`,
      `INSERT INTO budget_adjustment (monthly_budget_id,delta) SELECT id,1 FROM monthly_budget WHERE user_id='ledger-u1' LIMIT 1`,
      `UPDATE budget_adjustment SET note='changed' WHERE monthly_budget_id IN (SELECT id FROM monthly_budget WHERE user_id='ledger-u1')`,
      `DELETE FROM budget_adjustment WHERE monthly_budget_id IN (SELECT id FROM monthly_budget WHERE user_id='ledger-u1')`,
      `INSERT INTO transaction_custom_budget (transaction_id,custom_budget_id) SELECT t.id,cb.id FROM "transaction" t JOIN custom_budget cb ON cb.user_id=t.user_id WHERE t.user_id='ledger-u1' LIMIT 1`,
      `UPDATE transaction_custom_budget SET custom_budget_id=custom_budget_id WHERE transaction_id IN (SELECT id FROM "transaction" WHERE user_id='ledger-u1')`,
      `DELETE FROM transaction_custom_budget WHERE transaction_id IN (SELECT id FROM "transaction" WHERE user_id='ledger-u1')`,
      `INSERT INTO budget_config (user_id,default_monthly_amount) VALUES ('ledger-u1',1000)`,
      `UPDATE budget_config SET default_monthly_amount=1001 WHERE user_id='ledger-u1'`,
      `DELETE FROM budget_config WHERE user_id='ledger-u1'`,
      `INSERT INTO statistics_report (user_id,period_type,period_key) VALUES ('ledger-u1','monthly','2026-09')`,
      `UPDATE statistics_report SET is_dirty=1 WHERE user_id='ledger-u1'`,
      `DELETE FROM statistics_report WHERE user_id='ledger-u1'`,
      `INSERT INTO ai_suggestion_run (user_id,status) VALUES ('ledger-u1','pending')`,
      `UPDATE ai_suggestion_run SET status='done' WHERE user_id='ledger-u1'`,
      `DELETE FROM ai_suggestion_run WHERE user_id='ledger-u1'`,
    ];
    for (const sql of statements) await expectAbort(run(sql), "ledger_cutover_active");
  });

  it("closes the no-consent initialization race in either serialization order", async () => {
    await seedUser({ id: "cutover-race", email: "cutover-race@example.com" });
    const results = await Promise.allSettled([
      run("INSERT INTO financial_profile (user_id,ledger_start_date) VALUES ('cutover-race','2026-08-01')"),
      run("INSERT INTO monthly_budget (user_id,month,amount) VALUES ('cutover-race','2026-08',100)"),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(String((results.find((result) => result.status === "rejected") as PromiseRejectedResult).reason))
      .toMatch(/ledger_(legacy_data_consent_required|cutover_active)/);
  });

  it("allows consented initialization over preserved legacy rows", async () => {
    await seedUser({ id: "cutover-consent", email: "cutover-consent@example.com" });
    await run("INSERT INTO monthly_budget (user_id,month,amount) VALUES ('cutover-consent','2026-08',100)");
    await run("INSERT INTO financial_profile (user_id,ledger_start_date,legacy_data_consent_at,legacy_data_archive_state) VALUES ('cutover-consent','2026-08-01',unixepoch(),'preserved')");
    expect(await env.DB.prepare("SELECT legacy_data_archive_state state FROM financial_profile WHERE user_id='cutover-consent'").first()).toEqual({ state: "preserved" });
    expect(await env.DB.prepare("SELECT COUNT(*) count FROM monthly_budget WHERE user_id='cutover-consent'").first()).toEqual({ count: 1 });
  });
});

describe("category history integrity", () => {
  it("rejects deleting a category referenced by committed ledger history", async () => {
    const period = await periodId();
    await run(
      "INSERT INTO financial_event (id,user_id,write_key,kind,amount,cash_delta,expense_delta,category_id,budget_period_id,date) VALUES ('category-history','ledger-u1','setup','expense_cash',1,-1,1,1,?,'2026-08-10')",
      period,
    );
    await run("INSERT INTO financial_event_commit (event_id,user_id,write_key) VALUES ('category-history','ledger-u1','setup')");
    await expectAbort(run("DELETE FROM category WHERE id=1"), "ledger_category_in_use");
  });

  it("rejects adding a child beneath a category referenced by committed history", async () => {
    expect(await env.DB.prepare(
      "SELECT COUNT(*) count FROM sqlite_master WHERE type='trigger' AND name='trg_category_used_parent'",
    ).first()).toEqual({ count: 1 });
    const parent = await env.DB.prepare(
      "INSERT INTO category (user_id,name,level,sort_order,type) VALUES ('ledger-u1','Used leaf',1,0,'expense') RETURNING id",
    ).first<{ id: number }>();
    const period = await periodId();
    await run(
      "INSERT INTO financial_event (id,user_id,write_key,kind,amount,cash_delta,expense_delta,category_id,budget_period_id,date) VALUES ('used-leaf-event','ledger-u1','setup','expense_cash',1,-1,1,?,?, '2026-08-10')",
      parent!.id,
      period,
    );
    await run("INSERT INTO financial_event_commit (event_id,user_id,write_key) VALUES ('used-leaf-event','ledger-u1','setup')");
    await expectAbort(
      run("INSERT INTO category (user_id,name,parent_id,level,sort_order,type) VALUES ('ledger-u1','Late child',?,2,0,'expense')", parent!.id),
      "ledger_category_in_use",
    );
  });

  it("rejects committing an operating event against a non-leaf category", async () => {
    const parent = await env.DB.prepare(
      "INSERT INTO category (user_id,name,level,sort_order,type) VALUES ('ledger-u1','Unused parent',1,0,'expense') RETURNING id",
    ).first<{ id: number }>();
    await run("INSERT INTO category (user_id,name,parent_id,level,sort_order,type) VALUES ('ledger-u1','Child',?,2,0,'expense')", parent!.id);
    const period = await periodId();
    await run(
      "INSERT INTO financial_event (id,user_id,write_key,kind,amount,cash_delta,expense_delta,category_id,budget_period_id,date) VALUES ('non-leaf-category','ledger-u1','setup','expense_cash',1,-1,1,?,?, '2026-08-10')",
      parent!.id,
      period,
    );
    await expectAbort(
      run("INSERT INTO financial_event_commit (event_id,user_id,write_key) VALUES ('non-leaf-category','ledger-u1','setup')"),
      "ledger_category_not_leaf",
    );
  });
});

describe("event bundles", () => {
  it("rejects a concurrent ordinary movement that crosses zero", async () => {
    await run("INSERT INTO financial_position (id,user_id,name,kind,reserve_against_cash) VALUES ('race-position','ledger-u1','Race','term_deposit',0)");
    await run("INSERT INTO financial_write_request (user_id,idempotency_key,operation,request_hash,response_json) VALUES ('ledger-u1','race-a','move','a','{}'),('ledger-u1','race-b','move','b','{}')");
    await run("INSERT INTO financial_event (id,user_id,write_key,kind,amount,position_id,position_delta,equity_delta,date) VALUES ('race-open','ledger-u1','setup','opening_position',100,'race-position',100,100,'2026-08-01')");
    await run("INSERT INTO financial_event_commit (event_id,user_id,write_key) VALUES ('race-open','ledger-u1','setup')");
    await run("INSERT INTO financial_event (id,user_id,write_key,kind,amount,cash_delta,position_id,position_delta,date) VALUES ('race-move-a','ledger-u1','race-a','position_to_cash',70,70,'race-position',-70,'2026-08-10'),('race-move-b','ledger-u1','race-b','position_to_cash',70,70,'race-position',-70,'2026-08-10')");

    const results = await Promise.allSettled([
      run("INSERT INTO financial_event_commit (event_id,user_id,write_key) VALUES ('race-move-a','ledger-u1','race-a')"),
      run("INSERT INTO financial_event_commit (event_id,user_id,write_key) VALUES ('race-move-b','ledger-u1','race-b')"),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected") as PromiseRejectedResult;
    expect(String(rejected.reason)).toContain("ledger_position_crosses_zero");
  });

  it("commits a valid allocated expense, locks its period, and seals the bundle", async () => {
    const period = await env.DB.prepare(
      "SELECT id FROM budget_period WHERE user_id='ledger-u1' AND label='Aug'",
    ).first<{ id: number }>();
    await run(
      "INSERT INTO ledger_custom_budget (id,user_id,budget_period_id,name,amount) VALUES ('food-envelope','ledger-u1',?,'Food',300)",
      period!.id,
    );
    await run(
      "INSERT INTO ledger_custom_budget (id,user_id,budget_period_id,name,amount) VALUES ('sealed-envelope','ledger-u1',?,'Sealed',10)",
      period!.id,
    );
    await run(
      "INSERT INTO financial_event (id,user_id,write_key,kind,amount,cash_delta,expense_delta,category_id,budget_period_id,date) VALUES ('expense-1','ledger-u1','setup','expense_cash',100,-100,100,1,?,'2026-08-10')",
      period!.id,
    );
    await run(
      "INSERT INTO financial_event_custom_budget_allocation VALUES ('expense-1','food-envelope','ledger-u1',60)",
    );
    await run(
      "INSERT INTO financial_event_commit (event_id,user_id,write_key) VALUES ('expense-1','ledger-u1','setup')",
    );

    expect(
      await env.DB.prepare("SELECT first_event_id FROM budget_period_lock WHERE budget_period_id=?")
        .bind(period!.id)
        .first(),
    ).toEqual({ first_event_id: "expense-1" });
    await expectAbort(
      run(
        "INSERT INTO financial_event_custom_budget_allocation VALUES ('expense-1','sealed-envelope','ledger-u1',1)",
      ),
      "ledger_event_sealed",
    );
    await expectAbort(run("UPDATE financial_event SET note='changed' WHERE id='expense-1'"), "ledger_append_only");
  });

  it("rejects mismatched refund media and cumulative over-refunds at commit", async () => {
    const period = await env.DB.prepare(
      "SELECT id FROM budget_period WHERE user_id='ledger-u1' AND label='Aug'",
    ).first<{ id: number }>();
    await run(
      "INSERT INTO financial_event (id,user_id,write_key,kind,amount,cash_delta,expense_delta,category_id,budget_period_id,date) VALUES ('refund-source','ledger-u1','setup','expense_cash',100,-100,100,1,?,'2026-08-10')",
      period!.id,
    );
    await run("INSERT INTO financial_event_commit (event_id,user_id,write_key,created_at) VALUES ('refund-source','ledger-u1','setup',unixepoch())");
    await run(
      "INSERT INTO financial_event (id,user_id,write_key,kind,amount,position_id,position_delta,expense_delta,category_id,budget_period_id,related_event_id,refund_prior_total,date) VALUES ('bad-refund','ledger-u1','setup','refund_position',20,'card-u1',20,-20,1,?,'refund-source',0,'2026-08-11')",
      period!.id,
    );
    await expectAbort(
      run("INSERT INTO financial_event_commit (event_id,user_id,write_key,created_at) VALUES ('bad-refund','ledger-u1','setup',unixepoch())"),
      "ledger_refund_mismatch",
    );

    await run(
      "INSERT INTO financial_event (id,user_id,write_key,kind,amount,cash_delta,expense_delta,category_id,budget_period_id,related_event_id,refund_prior_total,date) VALUES ('over-refund','ledger-u1','setup','refund_cash',101,101,-101,1,?,'refund-source',0,'2026-08-11')",
      period!.id,
    );
    await expectAbort(
      run("INSERT INTO financial_event_commit (event_id,user_id,write_key,created_at) VALUES ('over-refund','ledger-u1','setup',unixepoch())"),
      "ledger_refund_exceeds_expense",
    );
  });

  it("rejects a refund dated before its original expense", async () => {
    const period = await periodId();
    await run(
      "INSERT INTO financial_event (id,user_id,write_key,kind,amount,cash_delta,expense_delta,category_id,budget_period_id,date) VALUES ('chronology-source','ledger-u1','setup','expense_cash',10,-10,10,1,?,'2026-08-10')",
      period,
    );
    await run("INSERT INTO financial_event_commit (event_id,user_id,write_key) VALUES ('chronology-source','ledger-u1','setup')");
    await run(
      "INSERT INTO financial_event (id,user_id,write_key,kind,amount,cash_delta,expense_delta,category_id,budget_period_id,related_event_id,refund_prior_total,date) VALUES ('early-refund','ledger-u1','setup','refund_cash',1,1,-1,1,?,'chronology-source',0,'2026-08-09')",
      period,
    );
    await expectAbort(
      run("INSERT INTO financial_event_commit (event_id,user_id,write_key) VALUES ('early-refund','ledger-u1','setup')"),
      "ledger_refund_before_expense",
    );
  });

  it("requires exact reversal effects and allocation negation", async () => {
    const period = await env.DB.prepare(
      "SELECT id FROM budget_period WHERE user_id='ledger-u1' AND label='Aug'",
    ).first<{ id: number }>();
    await run(
      "INSERT INTO financial_event (id,user_id,write_key,kind,amount,cash_delta,expense_delta,category_id,budget_period_id,date) VALUES ('reversal-source','ledger-u1','setup','expense_cash',100,-100,100,1,?,'2026-08-10')",
      period!.id,
    );
    await run("INSERT INTO financial_event_commit (event_id,user_id,write_key,created_at) VALUES ('reversal-source','ledger-u1','setup',unixepoch())");
    await run(
      "INSERT INTO financial_event (id,user_id,write_key,kind,amount,cash_delta,expense_delta,category_id,budget_period_id,reversal_of_event_id,date) VALUES ('bad-reversal','ledger-u1','setup','reversal',100,-100,100,1,?,'reversal-source','2026-08-10')",
      period!.id,
    );
    await expectAbort(
      run("INSERT INTO financial_event_commit (event_id,user_id,write_key,created_at) VALUES ('bad-reversal','ledger-u1','setup',unixepoch())"),
      "ledger_reversal_mismatch",
    );
  });

  it("rejects missing and extra reversal allocations", async () => {
    const period = await insertAllocatedExpense("missing-allocation");
    await run(
      "INSERT INTO financial_event (id,user_id,write_key,kind,amount,cash_delta,expense_delta,category_id,budget_period_id,reversal_of_event_id,date) VALUES ('missing-allocation-reversal','ledger-u1','setup','reversal',100,100,-100,1,?,'missing-allocation-expense','2026-08-10')",
      period,
    );
    await expectAbort(
      run(
        "INSERT INTO financial_event_commit (event_id,user_id,write_key,created_at) VALUES ('missing-allocation-reversal','ledger-u1','setup',unixepoch())",
      ),
      "ledger_reversal_allocation_mismatch",
    );

    await run(
      "INSERT INTO financial_event (id,user_id,write_key,kind,amount,cash_delta,expense_delta,category_id,budget_period_id,date) VALUES ('extra-source','ledger-u1','setup','expense_cash',10,-10,10,1,?,'2026-08-10')",
      period,
    );
    await run("INSERT INTO financial_event_commit (event_id,user_id,write_key,created_at) VALUES ('extra-source','ledger-u1','setup',unixepoch())");
    await run(
      "INSERT INTO financial_event (id,user_id,write_key,kind,amount,cash_delta,expense_delta,category_id,budget_period_id,reversal_of_event_id,date) VALUES ('extra-reversal','ledger-u1','setup','reversal',10,10,-10,1,?,'extra-source','2026-08-10')",
      period,
    );
    await run(
      "INSERT INTO financial_event_custom_budget_allocation VALUES ('extra-reversal','missing-allocation-envelope','ledger-u1',1)",
    );
    await expectAbort(
      run("INSERT INTO financial_event_commit (event_id,user_id,write_key,created_at) VALUES ('extra-reversal','ledger-u1','setup',unixepoch())"),
      "ledger_reversal_allocation_mismatch",
    );
  });

  it("blocks expense reversal while a refund is active", async () => {
    const period = await insertAllocatedExpense("active-refund");
    await run(
      "INSERT INTO financial_event (id,user_id,write_key,kind,amount,cash_delta,expense_delta,category_id,budget_period_id,related_event_id,refund_prior_total,date) VALUES ('active-refund','ledger-u1','setup','refund_cash',20,20,-20,1,?,'active-refund-expense',0,'2026-08-11')",
      period,
    );
    await run(
      "INSERT INTO financial_event_custom_budget_allocation VALUES ('active-refund','active-refund-envelope','ledger-u1',-12)",
    );
    await run("INSERT INTO financial_event_commit (event_id,user_id,write_key,created_at) VALUES ('active-refund','ledger-u1','setup',unixepoch())");
    await run(
      "INSERT INTO financial_event (id,user_id,write_key,kind,amount,cash_delta,expense_delta,category_id,budget_period_id,reversal_of_event_id,date) VALUES ('blocked-expense-reversal','ledger-u1','setup','reversal',100,100,-100,1,?,'active-refund-expense','2026-08-10')",
      period,
    );
    await run(
      "INSERT INTO financial_event_custom_budget_allocation VALUES ('blocked-expense-reversal','active-refund-envelope','ledger-u1',-60)",
    );
    await expectAbort(
      run(
        "INSERT INTO financial_event_commit (event_id,user_id,write_key,created_at) VALUES ('blocked-expense-reversal','ledger-u1','setup',unixepoch())",
      ),
      "ledger_expense_has_refunds",
    );
  });

  it("permits expense reversal after its refund and allocations are reversed", async () => {
    const period = await insertAllocatedExpense("reversed-refund");
    await run(
      "INSERT INTO financial_event (id,user_id,write_key,kind,amount,cash_delta,expense_delta,category_id,budget_period_id,related_event_id,refund_prior_total,date) VALUES ('refund-to-reverse','ledger-u1','setup','refund_cash',20,20,-20,1,?,'reversed-refund-expense',0,'2026-08-11')",
      period,
    );
    await run(
      "INSERT INTO financial_event_custom_budget_allocation VALUES ('refund-to-reverse','reversed-refund-envelope','ledger-u1',-12)",
    );
    await run("INSERT INTO financial_event_commit (event_id,user_id,write_key,created_at) VALUES ('refund-to-reverse','ledger-u1','setup',unixepoch())");
    await run(
      "INSERT INTO financial_event (id,user_id,write_key,kind,amount,cash_delta,expense_delta,category_id,budget_period_id,reversal_of_event_id,date) VALUES ('refund-reversal','ledger-u1','setup','reversal',20,-20,20,1,?,'refund-to-reverse','2026-08-11')",
      period,
    );
    await run(
      "INSERT INTO financial_event_custom_budget_allocation VALUES ('refund-reversal','reversed-refund-envelope','ledger-u1',12)",
    );
    await run("INSERT INTO financial_event_commit (event_id,user_id,write_key,created_at) VALUES ('refund-reversal','ledger-u1','setup',unixepoch())");
    await run(
      "INSERT INTO financial_event (id,user_id,write_key,kind,amount,cash_delta,expense_delta,category_id,budget_period_id,reversal_of_event_id,date) VALUES ('allowed-expense-reversal','ledger-u1','setup','reversal',100,100,-100,1,?,'reversed-refund-expense','2026-08-10')",
      period,
    );
    await run(
      "INSERT INTO financial_event_custom_budget_allocation VALUES ('allowed-expense-reversal','reversed-refund-envelope','ledger-u1',-60)",
    );
    await run(
      "INSERT INTO financial_event_commit (event_id,user_id,write_key,created_at) VALUES ('allowed-expense-reversal','ledger-u1','setup',unixepoch())",
    );
  });

  it("rejects cross-user reversal and allocation references", async () => {
    await run(
      "INSERT INTO financial_event (id,user_id,write_key,kind,amount,position_id,position_delta,equity_delta,date) VALUES ('u2-opening','ledger-u2','setup','opening_position',5,'card-u2',-5,-5,'2026-08-01')",
    );
    await run("INSERT INTO financial_event_commit (event_id,user_id,write_key,created_at) VALUES ('u2-opening','ledger-u2','setup',unixepoch())");
    await expectAbort(
      run(
        "INSERT INTO financial_event (id,user_id,write_key,kind,amount,position_id,position_delta,equity_delta,reversal_of_event_id,date) VALUES ('cross-reversal','ledger-u1','setup','reversal',5,'card-u1',5,5,'u2-opening','2026-08-01')",
      ),
      "FOREIGN KEY constraint failed",
    );

    const period = await env.DB.prepare(
      "INSERT INTO budget_period (user_id,label,start_date,end_date,planned_income,savings_target,spending_limit) VALUES ('ledger-u2','Cross allocation','2026-08-01','2026-08-31',100,0,100) RETURNING id",
    ).first<{ id: number }>();
    await run(
      "INSERT INTO ledger_custom_budget (id,user_id,budget_period_id,name,amount) VALUES ('u2-envelope','ledger-u2',?,'Other',10)",
      period!.id,
    );
    const u1Period = await periodId();
    await run(
      "INSERT INTO financial_event (id,user_id,write_key,kind,amount,cash_delta,expense_delta,category_id,budget_period_id,date) VALUES ('u1-uncommitted','ledger-u1','setup','expense_cash',10,-10,10,1,?,'2026-08-10')",
      u1Period,
    );
    await expectAbort(
      run(
        "INSERT INTO financial_event_custom_budget_allocation VALUES ('u1-uncommitted','u2-envelope','ledger-u1',5)",
      ),
      "ledger_invalid_allocation",
    );
  });
});

describe("effective planning and lifecycle guards", () => {
  it("allows position metadata updates but rejects every immutable field", async () => {
    await env.DB.prepare(
      "UPDATE financial_position SET name='Renamed',counterparty='Bank',due_date='2026-08-20',note='metadata' WHERE id='card-u1'",
    ).run();
    for (const sql of [
      "UPDATE financial_position SET id='changed' WHERE id='card-u1'",
      "UPDATE financial_position SET user_id='ledger-u2' WHERE id='card-u1'",
      "UPDATE financial_position SET kind='term_deposit' WHERE id='card-u1'",
      "UPDATE financial_position SET reserve_against_cash=0 WHERE id='card-u1'",
      "UPDATE financial_position SET created_at=0 WHERE id='card-u1'",
    ]) {
      await expectAbort(run(sql), "ledger_position_financial_immutable");
    }
  });

  it("rejects a zero-balance Close before ledger start", async () => {
    await expectAbort(
      run(
        "INSERT INTO financial_position_closure (id,user_id,position_id,write_key,date) VALUES ('pre-start-zero-close','ledger-u1','deposit-u1','setup','2026-07-31')",
      ),
      "ledger_close_before_start",
    );
  });

  it("rejects adjustments that make reserve, plans, or custom capacity invalid", async () => {
    await expectAbort(
      run(
        "INSERT INTO financial_profile_adjustment (id,user_id,target,delta,note,write_key) VALUES ('reserve-down','ledger-u1','minimum_cash_reserve',-1,'bad','setup')",
      ),
      "ledger_negative_reserve",
    );
    const period = await env.DB.prepare(
      "SELECT id FROM budget_period WHERE user_id='ledger-u1' AND label='Aug'",
    ).first<{ id: number }>();
    await run(
      "INSERT INTO ledger_custom_budget (id,user_id,budget_period_id,name,amount) VALUES ('capacity-test','ledger-u1',?,'Capacity',300)",
      period!.id,
    );
    await expectAbort(
      run(
        "INSERT INTO ledger_budget_adjustment (id,budget_period_id,user_id,target,delta,note,write_key) VALUES ('limit-down',?,'ledger-u1','spending_limit',-500,'bad','setup')",
        period!.id,
      ),
      "ledger_custom_capacity_exceeds_limit",
    );
  });

  it("accepts only a complete signed settlement when closing a position", async () => {
    await run(
      "INSERT INTO financial_event (id,user_id,write_key,kind,amount,position_id,position_delta,equity_delta,date) VALUES ('deposit-open','ledger-u1','setup','opening_position',100,'deposit-u1',100,100,'2026-08-01')",
    );
    await run("INSERT INTO financial_event_commit (event_id,user_id,write_key,created_at) VALUES ('deposit-open','ledger-u1','setup',unixepoch())");
    await run(
      "INSERT INTO financial_event (id,user_id,write_key,kind,amount,cash_delta,position_id,position_delta,date) VALUES ('deposit-settle','ledger-u1','setup','position_to_cash',100,100,'deposit-u1',-100,'2026-08-15')",
    );
    await run("INSERT INTO financial_event_commit (event_id,user_id,write_key,created_at) VALUES ('deposit-settle','ledger-u1','setup',unixepoch())");
    await run(
      "INSERT INTO financial_position_closure (id,user_id,position_id,settlement_event_id,write_key,date) VALUES ('deposit-close','ledger-u1','deposit-u1','deposit-settle','setup','2026-08-15')",
    );
    const commitOrder = await env.DB.prepare(
      "SELECT event_id,sequence FROM financial_event_commit WHERE event_id IN ('deposit-open','deposit-settle') ORDER BY sequence",
    ).all<{ event_id: string; sequence: number }>();
    expect(commitOrder.results.map(({ event_id }) => event_id)).toEqual([
      "deposit-open",
      "deposit-settle",
    ]);
    expect(commitOrder.results[1].sequence).toBeGreaterThan(commitOrder.results[0].sequence);
    await expectAbort(
      run(
        "INSERT INTO financial_position_closure (id,user_id,position_id,write_key,date) VALUES ('deposit-close-2','ledger-u1','deposit-u1','setup','2026-08-15')",
      ),
      "ledger_position_already_closed",
    );
  });

  it("rejects an older settlement reference and multiple close movements", async () => {
    await run(
      "INSERT INTO financial_write_request (user_id,idempotency_key,operation,request_hash,response_json) VALUES ('ledger-u1','close-multi','close','hash','{}')",
    );
    await run(
      "INSERT INTO financial_position (id,user_id,name,kind,reserve_against_cash) VALUES ('multi-position','ledger-u1','Multi','term_deposit',0),('older-position','ledger-u1','Older','term_deposit',0)",
    );
    await run(
      "INSERT INTO financial_event (id,user_id,write_key,kind,amount,position_id,position_delta,equity_delta,date) VALUES ('multi-open','ledger-u1','setup','opening_position',100,'multi-position',100,100,'2026-08-01'),('older-open','ledger-u1','setup','opening_position',100,'older-position',100,100,'2026-08-01')",
    );
    await run("INSERT INTO financial_event_commit (event_id,user_id,write_key,created_at) VALUES ('multi-open','ledger-u1','setup',unixepoch())");
    await run("INSERT INTO financial_event_commit (event_id,user_id,write_key,created_at) VALUES ('older-open','ledger-u1','setup',unixepoch())");
    await run(
      "INSERT INTO financial_event (id,user_id,write_key,kind,amount,cash_delta,position_id,position_delta,date) VALUES ('multi-a','ledger-u1','close-multi','position_to_cash',60,60,'multi-position',-60,'2026-08-15'),('multi-b','ledger-u1','close-multi','position_to_cash',40,40,'multi-position',-40,'2026-08-15')",
    );
    await run("INSERT INTO financial_event_commit (event_id,user_id,write_key,created_at) VALUES ('multi-a','ledger-u1','close-multi',unixepoch())");
    await run("INSERT INTO financial_event_commit (event_id,user_id,write_key,created_at) VALUES ('multi-b','ledger-u1','close-multi',unixepoch())");
    await expectAbort(
      run(
        "INSERT INTO financial_position_closure (id,user_id,position_id,settlement_event_id,write_key,date) VALUES ('multi-close','ledger-u1','multi-position','multi-a','close-multi','2026-08-15')",
      ),
      "ledger_close_multiple_movements",
    );

    await run(
      "INSERT INTO financial_event (id,user_id,write_key,kind,amount,cash_delta,position_id,position_delta,date) VALUES ('older-a','ledger-u1','setup','position_to_cash',40,40,'older-position',-40,'2026-08-10'),('older-b','ledger-u1','close-multi','position_to_cash',60,60,'older-position',-60,'2026-08-15')",
    );
    await run("INSERT INTO financial_event_commit (event_id,user_id,write_key,created_at) VALUES ('older-a','ledger-u1','setup',unixepoch())");
    await run("INSERT INTO financial_event_commit (event_id,user_id,write_key,created_at) VALUES ('older-b','ledger-u1','close-multi',unixepoch())");
    await expectAbort(
      run(
        "INSERT INTO financial_position_closure (id,user_id,position_id,settlement_event_id,write_key,date) VALUES ('older-close','ledger-u1','older-position','older-a','setup','2026-08-10')",
      ),
      "ledger_close_before_activity",
    );
  });

  it("rejects a settlement made stale by later same-date activity from another write", async () => {
    await run(
      "INSERT INTO financial_write_request (user_id,idempotency_key,operation,request_hash,response_json) VALUES ('ledger-u1','stale-close','close','hash','{}'),('ledger-u1','later-activity','adjust','hash','{}')",
    );
    await run(
      "INSERT INTO financial_position (id,user_id,name,kind,reserve_against_cash) VALUES ('stale-position','ledger-u1','Stale','term_deposit',0)",
    );
    await run(
      "INSERT INTO financial_event (id,user_id,write_key,kind,amount,position_id,position_delta,equity_delta,date) VALUES ('stale-open','ledger-u1','setup','opening_position',100,'stale-position',100,100,'2026-08-01')",
    );
    await run(
      "INSERT INTO financial_event_commit (event_id,user_id,write_key) VALUES ('stale-open','ledger-u1','setup')",
    );
    await run(
      "INSERT INTO financial_event (id,user_id,write_key,kind,amount,cash_delta,position_id,position_delta,date) VALUES ('stale-settlement','ledger-u1','stale-close','position_to_cash',100,100,'stale-position',-100,'2026-08-15')",
    );
    await run(
      "INSERT INTO financial_event_commit (event_id,user_id,write_key) VALUES ('stale-settlement','ledger-u1','stale-close')",
    );
    await run(
      "INSERT INTO financial_event (id,user_id,write_key,kind,amount,position_id,position_delta,equity_delta,note,date) VALUES ('later-up','ledger-u1','later-activity','position_adjustment',10,'stale-position',10,10,'up','2026-08-15'),('later-down','ledger-u1','later-activity','position_adjustment',10,'stale-position',-10,-10,'down','2026-08-15')",
    );
    await run(
      "INSERT INTO financial_event_commit (event_id,user_id,write_key) VALUES ('later-up','ledger-u1','later-activity')",
    );
    await run(
      "INSERT INTO financial_event_commit (event_id,user_id,write_key) VALUES ('later-down','ledger-u1','later-activity')",
    );

    await expectAbort(
      run(
        "INSERT INTO financial_position_closure (id,user_id,position_id,settlement_event_id,write_key,date) VALUES ('stale-close-row','ledger-u1','stale-position','stale-settlement','stale-close','2026-08-15')",
      ),
      "ledger_invalid_close_settlement",
    );
  });

  it("keeps a closure effective until its exact settlement reversal commits", async () => {
    await run(
      "INSERT INTO financial_write_request (user_id,idempotency_key,operation,request_hash,response_json) VALUES ('ledger-u1','correct-close','correct','hash','{}')",
    );
    await run(
      "INSERT INTO financial_position (id,user_id,name,kind,reserve_against_cash) VALUES ('correct-position','ledger-u1','Correct','term_deposit',0)",
    );
    await run(
      "INSERT INTO financial_event (id,user_id,write_key,kind,amount,position_id,position_delta,equity_delta,date) VALUES ('correct-open','ledger-u1','setup','opening_position',100,'correct-position',100,100,'2026-08-01')",
    );
    await run("INSERT INTO financial_event_commit (event_id,user_id,write_key,created_at) VALUES ('correct-open','ledger-u1','setup',unixepoch())");
    await run(
      "INSERT INTO financial_event (id,user_id,write_key,kind,amount,cash_delta,position_id,position_delta,date) VALUES ('correct-settle','ledger-u1','setup','position_to_cash',100,100,'correct-position',-100,'2026-08-15')",
    );
    await run("INSERT INTO financial_event_commit (event_id,user_id,write_key,created_at) VALUES ('correct-settle','ledger-u1','setup',unixepoch())");
    await run(
      "INSERT INTO financial_position_closure (id,user_id,position_id,settlement_event_id,write_key,date) VALUES ('correct-closure','ledger-u1','correct-position','correct-settle','setup','2026-08-15')",
    );
    await run(
      "INSERT INTO financial_event (id,user_id,write_key,kind,amount,cash_delta,position_id,position_delta,reversal_of_event_id,date) VALUES ('settlement-reversal','ledger-u1','correct-close','reversal',100,-100,'correct-position',100,'correct-settle','2026-08-15')",
    );
    await run(
      "INSERT INTO financial_position_closure_reversal (closure_id,user_id,reversal_event_id,write_key) VALUES ('correct-closure','ledger-u1','settlement-reversal','correct-close')",
    );

    await run(
      "INSERT INTO financial_event (id,user_id,write_key,kind,amount,position_id,position_delta,equity_delta,note,date) VALUES ('unrelated-after-lifecycle','ledger-u1','correct-close','position_adjustment',1,'correct-position',1,1,'unrelated','2026-08-16')",
    );
    await expectAbort(
      run(
        "INSERT INTO financial_event_commit (event_id,user_id,write_key,created_at) VALUES ('unrelated-after-lifecycle','ledger-u1','correct-close',unixepoch())",
      ),
      "ledger_position_closed",
    );
    await expectAbort(
      run(
        "INSERT INTO financial_position_closure (id,user_id,position_id,write_key,date) VALUES ('premature-replacement','ledger-u1','correct-position','correct-close','2026-08-15')",
      ),
      "ledger_position_already_closed",
    );
    await run(
      "INSERT INTO financial_event_commit (event_id,user_id,write_key,created_at) VALUES ('settlement-reversal','ledger-u1','correct-close',unixepoch())",
    );
  });

  it("allows deletion only through owning-user erasure", async () => {
    await run(
      "INSERT INTO financial_event (id,user_id,write_key,kind,amount,cash_delta,equity_delta,date) VALUES ('delete-test','ledger-u1','setup','opening_cash',1,1,1,'2026-08-01')",
    );
    await expectAbort(run("DELETE FROM financial_event WHERE id='delete-test'"), "ledger_append_only");
    await run(
      "INSERT INTO financial_event (id,user_id,write_key,kind,amount,position_id,position_delta,equity_delta,date) VALUES ('erase-history','ledger-u2','setup','opening_position',5,'card-u2',-5,-5,'2026-08-01')",
    );
    await run("INSERT INTO financial_event_commit (event_id,user_id,write_key,created_at) VALUES ('erase-history','ledger-u2','setup',unixepoch())");
    await run("DELETE FROM user WHERE id='ledger-u2'");
    expect(
      await env.DB.prepare("SELECT COUNT(*) AS count FROM financial_profile WHERE user_id='ledger-u2'").first(),
    ).toEqual({ count: 0 });
    expect(
      await env.DB.prepare("SELECT COUNT(*) AS count FROM financial_event WHERE user_id='ledger-u2'").first(),
    ).toEqual({ count: 0 });
  });
});
