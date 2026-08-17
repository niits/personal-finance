import { ledgerBody, ledgerError, ledgerRequest } from "@/lib/ledger/http";
import { budgetPeriodRequestSchema } from "@/lib/ledger/schemas";
export async function GET(request: Request) {
  const context = await ledgerRequest(request);
  if ("error" in context) return context.error;
  try { return Response.json({ budgetPeriods: await context.service.budgetPeriodReadModel(context.userId) }); }
  catch (error) { return ledgerError(error); }
}
export async function POST(request: Request) {
  const context = await ledgerRequest(request);
  if ("error" in context) return context.error;
  try { return Response.json(await context.service.createBudgetPeriod(
    { userId: context.userId, idempotencyKey: context.idempotencyKey },
    await ledgerBody(request, budgetPeriodRequestSchema),
  ), { status: 201 }); }
  catch (error) { return ledgerError(error); }
}
