import { ledgerBody, ledgerError, ledgerRequest } from "@/lib/ledger/http";
import { incomeRequestSchema } from "@/lib/ledger/schemas";

export async function POST(request: Request) {
  const context = await ledgerRequest(request);
  if ("error" in context) return context.error;
  try {
    const result = await context.service.appendIncome(
      { userId: context.userId, idempotencyKey: context.idempotencyKey },
      await ledgerBody(request, incomeRequestSchema),
    );
    return Response.json(result, { status: 201 });
  } catch (error) {
    return ledgerError(error);
  }
}
