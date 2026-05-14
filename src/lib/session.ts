import { getAuth } from "./auth";

export async function requireSession(request: Request) {
  // DEV BYPASS: set DEV_USER_ID in .dev.vars to skip auth
  const devUserId = process.env.DEV_USER_ID;
  if (devUserId) {
    return { user: { id: devUserId } } as Awaited<ReturnType<Awaited<ReturnType<typeof getAuth>>["api"]["getSession"]>>;
  }

  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: request.headers });
  return session;
}
