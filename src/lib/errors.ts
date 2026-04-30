function err(
  status: number,
  error: string,
  code: string,
  details?: Record<string, unknown>,
) {
  return Response.json({ error, code, ...(details ? { details } : {}) }, { status });
}

export const Errors = {
  unauthorized: () => err(401, "Unauthorized", "UNAUTHORIZED"),
  forbidden: () => err(403, "Forbidden", "FORBIDDEN"),
  notFound: (msg = "Not found") => err(404, msg, "NOT_FOUND"),
  conflict: (msg: string, code = "CONFLICT", details?: Record<string, unknown>) =>
    err(409, msg, code, details),
  validation: (msg: string, details?: Record<string, unknown>) =>
    err(400, msg, "VALIDATION_ERROR", details),
  internal: () => err(500, "Lỗi hệ thống", "INTERNAL_ERROR"),
};
