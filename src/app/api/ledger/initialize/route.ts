import { ledgerBody, ledgerError, ledgerRequest } from "@/lib/ledger/http";
import { initializeRequestSchema } from "@/lib/ledger/schemas";

export async function POST(request: Request) {
  const context = await ledgerRequest(request);
  if ("error" in context) return context.error;
  try {
    const result = await context.service.initialize(
      { userId: context.userId, idempotencyKey: context.idempotencyKey },
      await ledgerBody(request, initializeRequestSchema),
    );
    return Response.json({
      profile: result.profile,
      budgetPeriod: result.budgetPeriod,
      positions: result.positions,
    }, { status: 201 });
  } catch (error) {
    return ledgerError(error);
  }
}
