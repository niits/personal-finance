import { ledgerBody, ledgerError, ledgerRequest } from "@/lib/ledger/http";
import { positionReconciliationSchema } from "@/lib/ledger/schemas";
export async function POST(request: Request) {
  const context = await ledgerRequest(request);
  if ("error" in context) return context.error;
  try { return Response.json(await context.service.adjustPosition(
    { userId: context.userId, idempotencyKey: context.idempotencyKey },
    await ledgerBody(request, positionReconciliationSchema),
  ), { status: 201 }); } catch (error) { return ledgerError(error); }
}
