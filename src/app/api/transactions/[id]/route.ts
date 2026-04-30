import type { NextRequest } from "next/server";
import { getDB } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { Errors } from "@/lib/errors";
import {
  parseAmount,
  parseDate,
  getMonthFromDate,
  isLeafCategory,
} from "@/lib/validators";

type Params = Promise<{ id: string }>;

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

async function fetchFullTransaction(db: D1Database, txnId: number) {
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

  if (!txn) return null;

  const { results: cbRows } = await db
    .prepare(
      `SELECT tcb.transaction_id, cb.id, cb.name FROM transaction_custom_budget tcb JOIN custom_budget cb ON tcb.custom_budget_id = cb.id WHERE tcb.transaction_id = ?`,
    )
    .bind(txnId)
    .all<CbRow>();

  return {
    id: txn.id,
    amount: txn.amount,
    type: txn.type,
    category: { id: txn.cat_id, name: txn.cat_name, path: buildCategoryPath(txn) },
    note: txn.note,
    date: txn.date,
    monthly_budget_id: txn.monthly_budget_id,
    custom_budgets: cbRows.map((r) => ({ id: r.id, name: r.name })),
    created_at: txn.created_at,
  };
}

export async function PATCH(request: NextRequest, { params }: { params: Params }) {
  const session = await requireSession(request);
  if (!session) return Errors.unauthorized();

  const { id } = await params;
  const txnId = Number(id);
  if (!Number.isInteger(txnId)) return Errors.notFound();

  const db = await getDB();
  const userId = session.user.id;

  const existing = await db
    .prepare(`SELECT id, type, date, category_id, monthly_budget_id FROM "transaction" WHERE id = ? AND user_id = ?`)
    .bind(txnId, userId)
    .first<{
      id: number;
      type: "expense" | "income";
      date: string;
      category_id: number;
      monthly_budget_id: number | null;
    }>();
  if (!existing) return Errors.notFound("Giao dịch không tồn tại");

  const body = await request.json().catch(() => null);
  if (!body) return Errors.validation("Request body không hợp lệ");

  const b = body as Record<string, unknown>;

  // Resolve final values (use existing if not provided)
  const newType = (b.type as "expense" | "income" | undefined) ?? existing.type;
  if (newType !== "expense" && newType !== "income")
    return Errors.validation("Loại giao dịch phải là 'expense' hoặc 'income'");

  const newDate = b.date !== undefined ? parseDate(b.date) : existing.date;
  if (!newDate) return Errors.validation("Ngày không hợp lệ. Dùng định dạng YYYY-MM-DD");

  const newCategoryId =
    b.category_id !== undefined ? (b.category_id as number) : existing.category_id;
  const newAmount = b.amount !== undefined ? parseAmount(b.amount) : undefined;
  if (b.amount !== undefined && !newAmount)
    return Errors.validation("Số tiền phải là số nguyên lớn hơn 0");

  const newNote = b.note !== undefined ? (typeof b.note === "string" ? b.note : null) : undefined;
  const newCustomBudgetIds: number[] | undefined =
    b.custom_budget_ids !== undefined
      ? Array.isArray(b.custom_budget_ids)
        ? (b.custom_budget_ids as unknown[]).filter((x) => typeof x === "number")
        : []
      : undefined;

  if (newType === "income" && newCustomBudgetIds && newCustomBudgetIds.length > 0)
    return Errors.validation("Giao dịch thu nhập không thể gán vào Custom Budget");

  // Validate category
  if (b.category_id !== undefined) {
    const cat = await db
      .prepare("SELECT id FROM category WHERE id = ? AND user_id = ?")
      .bind(newCategoryId, userId)
      .first<{ id: number }>();
    if (!cat) return Errors.notFound("Danh mục không tồn tại");

    const leaf = await isLeafCategory(db, newCategoryId, userId);
    if (!leaf) return Errors.validation("Chỉ được chọn danh mục không có danh mục con");
  }

  // Resolve monthly_budget_id
  let newMonthlyBudgetId: number | null = existing.monthly_budget_id;

  if (newType === "income") {
    newMonthlyBudgetId = null;
  } else if (
    newType === "expense" &&
    (b.date !== undefined || b.type !== undefined)
  ) {
    const month = getMonthFromDate(newDate);
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
    newMonthlyBudgetId = budget.id;
  }

  // Validate custom budget ownership
  if (newCustomBudgetIds && newCustomBudgetIds.length > 0) {
    const placeholders = newCustomBudgetIds.map(() => "?").join(",");
    const { results: valid } = await db
      .prepare(`SELECT id FROM custom_budget WHERE id IN (${placeholders}) AND user_id = ?`)
      .bind(...newCustomBudgetIds, userId)
      .all<{ id: number }>();
    if (valid.length !== newCustomBudgetIds.length) return Errors.forbidden();
  }

  // Build UPDATE fields
  const setClauses: string[] = [];
  const setBinds: unknown[] = [];

  if (b.amount !== undefined) { setClauses.push("amount = ?"); setBinds.push(newAmount); }
  if (b.type !== undefined) { setClauses.push("type = ?"); setBinds.push(newType); }
  if (b.category_id !== undefined) { setClauses.push("category_id = ?"); setBinds.push(newCategoryId); }
  if (b.note !== undefined) { setClauses.push("note = ?"); setBinds.push(newNote); }
  if (b.date !== undefined) { setClauses.push("date = ?"); setBinds.push(newDate); }

  // Always sync monthly_budget_id when type or date changes
  if (b.type !== undefined || b.date !== undefined) {
    setClauses.push("monthly_budget_id = ?");
    setBinds.push(newMonthlyBudgetId);
  }

  const stmts = [];

  if (setClauses.length > 0) {
    stmts.push(
      db
        .prepare(`UPDATE "transaction" SET ${setClauses.join(", ")} WHERE id = ? AND user_id = ?`)
        .bind(...setBinds, txnId, userId),
    );
  }

  if (newCustomBudgetIds !== undefined) {
    stmts.push(
      db
        .prepare("DELETE FROM transaction_custom_budget WHERE transaction_id = ?")
        .bind(txnId),
    );
  }

  if (stmts.length > 0) await db.batch(stmts);

  if (newCustomBudgetIds && newCustomBudgetIds.length > 0) {
    await db.batch(
      newCustomBudgetIds.map((cbId) =>
        db
          .prepare("INSERT INTO transaction_custom_budget (transaction_id, custom_budget_id) VALUES (?, ?)")
          .bind(txnId, cbId),
      ),
    );
  }

  const updated = await fetchFullTransaction(db, txnId);
  return Response.json({ transaction: updated });
}

export async function DELETE(request: NextRequest, { params }: { params: Params }) {
  const session = await requireSession(request);
  if (!session) return Errors.unauthorized();

  const { id } = await params;
  const txnId = Number(id);
  if (!Number.isInteger(txnId)) return Errors.notFound();

  const db = await getDB();
  const userId = session.user.id;

  const existing = await db
    .prepare(`SELECT id FROM "transaction" WHERE id = ? AND user_id = ?`)
    .bind(txnId, userId)
    .first<{ id: number }>();
  if (!existing) return Errors.notFound("Giao dịch không tồn tại");

  await db
    .prepare(`DELETE FROM "transaction" WHERE id = ? AND user_id = ?`)
    .bind(txnId, userId)
    .run();

  return Response.json({});
}
