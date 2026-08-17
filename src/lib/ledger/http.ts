import { Errors } from "@/lib/errors";
import { getDB } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { LedgerService, LedgerServiceError } from "./service";
import type { ZodType } from "zod";

export async function ledgerRequest(request: Request) {
  const session = await requireSession(request);
  if (!session) return { error: Errors.unauthorized() } as const;
  return {
    userId: session.user.id,
    service: new LedgerService(await getDB()),
    idempotencyKey: request.headers.get("Idempotency-Key") ?? "",
  } as const;
}

export async function ledgerBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new LedgerServiceError(400, "VALIDATION_ERROR", "Invalid JSON body");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new LedgerServiceError(400, "VALIDATION_ERROR", "Request body failed validation");
  }
  return parsed.data;
}

export function ledgerError(error: unknown): Response {
  if (error instanceof LedgerServiceError) {
    if (error.status === 404) {
      return Response.json({ error: error.message, code: error.code }, { status: 404 });
    }
    if (error.status === 409) return Errors.conflict(error.message, error.code);
    return Response.json({ error: error.message, code: error.code }, { status: error.status });
  }
  return Errors.internal(error);
}
