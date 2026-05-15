import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  // /api/test/* routes only exist when PLAYWRIGHT_TEST_SECRET is explicitly set.
  // In production this env var is never configured → every request returns 404,
  // making the routes completely invisible to the outside world.
  if (request.nextUrl.pathname.startsWith("/api/test/")) {
    if (!process.env.PLAYWRIGHT_TEST_SECRET) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }
}

export const config = {
  matcher: "/api/test/:path*",
};
