import { describe, expect, it } from "vitest";
import type { NextRequest } from "next/server";
import { hasSessionCookie, isAppRoute } from "./middleware";

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

describe("isAppRoute", () => {
  it.each([
    "/",
    "/budget",
    "/statistics",
    "/cards",
    "/cards/12",
    "/debts",
    "/debts/12",
    "/account",
    "/account/categories",
  ])("protects %s", (pathname) => {
    expect(isAppRoute(pathname)).toBe(true);
  });

  it.each(["/sign-in", "/api/cards", "/cards-public", "/debts-help"])(
    "does not protect %s as an app page",
    (pathname) => {
      expect(isAppRoute(pathname)).toBe(false);
    },
  );
});
