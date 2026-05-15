import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

type SeedLevel = "minimal" | "categories" | "budget" | "full";

// The real production guard is deploy.yml deleting this directory before build.
// The secret check here is a local dev safety net only.
export async function POST(request: NextRequest) {
  const secret = process.env.PLAYWRIGHT_TEST_SECRET;
  if (!secret || request.headers.get("X-Test-Secret") !== secret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({})) as { email?: string; seed?: SeedLevel };
  const email = body.email ?? "e2e@test.local";
  const seed = body.seed;

  const db = await getDB();

  // Resolve user ID from email — user must already exist (created via sign-up)
  const user = await db
    .prepare(`SELECT id FROM user WHERE email = ?`)
    .bind(email)
    .first<{ id: string }>();

  if (!user) {
    return NextResponse.json({ error: `No user with email ${email}` }, { status: 404 });
  }

  const userId = user.id;

  // Wipe all user data in dependency order (transactions ref monthly_budget RESTRICT)
  await db.prepare(`DELETE FROM "transaction" WHERE user_id = ?`).bind(userId).run();
  await db.prepare(
    `DELETE FROM budget_adjustment
     WHERE monthly_budget_id IN (SELECT id FROM monthly_budget WHERE user_id = ?)`,
  ).bind(userId).run();
  await db.prepare(`DELETE FROM monthly_budget WHERE user_id = ?`).bind(userId).run();
  await db.prepare(`DELETE FROM custom_budget WHERE user_id = ?`).bind(userId).run();
  await db.prepare(`DELETE FROM category WHERE user_id = ?`).bind(userId).run();

  if (!seed || seed === "minimal") {
    return NextResponse.json({ ok: true, userId, seeded: "none" });
  }

  // Seed standard categories
  const expenseCats = [
    { name: "Ăn uống", emoji: "🍜" },
    { name: "Di chuyển", emoji: "🚗" },
    { name: "Mua sắm", emoji: "🛍️" },
    { name: "Giải trí", emoji: "🎬" },
  ];
  const incomeCats = [{ name: "Lương", emoji: "💰" }];

  const catIds: Record<string, number> = {};
  for (const cat of [...expenseCats]) {
    const row = await db
      .prepare(
        `INSERT INTO category (user_id, name, emoji, level, type, sort_order)
         VALUES (?, ?, ?, 1, 'expense', 0) RETURNING id`,
      )
      .bind(userId, cat.name, cat.emoji)
      .first<{ id: number }>();
    catIds[cat.name] = row!.id;
  }
  for (const cat of incomeCats) {
    const row = await db
      .prepare(
        `INSERT INTO category (user_id, name, emoji, level, type, sort_order)
         VALUES (?, ?, ?, 1, 'income', 0) RETURNING id`,
      )
      .bind(userId, cat.name, cat.emoji)
      .first<{ id: number }>();
    catIds[cat.name] = row!.id;
  }

  if (seed === "categories") {
    return NextResponse.json({ ok: true, userId, seeded: "categories", catIds });
  }

  // Seed monthly budget for current month
  const month = new Date().toISOString().substring(0, 7);
  const budget = await db
    .prepare(`INSERT INTO monthly_budget (user_id, month, amount) VALUES (?, ?, ?) RETURNING id`)
    .bind(userId, month, 5_000_000)
    .first<{ id: number }>();

  if (seed === "budget") {
    return NextResponse.json({ ok: true, userId, seeded: "budget", catIds, budgetId: budget!.id });
  }

  // Full: seed transactions too
  const today = new Date().toISOString().substring(0, 10);
  await db
    .prepare(
      `INSERT INTO "transaction" (user_id, amount, type, category_id, note, date, monthly_budget_id)
       VALUES (?, ?, 'expense', ?, ?, ?, ?)`,
    )
    .bind(userId, 85_000, catIds["Ăn uống"], "Bún bò buổi trưa", today, budget!.id)
    .run();

  await db
    .prepare(
      `INSERT INTO "transaction" (user_id, amount, type, category_id, note, date, monthly_budget_id)
       VALUES (?, ?, 'income', ?, ?, ?, NULL)`,
    )
    .bind(userId, 15_000_000, catIds["Lương"], "Lương tháng 5", today)
    .run();

  return NextResponse.json({ ok: true, userId, seeded: "full", catIds, budgetId: budget!.id });
}
