import { ledgerBody, ledgerError, ledgerRequest } from "@/lib/ledger/http";
import { reverseRequestSchema } from "@/lib/ledger/schemas";
type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, { params }: Context) {
  const context = await ledgerRequest(request);
  if ("error" in context) return context.error;
  try { return Response.json(await context.service.closeCustomBudget(
    { userId: context.userId, idempotencyKey: context.idempotencyKey }, (await params).id,
    await ledgerBody(request, reverseRequestSchema),
  ), { status: 201 }); } catch (error) { return ledgerError(error); }
}
