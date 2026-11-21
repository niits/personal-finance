import { oAuthProtectedResourceMetadata } from "better-auth/plugins";
import { getAuth } from "@/lib/auth";

// RFC 9728 protected resource metadata. MCP clients request the path-suffixed form
// (/.well-known/oauth-protected-resource/api/mcp) before the bare form, so one
// optional catch-all serves both.
export async function GET(request: Request) {
  const auth = await getAuth();
  return oAuthProtectedResourceMetadata(auth)(request);
}
