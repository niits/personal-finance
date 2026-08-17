import { ledgerBody, ledgerError, ledgerRequest } from "@/lib/ledger/http";
import { positionPatchSchema } from "@/lib/ledger/schemas";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  const context = await ledgerRequest(request);
  if ("error" in context) return context.error;
  try {
    return Response.json(await context.service.positionDetail(context.userId, (await params).id));
  } catch (error) {
    return ledgerError(error);
  }
}

export async function PATCH(request: Request, { params }: Context) {
  const context = await ledgerRequest(request);
  if ("error" in context) return context.error;
  try { return Response.json(await context.service.patchPosition(
    { userId: context.userId, idempotencyKey: context.idempotencyKey }, (await params).id,
    await ledgerBody(request, positionPatchSchema),
  )); } catch (error) { return ledgerError(error); }
}
