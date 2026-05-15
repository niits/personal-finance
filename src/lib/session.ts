import { getAuth } from "./auth";

export async function requireSession(request: Request) {
  const auth = await getAuth();
  return auth.api.getSession({ headers: request.headers });
}
