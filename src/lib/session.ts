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

export async function requireSession(request: Request) {
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
