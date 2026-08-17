import { positionActionRoute } from "@/lib/ledger/position-route";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  return positionActionRoute(request, (await params).id, "repay");
}
