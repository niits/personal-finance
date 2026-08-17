import { ledgerBody, ledgerError, ledgerRequest } from "@/lib/ledger/http";
import { budgetAdjustmentRequestSchema } from "@/lib/ledger/schemas";
type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, { params }: Context) {
  const context = await ledgerRequest(request);
  if ("error" in context) return context.error;
  try { return Response.json(await context.service.adjustBudgetPeriod(
    { userId: context.userId, idempotencyKey: context.idempotencyKey }, Number((await params).id),
    await ledgerBody(request, budgetAdjustmentRequestSchema),
  ), { status: 201 }); } catch (error) { return ledgerError(error); }
}
