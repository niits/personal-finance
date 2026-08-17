import { ledgerBody, ledgerError, ledgerRequest } from "@/lib/ledger/http";
import { customBudgetPatchSchema } from "@/lib/ledger/schemas";
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, { params }: Context) {
  const context = await ledgerRequest(request);
  if ("error" in context) return context.error;
  try { return Response.json(await context.service.patchCustomBudget(
    { userId: context.userId, idempotencyKey: context.idempotencyKey }, (await params).id,
    await ledgerBody(request, customBudgetPatchSchema),
  )); } catch (error) { return ledgerError(error); }
}
