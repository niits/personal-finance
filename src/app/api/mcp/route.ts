import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { requireSession } from "@/lib/session";
import { createMcpServer } from "@/lib/mcp/server";

// Remote MCP endpoint (stateless Streamable HTTP). Only MCP OAuth bearer tokens are
// accepted: a browser cookie must never authorize tool calls.
export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const authorization = request.headers.get("authorization") ?? "";
  const session = authorization.startsWith("Bearer ") ? await requireSession(request) : null;
  if (!session) {
    const challenge = `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource/api/mcp"`;
    return Response.json(
      { jsonrpc: "2.0", error: { code: -32001, message: "Unauthorized" }, id: null },
      { status: 401, headers: { "WWW-Authenticate": challenge } },
    );
  }

  const server = createMcpServer(origin, authorization);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  return transport.handleRequest(request);
}

// Stateless server: no server-initiated stream (GET) and no session to end (DELETE).
function methodNotAllowed() {
  return Response.json(
    { jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed." }, id: null },
    { status: 405, headers: { Allow: "POST" } },
  );
}

export const GET = methodNotAllowed;
export const DELETE = methodNotAllowed;
