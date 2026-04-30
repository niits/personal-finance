import { getAuth } from "./auth";

export async function requireSession(request: Request) {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: request.headers });
  return session;
}
