import type { NextRequest } from "next/server";
import { getKysely } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { Errors } from "@/lib/errors";
import { repaymentTxType } from "@/lib/debt";

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/transactions/[id]/link
// Body: { debt_id: string }
// Links an existing transaction to a debt as a repayment.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await requireSession(req);
  if (!session) return Errors.unauthorized();

  const { id } = await params;
  const txId = parseInt(id, 10);
  if (isNaN(txId)) return Errors.validation("Invalid transaction id");

  const userId = session.user.id;
  const db = await getKysely();

  let body: Record<string, unknown>;
  try { body = await req.json() as Record<string, unknown>; }
  catch { return Errors.validation("Invalid JSON"); }

  const { debt_id, linked_amount } = body;
  if (typeof debt_id !== "string" || !debt_id)
    return Errors.validation("debt_id is required");

  const linkedAmount = (typeof linked_amount === "number" && Number.isInteger(linked_amount) && linked_amount > 0)
    ? linked_amount : null;

  const tx = await db
    .selectFrom("transaction")
    .select(["id", "type", "debt_id"])
    .where("id", "=", txId)
    .where("user_id", "=", userId)
    .executeTakeFirst();
  if (!tx) return Errors.notFound("Transaction not found");
  if (tx.debt_id !== null)
    return Response.json({ error: "Transaction is already linked to a debt", reason: "already_linked" }, { status: 409 });

  const debt = await db
    .selectFrom("debt")
    .select(["id", "type", "status"])
    .where("id", "=", debt_id)
    .where("user_id", "=", userId)
    .executeTakeFirst();
  if (!debt) return Errors.notFound("Debt not found");
  if (debt.status === "settled")
    return Response.json({ error: "Cannot link to a settled debt", reason: "debt_settled" }, { status: 409 });

  const expectedTxType = repaymentTxType(debt.type);
  if (tx.type !== expectedTxType)
    return Response.json(
      { error: `Transaction type must be '${expectedTxType}' for a ${debt.type} debt repayment`, reason: "wrong_type" },
      { status: 409 },
    );

  await db
    .updateTable("transaction")
    .set({ debt_id, linked_amount: linkedAmount })
    .where("id", "=", txId)
    .execute();

  return Response.json({ ok: true });
}

// DELETE /api/transactions/[id]/link
// Unlinks a transaction from its debt.
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const session = await requireSession(req);
  if (!session) return Errors.unauthorized();

  const { id } = await params;
  const txId = parseInt(id, 10);
  if (isNaN(txId)) return Errors.validation("Invalid transaction id");

  const userId = session.user.id;
  const db = await getKysely();

  const tx = await db
    .selectFrom("transaction")
    .select(["id", "type", "debt_id", "monthly_budget_id"])
    .where("id", "=", txId)
    .where("user_id", "=", userId)
    .executeTakeFirst();
  if (!tx) return Errors.notFound("Transaction not found");
  if (!tx.debt_id)
    return Response.json({ error: "Transaction is not linked to any debt", reason: "not_linked" }, { status: 409 });

  const debt = await db
    .selectFrom("debt")
    .select(["id", "opening_transaction_id"])
    .where("id", "=", tx.debt_id)
    .where("user_id", "=", userId)
    .executeTakeFirst();

  if (debt && debt.opening_transaction_id === txId) {
    // This is the opening transaction — only allow if no repayments exist
    const repaymentCount = await db
      .selectFrom("transaction")
      .select((eb) => eb.fn.countAll<number>().as("n"))
      .where("debt_id", "=", tx.debt_id)
      .where("id", "!=", txId)
      .executeTakeFirst();

    if ((repaymentCount?.n ?? 0) > 0) {
      return Response.json(
        { error: "Remove all repayments before unlinking the opening transaction", reason: "opening_has_repayments" },
        { status: 409 },
      );
    }
  }

  // Unlinking an expense transaction that has no budget would violate the CHECK
  // constraint — reject before writing.
  if (tx.type === "expense" && !tx.monthly_budget_id) {
    return Response.json(
      { error: "This expense transaction has no monthly budget. Assign a budget before unlinking.", reason: "expense_requires_budget" },
      { status: 409 },
    );
  }

  await db
    .updateTable("transaction")
    .set({ debt_id: null })
    .where("id", "=", txId)
    .execute();

  return Response.json({ ok: true });
}
