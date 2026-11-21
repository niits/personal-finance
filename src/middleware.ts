import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { pendingAuthorizationUrl } from "@/lib/mcp-oauth";

// Auth pages: redirect to / if already authenticated
const AUTH_PAGES = ["/sign-in", "/forgot-password", "/reset-password"];

// Protected app routes: redirect to /sign-in if unauthenticated
const APP_ROUTES = [
  "/",
  "/budget",
  "/categories",
  "/statistics",
  "/cards",
  "/debts",
  "/account",
];

function isAuthPage(pathname: string): boolean {
  return AUTH_PAGES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export function isAppRoute(pathname: string): boolean {
  return APP_ROUTES.some((p) =>
    p === "/" ? pathname === "/" : pathname === p || pathname.startsWith(p + "/"),
  );
}

export function hasSessionCookie(request: NextRequest): boolean {
  return Boolean(getSessionCookie(request));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuthenticated = hasSessionCookie(request);

  // Rule 1: Auth pages + authenticated → redirect to /
  // Exception: the MCP authorization flow only reaches /sign-in after Better Auth
  // rejected the session, so a cookie here is stale; keep the sign-in page.
  if (isAuthPage(pathname) && isAuthenticated && !pendingAuthorizationUrl(request.nextUrl.searchParams)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Rule 2: App routes + unauthenticated → redirect to /sign-in?from=<pathname>
  if (isAppRoute(pathname) && !isAuthenticated) {
    const loginUrl = new URL("/sign-in", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Rule 3: Everything else → passthrough
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
