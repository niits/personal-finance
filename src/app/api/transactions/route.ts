import type { NextRequest } from "next/server";
import { getKysely } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { Errors } from "@/lib/errors";
import {
  parseAmount,
  parseDate,
  parseMonth,
  getBudgetMonthForDate,
  getBudgetPeriod,
  currentBudgetMonth,
  isLeafCategory,
} from "@/lib/validators";
import { sql } from "kysely";

type TxnRow = {
  id: number;
  amount: number;
  type: "expense" | "income";
  note: string | null;
  date: string;
  monthly_budget_id: number | null;
  created_at: number;
  cat_id: number;
  cat_name: string;
  cat_level: number;
  cat_parent_id: number | null;
  cat_p1_name: string | null;
  cat_p2_name: string | null;
};

type CbRow = { transaction_id: number; id: number; name: string };

function buildCategoryPath(row: TxnRow) {
  if (row.cat_level === 1) return row.cat_name;
  if (row.cat_level === 2) return `${row.cat_p1_name} > ${row.cat_name}`;
  return `${row.cat_p2_name} > ${row.cat_p1_name} > ${row.cat_name}`;
}

function formatTransaction(row: TxnRow, cbMap: Map<number, { id: number; name: string }[]>) {
  return {
    id: row.id,
    amount: row.amount,
    type: row.type,
    category: {
      id: row.cat_id,
      name: row.cat_name,
      path: buildCategoryPath(row),
    },
    note: row.note,
    date: row.date,
    monthly_budget_id: row.monthly_budget_id,
    custom_budgets: cbMap.get(row.id) ?? [],
    created_at: row.created_at,
  };
}

export async function GET(request: NextRequest) {
  const session = await requireSession(request);
  if (!session) return Errors.unauthorized();

  const p = request.nextUrl.searchParams;
  const month = parseMonth(p.get("month")) ?? currentBudgetMonth();
  const typeFilter = p.get("type");
  const categoryId = p.get("category_id") ? Number(p.get("category_id")) : null;
  const customBudgetId = p.get("custom_budget_id") ? Number(p.get("custom_budget_id")) : null;

  const db = await getKysely();
  const userId = session.user.id;

  const mb = await db
    .selectFrom("monthly_budget")
    .select(["id", "start_date", "end_date"])
    .where("user_id", "=", userId)
    .where("month", "=", month)
    .executeTakeFirst();

  // Fall back to computed period when budget row missing or dates not yet backfilled
  const { start: txStart, end: txEndExclusive } = getBudgetPeriod(month);
  const useStoredDates = mb && mb.start_date && mb.end_date;

  let query = db
    .selectFrom("transaction as t")
    .innerJoin("category as c", "c.id", "t.category_id")
    .leftJoin("category as p1", "p1.id", "c.parent_id")
    .leftJoin("category as p2", "p2.id", "p1.parent_id")
    .select([
      "t.id",
      "t.amount",
      "t.type",
      "t.note",
      "t.date",
      "t.monthly_budget_id",
      "t.created_at",
      "c.id as cat_id",
      "c.name as cat_name",
      "c.level as cat_level",
      "c.parent_id as cat_parent_id",
      "p1.name as cat_p1_name",
      "p2.name as cat_p2_name",
    ])
    .where("t.user_id", "=", userId);

  if (customBudgetId) {
    query = query.innerJoin("transaction_custom_budget as tcb", (join) =>
      join
        .onRef("tcb.transaction_id", "=", "t.id")
        .on("tcb.custom_budget_id", "=", customBudgetId),
    );
  }

  if (useStoredDates) {
    query = query
      .where("t.date", ">=", mb.start_date!)
      .where("t.date", "<=", mb.end_date!);
  } else {
    query = query
      .where("t.date", ">=", txStart)
      .where("t.date", "<", txEndExclusive);
  }

  if (typeFilter === "expense" || typeFilter === "income") {
    query = query.where("t.type", "=", typeFilter);
  }
  if (categoryId) {
    query = query.where("t.category_id", "=", categoryId);
  }

  query = query.orderBy("t.date", "desc").orderBy("t.id", "desc");

  const results = (await query.execute()) as TxnRow[];

  // Fetch custom budgets for all transactions
  const cbMap = new Map<number, { id: number; name: string }[]>();
  if (results.length > 0) {
    const ids = results.map((r) => r.id);
    const cbRows = (await db
      .selectFrom("transaction_custom_budget as tcb")
      .innerJoin("custom_budget as cb", "cb.id", "tcb.custom_budget_id")
      .select(["tcb.transaction_id", "cb.id", "cb.name"])
      .where("tcb.transaction_id", "in", ids)
      .execute()) as CbRow[];
    for (const row of cbRows) {
      const list = cbMap.get(row.transaction_id) ?? [];
      list.push({ id: row.id, name: row.name });
      cbMap.set(row.transaction_id, list);
    }
  }

  // Summary always for the full budget period regardless of filters
  let summaryQuery = db
    .selectFrom("transaction")
    .select([
      sql<number>`COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END),0)`.as("total_expense"),
      sql<number>`COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END),0)`.as("total_income"),
    ])
    .where("user_id", "=", userId);

  if (useStoredDates) {
    summaryQuery = summaryQuery
      .where("date", ">=", mb.start_date!)
      .where("date", "<=", mb.end_date!);
  } else {
    summaryQuery = summaryQuery
      .where("date", ">=", txStart)
      .where("date", "<", txEndExclusive);
  }

  const summary = await summaryQuery.executeTakeFirst();

  const isPastMonth = month !== currentBudgetMonth();
  const cacheHeader = isPastMonth ? "private, max-age=86400" : "no-store";

  return Response.json({
    transactions: results.map((r) => formatTransaction(r, cbMap)),
    summary: {
      total_expense: summary?.total_expense ?? 0,
      total_income: summary?.total_income ?? 0,
      savings: (summary?.total_income ?? 0) - (summary?.total_expense ?? 0),
    },
  }, { headers: { "Cache-Control": cacheHeader } });
}

