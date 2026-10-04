function err(
  status: number,
  error: string,
  code: string,
  details?: Record<string, unknown>,
) {
  return Response.json({ error, code, ...(details ? { details } : {}) }, { status });
}

export const Errors = {
  unauthorized: () => err(401, "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", "UNAUTHORIZED"),
  forbidden: () => err(403, "Bạn không có quyền thực hiện thao tác này.", "FORBIDDEN"),
  notFound: (msg = "Không tìm thấy dữ liệu được yêu cầu.") => err(404, msg, "NOT_FOUND"),
  conflict: (msg: string, code = "CONFLICT", details?: Record<string, unknown>) =>
    err(409, msg, code, details),
  validation: (msg: string, details?: Record<string, unknown>) =>
    err(400, msg, "VALIDATION_ERROR", details),
  internal: (cause?: unknown) => {
    if (cause !== undefined) console.error("[internal]", cause);
    return err(500, "Không thể xử lý yêu cầu. Vui lòng thử lại.", "INTERNAL_ERROR");
  },
};
