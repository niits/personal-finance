import { NextRequest, NextResponse } from "next/server";

// Cookie name matches better-auth's default: prefix "better-auth", name "session_token"
const SESSION_COOKIE = "better-auth.session_token";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get(SESSION_COOKIE);
  const isAuthenticated = Boolean(sessionCookie?.value);

  // Redirect authenticated users away from auth pages
  if (isAuthenticated && pathname.startsWith("/sign-in")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Redirect unauthenticated users away from protected pages.
  // Lightweight presence check — expiry validation still happens
  // server-side in requireSession() for every API route.
  if (!isAuthenticated && pathname.startsWith("/dashboard")) {
    const loginUrl = new URL("/sign-in", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/sign-in/:path*", "/sign-in"],
};
