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
import { currentBudgetMonth } from "@/lib/validators";

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
    db.prepare(`DELETE FROM finance_account WHERE user_id = ?`).run(userId);
    db.prepare(`DELETE FROM budget_adjustment WHERE monthly_budget_id IN (SELECT id FROM monthly_budget WHERE user_id = ?)`).run(userId);
    db.prepare(`DELETE FROM monthly_budget WHERE user_id = ?`).run(userId);
    db.prepare(`DELETE FROM custom_budget WHERE user_id = ?`).run(userId);
    db.prepare(`DELETE FROM category WHERE user_id = ?`).run(userId);
  })();
  db.pragma("foreign_keys = ON");
  db.close();
}

export type SeedLevel = "minimal" | "categories" | "budget" | "full" | "accounts";

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

  // Budget for the app's CURRENT budget month, not the calendar month — they
  // diverge near month-end (date >= last working day rolls to the next month),
  // which would otherwise leave the dashboard/budget view with no current budget.
  const month = currentBudgetMonth();
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

  if (seed !== "accounts") { db.close(); return; }

  db.transaction(() => {
    const lendCategoryId = Number(db.prepare(
      `INSERT INTO category (user_id, name, level, type, sort_order, system_kind, budget_behavior) VALUES (?, 'Cho vay', 1, 'expense', 0, 'lend', 'non_budget')`,
    ).run(userId).lastInsertRowid);
    const savingsCategoryId = Number(db.prepare(
      `INSERT INTO category (user_id, name, level, type, sort_order, system_kind, budget_behavior) VALUES (?, 'Gửi tiết kiệm', 1, 'expense', 0, 'savings_deposit', 'non_budget')`,
    ).run(userId).lastInsertRowid);
    db.prepare(`INSERT INTO finance_account (id, user_id, type, name, debt_direction) VALUES (?, ?, 'debt', 'Minh', 'lend')`).run("e2e-account-debt-1", userId);
    db.prepare(`INSERT INTO finance_account (id, user_id, type, name) VALUES (?, ?, 'savings', 'Quỹ dự phòng')`).run("e2e-account-savings-1", userId);
    db.prepare(`INSERT INTO "transaction" (user_id, amount, type, category_id, finance_account_id, note, date) VALUES (?, 2000000, 'expense', ?, 'e2e-account-debt-1', 'Cho Minh vay', ?)`)
      .run(userId, lendCategoryId, today);
    db.prepare(`INSERT INTO "transaction" (user_id, amount, type, category_id, finance_account_id, note, date) VALUES (?, 500000, 'income', ?, 'e2e-account-debt-1', 'Minh trả một phần', ?)`)
      .run(userId, catIds["Lương"], today);
    db.prepare(`INSERT INTO "transaction" (user_id, amount, type, category_id, finance_account_id, note, date) VALUES (?, 2000000, 'expense', ?, 'e2e-account-savings-1', 'Gửi quỹ dự phòng', ?)`)
      .run(userId, savingsCategoryId, today);
  })();

  db.close();
}
