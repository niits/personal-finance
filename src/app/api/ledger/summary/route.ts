import { ledgerError, ledgerRequest } from "@/lib/ledger/http";

export async function GET(request: Request) {
  const context = await ledgerRequest(request);
  if ("error" in context) return context.error;
  try {
    const url = new URL(request.url);
    const periodIdValue = url.searchParams.get("periodId");
    const result = await context.service.summaryReadModel(
      context.userId,
      url.searchParams.get("asOf") ?? "",
      periodIdValue === null ? undefined : Number(periodIdValue),
    );
    return Response.json(result);
  } catch (error) {
    return ledgerError(error);
  }
}
