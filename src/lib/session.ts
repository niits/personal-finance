import { getAuth } from "./auth";

// better-auth lazily creates its AsyncLocalStorage-backed request-state singleton
// (@better-auth/core's ensureAsyncStorage) without a lock. Concurrent requests
// hitting the same Workers isolate can race that init and lose their store mid-call,
// which better-auth surfaces as a generic FAILED_TO_GET_SESSION error even though the
// session itself is valid (upstream: better-auth/better-auth#6613, unresolved as of
// v1.6.9). A single retry lands after the singleton has stabilized.
function isRequestStateRaceError(error: unknown): boolean {
  return (
    error instanceof Object &&
    "body" in error &&
    (error.body as { code?: string } | undefined)?.code === "FAILED_TO_GET_SESSION"
  );
}

type McpAccessToken = { userId?: string | null; accessTokenExpiresAt: Date | string | number };

/**
 * Resolves an MCP OAuth access token (Authorization: Bearer) to its user id.
 * The Better Auth mcp plugin's getMcpSession returns the stored token without
 * checking accessTokenExpiresAt, so expiry is enforced here.
 */
async function getMcpUserId(request: Request): Promise<string | null> {
  const auth = await getAuth();
  const token = (await auth.api.getMcpSession({ headers: request.headers })) as McpAccessToken | null;
  if (!token?.userId) return null;
  if (new Date(token.accessTokenExpiresAt).getTime() <= Date.now()) return null;
  return token.userId;
}

function hasBearerToken(request: Request): boolean {
  return request.headers.get("authorization")?.startsWith("Bearer ") ?? false;
}

/**
 * Returns the authenticated user for a browser session cookie or an MCP bearer
 * token, or null. Routes rely only on `session.user.id`. A bearer token never
 * falls back to the cookie: an invalid token is unauthenticated.
 */
export async function requireSession(request: Request) {
  if (hasBearerToken(request)) {
    const userId = await getMcpUserId(request);
    return userId ? { user: { id: userId } } : null;
  }
  const auth = await getAuth();
  let result;
  try {
    result = await auth.api.getSession({ headers: request.headers });
  } catch (error) {
    if (!isRequestStateRaceError(error)) throw error;
    result = await auth.api.getSession({ headers: request.headers });
  }
  // getSession returns { session, user } or null; guard against partial results
  if (!result?.user?.id) return null;
  return result;
}
