import { ledgerError, ledgerRequest } from "@/lib/ledger/http";

export async function GET(request: Request) {
  const context = await ledgerRequest(request);
  if ("error" in context) return context.error;
  try {
    const query = new URL(request.url).searchParams;
    return Response.json(await context.service.eventFeed(context.userId, {
      from: query.get("from") ?? undefined,
      to: query.get("to") ?? undefined,
      limit: query.has("limit") ? Number(query.get("limit")) : undefined,
      cursor: query.get("cursor") ?? undefined,
    }));
  } catch (error) {
    return ledgerError(error);
  }
}
