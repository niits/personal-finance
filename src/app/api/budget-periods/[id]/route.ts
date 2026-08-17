import { ledgerBody, ledgerError, ledgerRequest } from "@/lib/ledger/http";
import { budgetPeriodPatchSchema } from "@/lib/ledger/schemas";
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, { params }: Context) {
  const context = await ledgerRequest(request);
  if ("error" in context) return context.error;
  try { return Response.json(await context.service.patchBudgetPeriod(
    { userId: context.userId, idempotencyKey: context.idempotencyKey },
    Number((await params).id), await ledgerBody(request, budgetPeriodPatchSchema),
  )); } catch (error) { return ledgerError(error); }
}
