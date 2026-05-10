export class AuthError extends Error {
  readonly status = 401;
  constructor() {
    super("401");
    this.name = "AuthError";
  }
}

export async function fetcher<T>(url: string): Promise<T> {
  const r = await fetch(url);

  if (r.status === 401) {
    // Dispatch a global event so any listener (e.g. SWR onError config)
    // can react — for example, by redirecting to "/" or clearing state.
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("auth:expired"));
    }
    throw new AuthError();
  }

  if (!r.ok) throw new Error(`${r.status}`);
  return r.json() as Promise<T>;
}
