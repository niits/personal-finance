import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  // Local dev convenience guard: prevents accidentally calling /api/test/*
  // without a secret configured. NOT a security mechanism — production safety
  // comes from deploy.yml deleting src/app/api/test/ before the build, so
  // these routes literally do not exist in the production bundle.
  if (request.nextUrl.pathname.startsWith("/api/test/")) {
    if (!process.env.PLAYWRIGHT_TEST_SECRET) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }
}

export const config = {
  matcher: "/api/test/:path*",
};
