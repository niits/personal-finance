import type { NextRequest } from "next/server";
import { getKysely } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { Errors } from "@/lib/errors";

export async function GET(request: NextRequest) {
  const session = await requireSession(request);
  if (!session) return Errors.unauthorized();

  const userId = session.user.id;
  const db = await getKysely();

  const [transactions, categories, monthlyBudgets, customBudgets] = await Promise.all([
    db
      .selectFrom("transaction as t")
      .leftJoin("category as c", "c.id", "t.category_id")
      .select([
        "t.id",
        "t.amount",
        "t.type",
        "t.note",
        "t.date",
        "t.created_at",
        "c.name as category_name",
        "c.emoji as category_emoji",
      ])
      .where("t.user_id", "=", userId)
      .orderBy("t.date", "desc")
      .execute(),

    db
      .selectFrom("category")
      .select(["id", "name", "emoji", "type", "level", "sort_order"])
      .where("user_id", "=", userId)
      .orderBy("sort_order")
      .execute(),

    db
      .selectFrom("monthly_budget")
      .select(["id", "month", "amount"])
      .where("user_id", "=", userId)
      .orderBy("month", "desc")
      .execute(),

    db
      .selectFrom("custom_budget")
      .select(["id", "name", "amount", "is_active"])
      .where("user_id", "=", userId)
      .execute(),
  ]);

  const payload = {
    exported_at: new Date().toISOString(),
    transactions,
    categories,
    monthly_budgets: monthlyBudgets,
    custom_budgets: customBudgets,
  };

  const format = new URL(request.url).searchParams.get("format") ?? "json";

  if (format === "csv") {
    const rows = [
      ["id", "date", "type", "amount", "category", "note"].join(","),
      ...transactions.map(t =>
        [
          t.id,
          t.date,
          t.type,
          t.amount,
          `"${(t.category_name ?? "").replace(/"/g, '""')}"`,
          `"${(t.note ?? "").replace(/"/g, '""')}"`,
        ].join(","),
      ),
    ].join("\n");

    return new Response(rows, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="transactions-${new Date().toISOString().substring(0, 10)}.csv"`,
      },
    });
  }

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="finance-export-${new Date().toISOString().substring(0, 10)}.json"`,
    },
  });
}
