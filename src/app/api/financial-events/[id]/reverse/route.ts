import { ledgerBody, ledgerError, ledgerRequest } from "@/lib/ledger/http";
import { reverseRequestSchema } from "@/lib/ledger/schemas";
type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, { params }: Context) {
  const context = await ledgerRequest(request);
  if ("error" in context) return context.error;
  try {
    const result = await context.service.reverseEvent(
      { userId: context.userId, idempotencyKey: context.idempotencyKey },
      (await params).id,
      await ledgerBody(request, reverseRequestSchema),
    );
    return Response.json(result, { status: 201 });
  } catch (error) { return ledgerError(error); }
}
