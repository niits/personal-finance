export const MCP_CONSENT_PAGE = "/oauth/consent";

const AUTHORIZE_PATH = "/api/auth/mcp/authorize";

/**
 * Any client can register through dynamic client registration with its own
 * redirect_uri, and the Better Auth mcp plugin issues a code without asking the
 * user unless the request carries exactly `prompt=consent`. Rewriting every
 * authorization request this way guarantees the user explicitly approves each
 * client on the consent page before a code is issued.
 */
export function forceConsentPrompt(request: Request): Request {
  const url = new URL(request.url);
  if (url.pathname !== AUTHORIZE_PATH) return request;
  url.searchParams.set("prompt", "consent");
  return new Request(url, request);
}

export type OAuthClientRow = { name: string; redirectUrls: string; disabled: number | null };

/** Maps a registered OAuth client to the consent view model; null when it cannot be approved. */
export function toConsentRequest(client: OAuthClientRow | undefined, accountEmail: string) {
  if (!client || client.disabled) return null;
  const hosts = new Set<string>();
  for (const url of client.redirectUrls.split(",")) {
    try {
      hosts.add(new URL(url.trim()).host);
    } catch {
      return null;
    }
  }
  if (hosts.size === 0) return null;
  return { clientName: client.name, redirectHost: [...hosts].join(", "), accountEmail };
}

/**
 * The mcp plugin sends an unauthenticated authorization request to the sign-in page
 * with the original query string. Returns the URL that resumes that authorization,
 * or null when the sign-in page was opened normally.
 */
export function pendingAuthorizationUrl(searchParams: URLSearchParams): string | null {
  if (!searchParams.get("client_id") || !searchParams.get("response_type")) return null;
  return `${AUTHORIZE_PATH}?${searchParams.toString()}`;
}
