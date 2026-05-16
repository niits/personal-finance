import { describe, expect, it } from "vitest";
import type { NextRequest } from "next/server";
import { hasSessionCookie } from "./middleware";

function createRequest(cookieHeader: string): NextRequest {
  return {
    headers: {
      get: (name: string) => (name.toLowerCase() === "cookie" ? cookieHeader : null),
    },
  } as NextRequest;
}

describe("hasSessionCookie", () => {
  it("recognizes the local Better Auth session cookie", () => {
    expect(hasSessionCookie(createRequest("better-auth.session_token=abc123"))).toBe(true);
  });

  it("recognizes the secure Better Auth session cookie", () => {
    expect(hasSessionCookie(createRequest("__Secure-better-auth.session_token=abc123"))).toBe(true);
  });

  it("recognizes the hyphenated Better Auth session cookie", () => {
    expect(hasSessionCookie(createRequest("better-auth-session_token=abc123"))).toBe(true);
  });

  it("ignores non-session Better Auth cookies", () => {
    expect(hasSessionCookie(createRequest("better-auth.session_data=abc123"))).toBe(false);
  });
});
