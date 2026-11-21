import { createHash, randomBytes } from "crypto";
import { test as base, expect, type Page, type APIRequestContext } from "@playwright/test";
import { getUserId } from "../db-reset";
import { TEST_EMAIL, TEST_PASSWORD } from "../global-setup";

// Full MCP OAuth flow against production code: dynamic client registration,
// authorization with mandatory consent, PKCE code exchange, and token-to-user
// resolution. The callback host is never reached; Playwright intercepts it.
// Registration and token calls go through a cookie-less context, as a real MCP
// client (Claude's servers or the Claude Code CLI) never holds the user's cookie.
const BASE_URL = "http://localhost:8787";

const test = base.extend<{ mcpClient: APIRequestContext }>({
  mcpClient: async ({ playwright }, provide) => {
    const context = await playwright.request.newContext({ baseURL: BASE_URL, storageState: { cookies: [], origins: [] } });
    await provide(context);
    await context.dispose();
  },
});
const REDIRECT_URI = "http://127.0.0.1:9/callback";
const CLIENT_NAME = "E2E MCP Client";

function pkcePair() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

async function registerClient(request: APIRequestContext): Promise<string> {
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

function authorizeUrl(clientId: string, challenge: string, extra: Record<string, string> = {}) {
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
function captureCallback(page: Page): Promise<URL> {
  return new Promise((resolve) => {
    void page.route("http://127.0.0.1:9/**", async (route) => {
      resolve(new URL(route.request().url()));
      await route.fulfill({ status: 200, body: "ok" });
    });
  });
}

test.describe("MCP OAuth", () => {
  test("discovery metadata advertises the MCP endpoints and the protected resource", async ({ request }) => {
    const server = await (await request.get("/.well-known/oauth-authorization-server")).json();
    expect(server.authorization_endpoint).toBe(`${BASE_URL}/api/auth/mcp/authorize`);
    expect(server.token_endpoint).toBe(`${BASE_URL}/api/auth/mcp/token`);
    expect(server.registration_endpoint).toBe(`${BASE_URL}/api/auth/mcp/register`);
    expect(server.code_challenge_methods_supported).toEqual(["S256"]);

    for (const path of ["/.well-known/oauth-protected-resource", "/.well-known/oauth-protected-resource/api/mcp"]) {
      const resource = await (await request.get(path)).json();
      expect(resource.resource).toBe(`${BASE_URL}/api/mcp`);
      expect(resource.authorization_servers).toEqual([BASE_URL]);
    }
  });

  test("approving consent issues a token that resolves to the signed-in user", async ({ page, mcpClient }) => {
    const clientId = await registerClient(mcpClient);
    const { verifier, challenge } = pkcePair();
    const callback = captureCallback(page);

    await page.goto(authorizeUrl(clientId, challenge));

    await expect(page.getByRole("heading", { name: "Cho phép truy cập" })).toBeVisible();
    const consentRequest = page.getByRole("region", { name: "Yêu cầu truy cập" });
    await expect(consentRequest).toContainText(CLIENT_NAME);
    await expect(consentRequest).toContainText("Chuyển về 127.0.0.1:9");
    await expect(consentRequest).toContainText(TEST_EMAIL);

    await page.getByRole("button", { name: "Cho phép" }).click();
    const callbackUrl = await callback;
    expect(callbackUrl.searchParams.get("state")).toBe("e2e-state");
    const code = callbackUrl.searchParams.get("code");
    expect(code).toBeTruthy();

    const tokenRes = await mcpClient.post("/api/auth/mcp/token", {
      form: {
        grant_type: "authorization_code",
        code: code!,
        redirect_uri: REDIRECT_URI,
        client_id: clientId,
        code_verifier: verifier,
      },
    });
    expect(tokenRes.ok(), await tokenRes.text()).toBe(true);
    const { access_token: accessToken } = await tokenRes.json();
    expect(accessToken).toBeTruthy();

    // The cookie-less context proves the bearer token alone identifies the user.
    const sessionRes = await mcpClient.get("/api/auth/mcp/get-session", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect((await sessionRes.json())?.userId).toBe(getUserId(TEST_EMAIL));
  });

  test("denying consent returns access_denied and issues no code", async ({ page, mcpClient }) => {
    const clientId = await registerClient(mcpClient);
    const { challenge } = pkcePair();
    const callback = captureCallback(page);

    await page.goto(authorizeUrl(clientId, challenge));
    await page.getByRole("button", { name: "Từ chối" }).click();

    const callbackUrl = await callback;
    expect(callbackUrl.searchParams.get("error")).toBe("access_denied");
    expect(callbackUrl.searchParams.get("code")).toBeNull();
  });

  // Email sign-in triggers the same Better Auth resume hook as the GitHub callback,
  // which E2E cannot drive. An expired cookie must not bounce the user away from
  // sign-in (middleware) and lose the pending authorization.
  for (const startingCookie of ["none", "expired"] as const) {
    test(`without a valid session (${startingCookie} cookie), sign-in resumes the authorization at consent`, async ({ browser, mcpClient }) => {
      const context = await browser.newContext({ baseURL: BASE_URL, storageState: { cookies: [], origins: [] } });
      if (startingCookie === "expired") {
        await context.addCookies([{ name: "better-auth.session_token", value: "expired.token", url: BASE_URL }]);
      }
      const page = await context.newPage();
      const clientId = await registerClient(mcpClient);
      const { challenge } = pkcePair();
      const callback = captureCallback(page);

      await page.goto(authorizeUrl(clientId, challenge));

      await expect(page).toHaveURL(/\/sign-in\?.*client_id=/);
      await expect(page.getByText("Một ứng dụng đang yêu cầu quyền truy cập dữ liệu tài chính của bạn.")).toBeVisible();

      const signIn = await page.request.post("/api/auth/sign-in/email", {
        headers: { Origin: BASE_URL },
        data: { email: TEST_EMAIL, password: TEST_PASSWORD },
        maxRedirects: 0,
      });
      expect(signIn.status()).toBe(302);
      const resumeUrl = signIn.headers()["location"];
      expect(resumeUrl).toContain("/oauth/consent?");

      await page.goto(resumeUrl);
      await expect(page.getByRole("region", { name: "Yêu cầu truy cập" })).toContainText(CLIENT_NAME);
      await page.getByRole("button", { name: "Cho phép" }).click();
      expect((await callback).searchParams.get("code")).toBeTruthy();

      await context.close();
    });
  }

  // Regression guard for forceConsentPrompt: a crafted link must never skip consent.
  test("a client asking for prompt=none still gets the consent page", async ({ page, mcpClient }) => {
    const clientId = await registerClient(mcpClient);
    const { challenge } = pkcePair();
    let reachedCallback = false;
    await page.route("http://127.0.0.1:9/**", async (route) => {
      reachedCallback = true;
      await route.fulfill({ status: 200, body: "ok" });
    });

    await page.goto(authorizeUrl(clientId, challenge, { prompt: "none" }));

    await expect(page).toHaveURL(/\/oauth\/consent\?/);
    await expect(page.getByRole("button", { name: "Cho phép" })).toBeVisible();
    expect(reachedCallback).toBe(false);
  });

  test("a consent link without a valid request shows the invalid-link state", async ({ page }) => {
    await page.goto("/oauth/consent?consent_code=bogus&client_id=unknown");

    await expect(page.getByText("Liên kết cấp quyền không hợp lệ hoặc đã hết hạn.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Cho phép" })).toHaveCount(0);
  });
});
