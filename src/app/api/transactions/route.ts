import type { NextRequest } from "next/server";
import { getDB } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { Errors } from "@/lib/errors";
import {
  parseAmount,
  parseDate,
  parseMonth,
  getMonthFromDate,
  currentMonth,
  isLeafCategory,
} from "@/lib/validators";

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
  const month = parseMonth(p.get("month")) ?? currentMonth();
  const typeFilter = p.get("type");
  const categoryId = p.get("category_id") ? Number(p.get("category_id")) : null;
  const customBudgetId = p.get("custom_budget_id") ? Number(p.get("custom_budget_id")) : null;

  const db = await getDB();
  const userId = session.user.id;

  let sql = `
    SELECT t.id, t.amount, t.type, t.note, t.date, t.monthly_budget_id, t.created_at,
           c.id as cat_id, c.name as cat_name, c.level as cat_level, c.parent_id as cat_parent_id,
           p1.name as cat_p1_name, p2.name as cat_p2_name
    FROM "transaction" t
    JOIN category c ON t.category_id = c.id
    LEFT JOIN category p1 ON c.parent_id = p1.id
    LEFT JOIN category p2 ON p1.parent_id = p2.id`;

  if (customBudgetId) {
    sql += ` JOIN transaction_custom_budget tcb ON tcb.transaction_id = t.id AND tcb.custom_budget_id = ${customBudgetId}`;
  }

  sql += ` WHERE t.user_id = ? AND t.date LIKE ?`;
  const binds: unknown[] = [userId, `${month}-%`];

  if (typeFilter === "expense" || typeFilter === "income") {
    sql += ` AND t.type = ?`;
    binds.push(typeFilter);
  }
  if (categoryId) {
    sql += ` AND t.category_id = ?`;
    binds.push(categoryId);
  }

  sql += ` ORDER BY t.date DESC, t.id DESC`;

  const { results } = await db.prepare(sql).bind(...binds).all<TxnRow>();

  // Fetch custom budgets for all transactions
  let cbMap = new Map<number, { id: number; name: string }[]>();
  if (results.length > 0) {
    const ids = results.map((r) => r.id);
    const placeholders = ids.map(() => "?").join(",");
    const { results: cbRows } = await db
      .prepare(
        `SELECT tcb.transaction_id, cb.id, cb.name FROM transaction_custom_budget tcb JOIN custom_budget cb ON tcb.custom_budget_id = cb.id WHERE tcb.transaction_id IN (${placeholders})`,
      )
      .bind(...ids)
      .all<CbRow>();
    for (const row of cbRows) {
      const list = cbMap.get(row.transaction_id) ?? [];
      list.push({ id: row.id, name: row.name });
      cbMap.set(row.transaction_id, list);
    }
  }

  // Summary always for the full month regardless of filters
  const summary = await db
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END),0) as total_expense, COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END),0) as total_income FROM "transaction" WHERE user_id=? AND date LIKE ?`,
    )
    .bind(userId, `${month}-%`)
    .first<{ total_expense: number; total_income: number }>();

  return Response.json({
    transactions: results.map((r) => formatTransaction(r, cbMap)),
    summary: {
      total_expense: summary?.total_expense ?? 0,
      total_income: summary?.total_income ?? 0,
      savings: (summary?.total_income ?? 0) - (summary?.total_expense ?? 0),
    },
  });
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

  const db = await getDB();
  const userId = session.user.id;

  // Validate category belongs to user and is leaf
  const cat = await db
    .prepare("SELECT id FROM category WHERE id = ? AND user_id = ?")
    .bind(categoryId, userId)
    .first<{ id: number }>();
  if (!cat) return Errors.notFound("Danh mục không tồn tại");

  const leaf = await isLeafCategory(db, categoryId, userId);
  if (!leaf) return Errors.validation("Chỉ được chọn danh mục không có danh mục con");

  // Get monthly budget for expense
  let monthlyBudgetId: number | null = null;
  if (b.type === "expense") {
    const month = getMonthFromDate(date);
    const budget = await db
      .prepare("SELECT id FROM monthly_budget WHERE user_id = ? AND month = ?")
      .bind(userId, month)
      .first<{ id: number }>();
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
    const placeholders = customBudgetIds.map(() => "?").join(",");
    const { results: validBudgets } = await db
      .prepare(
        `SELECT id FROM custom_budget WHERE id IN (${placeholders}) AND user_id = ?`,
      )
      .bind(...customBudgetIds, userId)
      .all<{ id: number }>();
    if (validBudgets.length !== customBudgetIds.length) return Errors.forbidden();
  }

  const note = typeof b.note === "string" ? b.note : null;

  const result = await db
    .prepare(
      `INSERT INTO "transaction" (user_id, amount, type, category_id, note, date, monthly_budget_id) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .bind(userId, amount, b.type, categoryId, note, date, monthlyBudgetId)
    .first<{ id: number }>();

  const txnId = result!.id;

  if (customBudgetIds.length > 0) {
    await db.batch(
      customBudgetIds.map((cbId) =>
        db
          .prepare("INSERT INTO transaction_custom_budget (transaction_id, custom_budget_id) VALUES (?, ?)")
          .bind(txnId, cbId),
      ),
    );
  }

  // Fetch full transaction for response
  const txn = await db
    .prepare(
      `SELECT t.id, t.amount, t.type, t.note, t.date, t.monthly_budget_id, t.created_at,
              c.id as cat_id, c.name as cat_name, c.level as cat_level, c.parent_id as cat_parent_id,
              p1.name as cat_p1_name, p2.name as cat_p2_name
       FROM "transaction" t
       JOIN category c ON t.category_id = c.id
       LEFT JOIN category p1 ON c.parent_id = p1.id
       LEFT JOIN category p2 ON p1.parent_id = p2.id
       WHERE t.id = ?`,
    )
    .bind(txnId)
    .first<TxnRow>();

  const cbMap = new Map<number, { id: number; name: string }[]>();
  if (customBudgetIds.length > 0) {
    const placeholders = customBudgetIds.map(() => "?").join(",");
    const { results: cbRows } = await db
      .prepare(
        `SELECT tcb.transaction_id, cb.id, cb.name FROM transaction_custom_budget tcb JOIN custom_budget cb ON tcb.custom_budget_id = cb.id WHERE tcb.transaction_id IN (${placeholders})`,
      )
      .bind(txnId)
      .all<CbRow>();
    cbMap.set(txnId, cbRows.map((r) => ({ id: r.id, name: r.name })));
  }

  return Response.json({ transaction: formatTransaction(txn!, cbMap) }, { status: 201 });
}
