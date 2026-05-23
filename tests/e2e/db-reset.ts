/**
 * Direct D1 SQLite access for E2E test setup.
 * Uses better-sqlite3 (already a transitive dep via wrangler) to read/write
 * the local D1 file directly, without spawning a wrangler subprocess.
 * This avoids the SQLite write-lock conflict with the running wrangler dev server.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Database = require("better-sqlite3") as typeof import("better-sqlite3");
import fs from "fs";
import path from "path";

function getDb(): InstanceType<typeof Database> {
  // Wrangler stores local D1 at .wrangler/state/v3/d1/miniflare-D1DatabaseObject/<hash>.sqlite
  const dir = ".wrangler/state/v3/d1/miniflare-D1DatabaseObject";
  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith(".sqlite") && f !== "metadata.sqlite")
    .map(f => path.join(dir, f));
  if (!files[0]) throw new Error("Local D1 SQLite file not found — run the dev server at least once first.");
  return new Database(path.resolve(files[0]));
}

export function getUserId(email: string): string {
  const db = getDb();
  const row = db.prepare("SELECT id FROM user WHERE email = ?").get(email) as { id: string } | undefined;
  db.close();
  if (!row) throw new Error(`No user with email ${email} in local D1`);
  return row.id;
}

export function wipeUserData(userId: string): void {
  const db = getDb();
  // WAL mode allows a concurrent reader (wrangler dev) while we write
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = OFF");
  db.transaction(() => {
    db.prepare(`DELETE FROM "transaction" WHERE user_id = ?`).run(userId);
    db.prepare(`DELETE FROM debt WHERE user_id = ?`).run(userId);
    db.prepare(`DELETE FROM budget_adjustment WHERE monthly_budget_id IN (SELECT id FROM monthly_budget WHERE user_id = ?)`).run(userId);
    db.prepare(`DELETE FROM monthly_budget WHERE user_id = ?`).run(userId);
    db.prepare(`DELETE FROM custom_budget WHERE user_id = ?`).run(userId);
    db.prepare(`DELETE FROM category WHERE user_id = ?`).run(userId);
  })();
  db.pragma("foreign_keys = ON");
  db.close();
}

export type SeedLevel = "minimal" | "categories" | "budget" | "full" | "debts";

export function seedUserData(userId: string, seed: SeedLevel): void {
  if (seed === "minimal") return;

  const db = getDb();
  db.pragma("journal_mode = WAL");

  const expenseCategories = [
    { name: "Ăn uống", emoji: "🍜" },
    { name: "Di chuyển", emoji: "🚗" },
    { name: "Mua sắm", emoji: "🛍️" },
    { name: "Giải trí", emoji: "🎬" },
  ];
  const incomeCategories = [{ name: "Lương", emoji: "💰" }];

  const catIds: Record<string, number> = {};

  const insertCat = db.prepare(
    `INSERT INTO category (user_id, name, emoji, level, type, sort_order) VALUES (?, ?, ?, 1, ?, 0)`,
  );

  db.transaction(() => {
    for (const cat of expenseCategories) {
      const info = insertCat.run(userId, cat.name, cat.emoji, "expense");
      catIds[cat.name] = Number(info.lastInsertRowid);
    }
    for (const cat of incomeCategories) {
      const info = insertCat.run(userId, cat.name, cat.emoji, "income");
      catIds[cat.name] = Number(info.lastInsertRowid);
    }
  })();

  if (seed === "categories") { db.close(); return; }

  const month = new Date().toISOString().substring(0, 7);
  const budgetInfo = db.prepare(
    `INSERT INTO monthly_budget (user_id, month, amount) VALUES (?, ?, 5000000)`,
  ).run(userId, month);
  const budgetId = Number(budgetInfo.lastInsertRowid);

  if (seed === "budget") { db.close(); return; }

  const today = new Date().toISOString().substring(0, 10);
  db.prepare(
    `INSERT INTO "transaction" (user_id, amount, type, category_id, note, date, monthly_budget_id) VALUES (?, 85000, 'expense', ?, 'Bún bò buổi trưa', ?, ?)`,
  ).run(userId, catIds["Ăn uống"], today, budgetId);
  db.prepare(
    `INSERT INTO "transaction" (user_id, amount, type, category_id, note, date, monthly_budget_id) VALUES (?, 15000000, 'income', ?, 'Lương tháng 5', ?, NULL)`,
  ).run(userId, catIds["Lương"], today);

  if (seed !== "debts") { db.close(); return; }

  // Seed two open debts and one settled debt for the debt overview screen
  const lendId = "e2e-debt-lend-1";
  const borrowId = "e2e-debt-borrow-1";
  const settledId = "e2e-debt-settled-1";

  db.transaction(() => {
    db.prepare(
      `INSERT INTO debt (id, user_id, type, party, amount, note) VALUES (?, ?, 'lend', 'Minh', 2000000, 'Cho mượn tiền học')`,
    ).run(lendId, userId);
    db.prepare(
      `INSERT INTO "transaction" (user_id, amount, type, date, debt_id) VALUES (?, 2000000, 'expense', ?, ?)`,
    ).run(userId, today, lendId);
    db.prepare(
      `INSERT INTO "transaction" (user_id, amount, type, date, debt_id, note) VALUES (?, 500000, 'income', ?, ?, 'Trả một phần')`,
    ).run(userId, today, lendId);

    db.prepare(
      `INSERT INTO debt (id, user_id, type, party, amount) VALUES (?, ?, 'borrow', 'Chị Lan', 1000000)`,
    ).run(borrowId, userId);
    db.prepare(
      `INSERT INTO "transaction" (user_id, amount, type, date, debt_id) VALUES (?, 1000000, 'income', ?, ?)`,
    ).run(userId, today, borrowId);

    db.prepare(
      `INSERT INTO debt (id, user_id, type, party, amount, status) VALUES (?, ?, 'lend', 'Anh Tuấn', 500000, 'settled')`,
    ).run(settledId, userId);
    db.prepare(
      `INSERT INTO "transaction" (user_id, amount, type, date, debt_id) VALUES (?, 500000, 'expense', ?, ?)`,
    ).run(userId, today, settledId);
    db.prepare(
      `INSERT INTO "transaction" (user_id, amount, type, date, debt_id) VALUES (?, 500000, 'income', ?, ?)`,
    ).run(userId, today, settledId);
  })();

  db.close();
}
