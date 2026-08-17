import { ledgerError, ledgerRequest } from "@/lib/ledger/http";

export async function GET(request: Request) {
  const context = await ledgerRequest(request);
  if ("error" in context) return context.error;
  try {
    return Response.json(await context.service.profile(context.userId));
  } catch (error) {
    return ledgerError(error);
  }
}
