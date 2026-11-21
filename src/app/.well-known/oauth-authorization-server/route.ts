import { oAuthDiscoveryMetadata } from "better-auth/plugins";
import { getAuth } from "@/lib/auth";

// RFC 8414 authorization server metadata for MCP clients.
export async function GET(request: Request) {
  const auth = await getAuth();
  return oAuthDiscoveryMetadata(auth)(request);
}
