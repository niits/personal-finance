import { NextRequest, NextResponse } from "next/server";

// Cookie name matches better-auth's default: prefix "better-auth", name "session_token"
const SESSION_COOKIE = "better-auth.session_token";

export function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE);

  if (!sessionCookie?.value) {
    // Redirect unauthenticated requests to the home/login page.
    // This is a lightweight presence check — expiry validation still
    // happens server-side in requireSession() for every API route.
    const loginUrl = new URL("/sign-in", request.url);
    loginUrl.searchParams.set("from", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
