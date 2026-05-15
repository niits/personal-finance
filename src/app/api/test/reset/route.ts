import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

type SeedLevel = "minimal" | "categories" | "budget" | "full";

// This route is ONLY active when PLAYWRIGHT_TEST_SECRET is set in the environment.
// It is never reachable on production (the env var is not set there).
export async function POST(request: NextRequest) {
  const secret = process.env.PLAYWRIGHT_TEST_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Test API not enabled" }, { status: 403 });
  }
  if (request.headers.get("X-Test-Secret") !== secret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const userId = process.env.DEV_USER_ID;
  if (!userId) {
    return NextResponse.json({ error: "DEV_USER_ID not set" }, { status: 500 });
  }

  const body = await request.json().catch(() => ({})) as { seed?: SeedLevel | undefined };
  const seed = body.seed;

  const db = await getDB();
  const now = Math.floor(Date.now() / 1000);

  // Wipe all user data (foreign keys are cascade, but transactions reference
  // monthly_budget with ON DELETE RESTRICT, so delete in correct order)
  await db.prepare(`DELETE FROM "transaction" WHERE user_id = ?`).bind(userId).run();
  await db.prepare(`DELETE FROM budget_adjustment WHERE monthly_budget_id IN (SELECT id FROM monthly_budget WHERE user_id = ?)`).bind(userId).run();
  await db.prepare(`DELETE FROM monthly_budget WHERE user_id = ?`).bind(userId).run();
  await db.prepare(`DELETE FROM custom_budget WHERE user_id = ?`).bind(userId).run();
  await db.prepare(`DELETE FROM category WHERE user_id = ?`).bind(userId).run();

  // Ensure user exists
  await db.prepare(
    `INSERT OR IGNORE INTO user (id, name, email, emailVerified, createdAt, updatedAt)
     VALUES (?, ?, ?, 0, ?, ?)`,
  ).bind(userId, "E2E Test", "e2e@test.local", now, now).run();

  if (!seed || seed === "minimal") {
    return NextResponse.json({ ok: true, userId, seeded: "none" });
  }

  // Seed standard categories
  const expenseCats: { name: string; emoji: string }[] = [
    { name: "Ăn uống", emoji: "🍜" },
    { name: "Di chuyển", emoji: "🚗" },
    { name: "Mua sắm", emoji: "🛍️" },
    { name: "Giải trí", emoji: "🎬" },
  ];
  const incomeCats: { name: string; emoji: string }[] = [
    { name: "Lương", emoji: "💰" },
  ];

  const catIds: Record<string, number> = {};
  for (const cat of expenseCats) {
    const row = await db.prepare(
      `INSERT INTO category (user_id, name, emoji, level, type, sort_order) VALUES (?, ?, ?, 1, 'expense', 0) RETURNING id`,
    ).bind(userId, cat.name, cat.emoji).first<{ id: number }>();
    catIds[cat.name] = row!.id;
  }
  for (const cat of incomeCats) {
    const row = await db.prepare(
      `INSERT INTO category (user_id, name, emoji, level, type, sort_order) VALUES (?, ?, ?, 1, 'income', 0) RETURNING id`,
    ).bind(userId, cat.name, cat.emoji).first<{ id: number }>();
    catIds[cat.name] = row!.id;
  }

  if (seed === "categories") {
    return NextResponse.json({ ok: true, userId, seeded: "categories", catIds });
  }

  // Seed monthly budget for current month
  const month = new Date().toISOString().substring(0, 7);
  const budget = await db.prepare(
    `INSERT INTO monthly_budget (user_id, month, amount) VALUES (?, ?, ?) RETURNING id`,
  ).bind(userId, month, 5_000_000).first<{ id: number }>();

  if (seed === "budget") {
    return NextResponse.json({ ok: true, userId, seeded: "budget", catIds, budgetId: budget!.id });
  }

  // Full: also seed some transactions
  const today = new Date().toISOString().substring(0, 10);
  await db.prepare(
    `INSERT INTO "transaction" (user_id, amount, type, category_id, note, date, monthly_budget_id, emoji)
     VALUES (?, ?, 'expense', ?, ?, ?, ?, NULL)`,
  ).bind(userId, 85_000, catIds["Ăn uống"], "Bún bò buổi trưa", today, budget!.id).run();

  await db.prepare(
    `INSERT INTO "transaction" (user_id, amount, type, category_id, note, date, monthly_budget_id)
     VALUES (?, ?, 'income', ?, ?, ?, NULL)`,
  ).bind(userId, 15_000_000, catIds["Lương"], "Lương tháng 5", today).run();

  return NextResponse.json({ ok: true, userId, seeded: "full", catIds, budgetId: budget!.id });
}
