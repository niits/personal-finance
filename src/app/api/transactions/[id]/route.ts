import type { NextRequest } from "next/server";
import { getKysely } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { Errors } from "@/lib/errors";
import {
  parseAmount,
  parseDate,
  getMonthFromDate,
  isLeafCategory,
} from "@/lib/validators";
import type { Kysely } from "kysely";
import type { Database } from "@/lib/schema";

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

async function fetchFullTransaction(db: Kysely<Database>, txnId: number) {
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
    .executeTakeFirst()) as TxnRow | undefined;

  if (!txn) return null;

  const cbRows = (await db
    .selectFrom("transaction_custom_budget as tcb")
    .innerJoin("custom_budget as cb", "cb.id", "tcb.custom_budget_id")
    .select(["tcb.transaction_id", "cb.id", "cb.name"])
    .where("tcb.transaction_id", "=", txnId)
    .execute()) as CbRow[];

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

  const db = await getKysely();
  const userId = session.user.id;

  const existing = await db
    .selectFrom("transaction")
    .select(["id", "type", "date", "category_id", "monthly_budget_id"])
    .where("id", "=", txnId)
    .where("user_id", "=", userId)
    .executeTakeFirst();
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
      .selectFrom("category")
      .select("id")
      .where("id", "=", newCategoryId)
      .where("user_id", "=", userId)
      .executeTakeFirst();
    if (!cat) return Errors.notFound("Danh mục không tồn tại");

    const leaf = await isLeafCategory(db, newCategoryId, userId);
    if (!leaf) return Errors.validation("Chỉ được chọn danh mục không có danh mục con");
  }

  // Resolve monthly_budget_id
  let newMonthlyBudgetId: number | null = existing.monthly_budget_id;

  if (newType === "income") {
    newMonthlyBudgetId = null;
  } else if (newType === "expense" && (b.date !== undefined || b.type !== undefined)) {
    const month = getMonthFromDate(newDate);
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
    newMonthlyBudgetId = budget.id;
  }

  // Validate custom budget ownership
  if (newCustomBudgetIds && newCustomBudgetIds.length > 0) {
    const valid = await db
      .selectFrom("custom_budget")
      .select("id")
      .where("id", "in", newCustomBudgetIds)
      .where("user_id", "=", userId)
      .execute();
    if (valid.length !== newCustomBudgetIds.length) return Errors.forbidden();
  }

  // Build update object
  const updateValues: Record<string, unknown> = {};
  if (b.amount !== undefined) updateValues.amount = newAmount;
  if (b.type !== undefined) updateValues.type = newType;
  if (b.category_id !== undefined) updateValues.category_id = newCategoryId;
  if (b.note !== undefined) updateValues.note = newNote;
  if (b.date !== undefined) updateValues.date = newDate;
  // Always sync monthly_budget_id when type or date changes
  if (b.type !== undefined || b.date !== undefined) updateValues.monthly_budget_id = newMonthlyBudgetId;

  if (Object.keys(updateValues).length > 0) {
    await db
      .updateTable("transaction")
      .set(updateValues)
      .where("id", "=", txnId)
      .where("user_id", "=", userId)
      .execute();
  }

  if (newCustomBudgetIds !== undefined) {
    await db
      .deleteFrom("transaction_custom_budget")
      .where("transaction_id", "=", txnId)
      .execute();

    if (newCustomBudgetIds.length > 0) {
      await db
        .insertInto("transaction_custom_budget")
        .values(newCustomBudgetIds.map((cbId) => ({ transaction_id: txnId, custom_budget_id: cbId })))
        .execute();
    }
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

  const db = await getKysely();
  const userId = session.user.id;

  const existing = await db
    .selectFrom("transaction")
    .select("id")
    .where("id", "=", txnId)
    .where("user_id", "=", userId)
    .executeTakeFirst();
  if (!existing) return Errors.notFound("Giao dịch không tồn tại");

  await db
    .deleteFrom("transaction")
    .where("id", "=", txnId)
    .where("user_id", "=", userId)
    .execute();

  return Response.json({});
}
