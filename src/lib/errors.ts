function err(
  status: number,
  error: string,
  code: string,
  details?: Record<string, unknown>,
) {
  return Response.json({ error, code, ...(details ? { details } : {}) }, { status });
}

// Single-user app: surface the real error so the client can render it. No
// redaction — if you ever add other users, swap this for a generic message.
function serializeError(e: unknown): Record<string, unknown> {
  if (e instanceof Error) {
    const out: Record<string, unknown> = { name: e.name, message: e.message };
    if (e.stack) out.stack = e.stack;
    if ("cause" in e && e.cause !== undefined) out.cause = serializeError(e.cause);
    return out;
  }
  return { value: String(e) };
}

export const Errors = {
  unauthorized: () => err(401, "Unauthorized", "UNAUTHORIZED"),
  forbidden: () => err(403, "Forbidden", "FORBIDDEN"),
  notFound: (msg = "Not found") => err(404, msg, "NOT_FOUND"),
  conflict: (msg: string, code = "CONFLICT", details?: Record<string, unknown>) =>
    err(409, msg, code, details),
  validation: (msg: string, details?: Record<string, unknown>) =>
    err(400, msg, "VALIDATION_ERROR", details),
  internal: (cause?: unknown) => {
    if (cause !== undefined) console.error("[internal]", cause);
    const message =
      cause instanceof Error ? cause.message : cause !== undefined ? String(cause) : "Lỗi hệ thống";
    return err(500, message, "INTERNAL_ERROR", cause !== undefined ? serializeError(cause) : undefined);
  },
};
