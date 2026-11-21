import { getAuth } from "@/lib/auth";
import { forceConsentPrompt } from "@/lib/mcp-oauth";

export async function GET(request: Request) {
  const auth = await getAuth();
  return auth.handler(forceConsentPrompt(request));
}

export async function POST(request: Request) {
  const auth = await getAuth();
  return auth.handler(request);
}
