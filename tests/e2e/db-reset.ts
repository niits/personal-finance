/**
 * Direct D1 database operations for E2E test setup.
 * Uses `wrangler d1 execute --local` to manipulate the SQLite file
 * without going through the app — so CI can use the same production build.
 */
import { execFileSync } from "child_process";

const DB_NAME = "personal-finance-auth";

function wranglerExec(sql: string): unknown[] {
  const out = execFileSync(
    "npx",
    ["wrangler", "d1", "execute", DB_NAME, "--local", "--command", sql, "--json"],
    { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
  );
  const parsed = JSON.parse(out) as Array<{ results: unknown[] }>;
  return parsed[0]?.results ?? [];
}

export function getUserId(email: string): string {
  const rows = wranglerExec(`SELECT id FROM user WHERE email = '${email}'`) as Array<{ id: string }>;
  if (!rows[0]) throw new Error(`No user with email ${email} in local D1`);
  return rows[0].id;
}

export function wipeUserData(userId: string): void {
  wranglerExec(`DELETE FROM "transaction" WHERE user_id = '${userId}'`);
  wranglerExec(`DELETE FROM budget_adjustment WHERE monthly_budget_id IN (SELECT id FROM monthly_budget WHERE user_id = '${userId}')`);
  wranglerExec(`DELETE FROM monthly_budget WHERE user_id = '${userId}'`);
  wranglerExec(`DELETE FROM custom_budget WHERE user_id = '${userId}'`);
  wranglerExec(`DELETE FROM category WHERE user_id = '${userId}'`);
}

export type SeedLevel = "minimal" | "categories" | "budget" | "full";

export function seedUserData(userId: string, seed: SeedLevel): void {
  if (seed === "minimal") return;

  const expenseCategories = [
    { name: "Ăn uống", emoji: "🍜" },
    { name: "Di chuyển", emoji: "🚗" },
    { name: "Mua sắm", emoji: "🛍️" },
    { name: "Giải trí", emoji: "🎬" },
  ];
  const incomeCategories = [{ name: "Lương", emoji: "💰" }];

  const catIds: Record<string, number> = {};

  for (const cat of expenseCategories) {
    const rows = wranglerExec(
      `INSERT INTO category (user_id, name, emoji, level, type, sort_order) VALUES ('${userId}', '${cat.name}', '${cat.emoji}', 1, 'expense', 0) RETURNING id`,
    ) as Array<{ id: number }>;
    catIds[cat.name] = rows[0].id;
  }
  for (const cat of incomeCategories) {
    const rows = wranglerExec(
      `INSERT INTO category (user_id, name, emoji, level, type, sort_order) VALUES ('${userId}', '${cat.name}', '${cat.emoji}', 1, 'income', 0) RETURNING id`,
    ) as Array<{ id: number }>;
    catIds[cat.name] = rows[0].id;
  }

  if (seed === "categories") return;

  const month = new Date().toISOString().substring(0, 7);
  const budgetRows = wranglerExec(
    `INSERT INTO monthly_budget (user_id, month, amount) VALUES ('${userId}', '${month}', 5000000) RETURNING id`,
  ) as Array<{ id: number }>;
  const budgetId = budgetRows[0].id;

  if (seed === "budget") return;

  const today = new Date().toISOString().substring(0, 10);
  wranglerExec(
    `INSERT INTO "transaction" (user_id, amount, type, category_id, note, date, monthly_budget_id) VALUES ('${userId}', 85000, 'expense', ${catIds["Ăn uống"]}, 'Bún bò buổi trưa', '${today}', ${budgetId})`,
  );
  wranglerExec(
    `INSERT INTO "transaction" (user_id, amount, type, category_id, note, date, monthly_budget_id) VALUES ('${userId}', 15000000, 'income', ${catIds["Lương"]}, 'Lương tháng 5', '${today}', NULL)`,
  );
}
