import { createHash, randomBytes } from "crypto";
import { test as base, expect, type Page, type APIRequestContext } from "@playwright/test";

// Shared helpers for the MCP OAuth flow. Registration and token calls go through a
// cookie-less context, as a real MCP client (Claude's servers or the Claude Code
// CLI) never holds the user's cookie. The callback host is never reached;
// Playwright intercepts it.
export const BASE_URL = "http://localhost:8787";
export const REDIRECT_URI = "http://127.0.0.1:9/callback";
export const CLIENT_NAME = "E2E MCP Client";

export const test = base.extend<{ mcpClient: APIRequestContext }>({
  mcpClient: async ({ playwright }, provide) => {
    const context = await playwright.request.newContext({ baseURL: BASE_URL, storageState: { cookies: [], origins: [] } });
    await provide(context);
    await context.dispose();
  },
});

export function pkcePair() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export async function registerClient(request: APIRequestContext): Promise<string> {
  const res = await request.post("/api/auth/mcp/register", {
    data: {
      client_name: CLIENT_NAME,
      redirect_uris: [REDIRECT_URI],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
    },
  });
  expect(res.ok(), await res.text()).toBe(true);
  return (await res.json()).client_id;
}

export function authorizeUrl(clientId: string, challenge: string, extra: Record<string, string> = {}) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    state: "e2e-state",
    scope: "openid profile email offline_access",
    code_challenge: challenge,
    code_challenge_method: "S256",
    ...extra,
  });
  return `/api/auth/mcp/authorize?${params}`;
}

/** Resolves with the callback URL the browser was sent to. */
export function captureCallback(page: Page): Promise<URL> {
  return new Promise((resolve) => {
    void page.route("http://127.0.0.1:9/**", async (route) => {
      resolve(new URL(route.request().url()));
      await route.fulfill({ status: 200, body: "ok" });
    });
  });
}

/** Runs register → consent → PKCE token exchange as the signed-in page user. */
export async function obtainAccessToken(page: Page, mcpClient: APIRequestContext): Promise<string> {
  const clientId = await registerClient(mcpClient);
  const { verifier, challenge } = pkcePair();
  const callback = captureCallback(page);
  await page.goto(authorizeUrl(clientId, challenge));
  await page.getByRole("button", { name: "Cho phép" }).click();
  const code = (await callback).searchParams.get("code");
  const tokenRes = await mcpClient.post("/api/auth/mcp/token", {
    form: { grant_type: "authorization_code", code: code!, redirect_uri: REDIRECT_URI, client_id: clientId, code_verifier: verifier },
  });
  expect(tokenRes.ok(), await tokenRes.text()).toBe(true);
  return (await tokenRes.json()).access_token;
}
