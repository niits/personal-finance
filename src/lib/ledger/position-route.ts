import { ledgerBody, ledgerError, ledgerRequest } from "./http";
import type { PositionAction } from "./types";
import { movementRequestSchema } from "./schemas";

export async function positionActionRoute(
  request: Request,
  positionId: string,
  action: PositionAction,
) {
  const context = await ledgerRequest(request);
  if ("error" in context) return context.error;
  try {
    const result = await context.service.movePosition(
      { userId: context.userId, idempotencyKey: context.idempotencyKey },
      positionId,
      action,
      await ledgerBody(request, movementRequestSchema),
    );
    return Response.json(result, { status: 201 });
  } catch (error) {
    return ledgerError(error);
  }
}
