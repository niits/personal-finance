import { getAuth } from "./auth";

export async function requireSession(request: Request) {
  const auth = await getAuth();
  const result = await auth.api.getSession({ headers: request.headers });
  // getSession returns { session, user } or null; guard against partial results
  if (!result?.user?.id) return null;
  return result;
}
