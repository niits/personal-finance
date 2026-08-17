import { ledgerBody, ledgerError, ledgerRequest } from "@/lib/ledger/http";
import { adjustmentRequestSchema } from "@/lib/ledger/schemas";
type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, { params }: Context) {
  const context = await ledgerRequest(request);
  if ("error" in context) return context.error;
  try { return Response.json(await context.service.adjustCustomBudget(
    { userId: context.userId, idempotencyKey: context.idempotencyKey }, (await params).id,
    await ledgerBody(request, adjustmentRequestSchema),
  ), { status: 201 }); } catch (error) { return ledgerError(error); }
}