export async function POST(request: NextRequest) {
  const session = await requireSession(request);
  if (!session) return Errors.unauthorized();

  const body = await request.json().catch(() => null);
  if (!body) return Errors.validation("Request body không hợp lệ");

  const b = body as Record<string, unknown>;
  const amount = parseAmount(b.amount);
  if (!amount) return Errors.validation("Số tiền phải là số nguyên lớn hơn 0");

  if (b.type !== "expense" && b.type !== "income")
    return Errors.validation("Loại giao dịch phải là 'expense' hoặc 'income'");

  const date = parseDate(b.date);
  if (!date) return Errors.validation("Ngày không hợp lệ. Dùng định dạng YYYY-MM-DD");

  const categoryId = typeof b.category_id === "number" ? b.category_id : null;
  if (!categoryId) return Errors.validation("category_id là bắt buộc");

  const customBudgetIds: number[] =
    b.type === "expense" && Array.isArray(b.custom_budget_ids)
      ? (b.custom_budget_ids as unknown[]).filter((x) => typeof x === "number")
      : [];

  if (b.type === "income" && Array.isArray(b.custom_budget_ids) && b.custom_budget_ids.length > 0)
    return Errors.validation("Giao dịch thu nhập không thể gán vào Custom Budget");

  const db = await getKysely();
  const userId = session.user.id;

  // Validate category belongs to user and is leaf
  const cat = await db
    .selectFrom("category")
    .select("id")
    .where("id", "=", categoryId)
    .where("user_id", "=", userId)
    .executeTakeFirst();
  if (!cat) return Errors.notFound("Danh mục không tồn tại");

  const leaf = await isLeafCategory(db, categoryId, userId);
  if (!leaf) return Errors.validation("Chỉ được chọn danh mục không có danh mục con");

  // Get monthly budget for expense
  let monthlyBudgetId: number | null = null;
  if (b.type === "expense") {
    const month = getBudgetMonthForDate(date);
    const budget = await db
      .selectFrom("monthly_budget")
      .select("id")
      .where("user_id", "=", userId)
      .where("month", "=", month)
      .executeTakeFirst();
    if (!budget) {
      return Response.json(
        {
          error: `Chưa có budget tháng ${month}. Vui lòng tạo budget trước.`,
          code: "MONTHLY_BUDGET_MISSING",
          details: { month },
        },
        { status: 400 },
      );
    }
    monthlyBudgetId = budget.id;
  }

  // Validate custom budget ownership
  if (customBudgetIds.length > 0) {
    const validBudgets = await db
      .selectFrom("custom_budget")
      .select("id")
      .where("id", "in", customBudgetIds)
      .where("user_id", "=", userId)
      .execute();
    if (validBudgets.length !== customBudgetIds.length) return Errors.forbidden();
  }

  const note = typeof b.note === "string" ? b.note : null;

  const result = await db
    .insertInto("transaction")
    .values({
      user_id: userId,
      amount,
      type: b.type as "expense" | "income",
      category_id: categoryId,
      note,
      date,
      monthly_budget_id: monthlyBudgetId,
    })
    .returning("id")
    .executeTakeFirst();

  const txnId = result!.id;

  if (customBudgetIds.length > 0) {
    await db
      .insertInto("transaction_custom_budget")
      .values(customBudgetIds.map((cbId) => ({ transaction_id: txnId, custom_budget_id: cbId })))
      .execute();
  }

  // Fetch full transaction for response
  const txn = (await db
    .selectFrom("transaction as t")
    .innerJoin("category as c", "c.id", "t.category_id")
    .leftJoin("category as p1", "p1.id", "c.parent_id")
    .leftJoin("category as p2", "p2.id", "p1.parent_id")
    .select([
      "t.id",
      "t.amount",
      "t.type",
      "t.note",
      "t.date",
      "t.monthly_budget_id",
      "t.created_at",
      "c.id as cat_id",
      "c.name as cat_name",
      "c.level as cat_level",
      "c.parent_id as cat_parent_id",
      "p1.name as cat_p1_name",
      "p2.name as cat_p2_name",
    ])
    .where("t.id", "=", txnId)
    .executeTakeFirst()) as TxnRow;

  const cbMap = new Map<number, { id: number; name: string }[]>();
  if (customBudgetIds.length > 0) {
    const cbRows = (await db
      .selectFrom("transaction_custom_budget as tcb")
      .innerJoin("custom_budget as cb", "cb.id", "tcb.custom_budget_id")
      .select(["tcb.transaction_id", "cb.id", "cb.name"])
      .where("tcb.transaction_id", "=", txnId)
      .execute()) as CbRow[];
    cbMap.set(txnId, cbRows.map((r) => ({ id: r.id, name: r.name })));
  }

  return Response.json({ transaction: formatTransaction(txn!, cbMap) }, { status: 201 });
}
