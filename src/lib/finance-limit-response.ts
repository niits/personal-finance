/** Convert an atomic database balance rejection into a recoverable API response. */
export async function withFinanceLimit<T>(operation: () => Promise<T>): Promise<T | Response> {
  try {
    return await operation();
  } catch (error) {
    const seen = new Set<Error>();
    let cause: unknown = error;
    while (cause instanceof Error && !seen.has(cause)) {
      seen.add(cause);
      if (cause.message.includes("FINANCE_BALANCE_EXCEEDED")) {
        return Response.json({
          code: "FINANCE_BALANCE_EXCEEDED",
          error: "Thao tác vượt số dư có thể ghi nhận của tài khoản hoặc người liên quan. Vui lòng kiểm tra số dư và các giao dịch đã ghi nhận.",
        }, { status: 422 });
      }
      cause = cause.cause;
    }
    throw error;
  }
}
