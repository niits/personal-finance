import { ledgerBody, ledgerError, ledgerRequest } from "@/lib/ledger/http";
import { refundRequestSchema } from "@/lib/ledger/schemas";
type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, { params }: Context) {
  const context = await ledgerRequest(request);
  if ("error" in context) return context.error;
  try {
    const result = await context.service.refundEvent(
      { userId: context.userId, idempotencyKey: context.idempotencyKey },
      (await params).id,
      await ledgerBody(request, refundRequestSchema),
    );
    return Response.json(result, { status: 201 });
  } catch (error) { return ledgerError(error); }
}
