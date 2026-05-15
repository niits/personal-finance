import { describe, it, expect } from "vitest";

// Test the pure routing logic of the service worker without loading the SW file.
// The SW itself runs in a browser ServiceWorker environment and can't be imported
// directly in Node. We extract and test the decision logic here.

function shouldSkipFetch(method: string): boolean {
  return method !== "GET";
}

function routeRequest(pathname: string): "api-skip" | "immutable-cache" | "network-only" {
  if (pathname.startsWith("/api/")) return "api-skip";
  if (pathname.startsWith("/_next/static/")) return "immutable-cache";
  return "network-only";
}

describe("SW routing logic", () => {
  describe("shouldSkipFetch", () => {
    it("skips POST", () => expect(shouldSkipFetch("POST")).toBe(true));
    it("skips DELETE", () => expect(shouldSkipFetch("DELETE")).toBe(true));
    it("does not skip GET", () => expect(shouldSkipFetch("GET")).toBe(false));
  });

  describe("routeRequest", () => {
    it("routes /api/ to api-skip (network only, no cache)", () => {
      expect(routeRequest("/api/transactions")).toBe("api-skip");
      expect(routeRequest("/api/auth/get-session")).toBe("api-skip");
      expect(routeRequest("/api/dashboard")).toBe("api-skip");
    });

    it("routes /_next/static/ to immutable-cache (cache-first)", () => {
      expect(routeRequest("/_next/static/chunks/page.abc123.js")).toBe("immutable-cache");
      expect(routeRequest("/_next/static/css/main.xyz.css")).toBe("immutable-cache");
    });

    it("routes navigation to network-only (never cached)", () => {
      // This is the critical fix: HTML pages must never be cache-first
      expect(routeRequest("/")).toBe("network-only");
      expect(routeRequest("/dashboard")).toBe("network-only");
      expect(routeRequest("/dashboard/categories")).toBe("network-only");
      expect(routeRequest("/dashboard/budget")).toBe("network-only");
    });

    it("routes static assets outside _next to network-only", () => {
      expect(routeRequest("/icons/icon-192.png")).toBe("network-only");
      expect(routeRequest("/manifest.json")).toBe("network-only");
      expect(routeRequest("/favicon.ico")).toBe("network-only");
    });
  });

  describe("immutable asset pattern", () => {
    const isImmutable = (p: string) => p.startsWith("/_next/static/");

    it("matches Next.js chunk files", () => {
      expect(isImmutable("/_next/static/chunks/webpack-abc.js")).toBe(true);
    });

    it("does not match /_next/image", () => {
      expect(isImmutable("/_next/image?url=...")).toBe(false);
    });

    it("does not match /_next/data (SSG data, may change)", () => {
      expect(isImmutable("/_next/data/build-id/page.json")).toBe(false);
    });
  });
});
