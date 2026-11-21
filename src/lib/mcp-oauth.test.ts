import { describe, it, expect } from "vitest";
import { forceConsentPrompt, toConsentRequest } from "./mcp-oauth";

const BASE = "https://finance.example.test";

describe("forceConsentPrompt", () => {
  it("adds prompt=consent to an MCP authorization request", () => {
    const request = new Request(`${BASE}/api/auth/mcp/authorize?client_id=abc&response_type=code&state=s1`);

    const url = new URL(forceConsentPrompt(request).url);

    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("client_id")).toBe("abc");
    expect(url.searchParams.get("state")).toBe("s1");
  });

  it("replaces any prompt value the client sent, because silent authorization must never be possible", () => {
    for (const prompt of ["none", "login", "login consent", ""]) {
      const request = new Request(`${BASE}/api/auth/mcp/authorize?client_id=abc&prompt=${encodeURIComponent(prompt)}`);

      const url = new URL(forceConsentPrompt(request).url);

      expect(url.searchParams.getAll("prompt")).toEqual(["consent"]);
    }
  });

  it("leaves other auth requests untouched", () => {
    const request = new Request(`${BASE}/api/auth/get-session`);

    expect(forceConsentPrompt(request)).toBe(request);
  });

  it("preserves request headers such as the session cookie", () => {
    const request = new Request(`${BASE}/api/auth/mcp/authorize?client_id=abc`, {
      headers: { cookie: "better-auth.session_token=t" },
    });

    expect(forceConsentPrompt(request).headers.get("cookie")).toBe("better-auth.session_token=t");
  });
});

describe("toConsentRequest", () => {
  const client = { name: "Claude", redirectUrls: "https://claude.ai/api/mcp/auth_callback", disabled: 0 };

  it("shows the client name, its redirect host, and the signed-in account", () => {
    expect(toConsentRequest(client, "u@example.com")).toEqual({
      clientName: "Claude",
      redirectHost: "claude.ai",
      accountEmail: "u@example.com",
    });
  });

  it("lists every distinct redirect host so a mismatched name cannot hide where the code goes", () => {
    const multi = { ...client, redirectUrls: "http://localhost:3118/callback,http://localhost:3118/alt,https://evil.example/cb" };

    expect(toConsentRequest(multi, "u@example.com")?.redirectHost).toBe("localhost:3118, evil.example");
  });

  it("returns null for an unknown, disabled, or malformed client", () => {
    expect(toConsentRequest(undefined, "u@example.com")).toBeNull();
    expect(toConsentRequest({ ...client, disabled: 1 }, "u@example.com")).toBeNull();
    expect(toConsentRequest({ ...client, redirectUrls: "not a url" }, "u@example.com")).toBeNull();
  });
});
