import { ledgerBody, ledgerError, ledgerRequest } from "@/lib/ledger/http";
import { customBudgetRequestSchema } from "@/lib/ledger/schemas";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Context) {
  const context = await ledgerRequest(request);
  if ("error" in context) return context.error;
  try { return Response.json({ customBudgets: await context.service.customBudgetReadModel(context.userId, Number((await params).id)) }); }
  catch (error) { return ledgerError(error); }
}
export async function POST(request: Request, { params }: Context) {
  const context = await ledgerRequest(request);
  if ("error" in context) return context.error;
  try { return Response.json(await context.service.createCustomBudget(
    { userId: context.userId, idempotencyKey: context.idempotencyKey }, Number((await params).id),
    await ledgerBody(request, customBudgetRequestSchema),
  ), { status: 201 }); } catch (error) { return ledgerError(error); }
}
