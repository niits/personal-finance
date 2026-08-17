import { ledgerBody, ledgerError, ledgerRequest } from "@/lib/ledger/http";
import { positionRequestSchema } from "@/lib/ledger/schemas";

export async function GET(request: Request) {
  const context = await ledgerRequest(request);
  if ("error" in context) return context.error;
  try {
    const includeClosed = new URL(request.url).searchParams.get("includeClosed") === "true";
    return Response.json(await context.service.positionReadModel(context.userId, includeClosed));
  } catch (error) {
    return ledgerError(error);
  }
}

export async function POST(request: Request) {
  const context = await ledgerRequest(request);
  if ("error" in context) return context.error;
  try {
    const result = await context.service.createPosition(
      { userId: context.userId, idempotencyKey: context.idempotencyKey },
      await ledgerBody(request, positionRequestSchema),
    );
    return Response.json(result, { status: 201 });
  } catch (error) {
    return ledgerError(error);
  }
}
