// Increment CACHE_NAME whenever SW logic changes to bust all old caches
const CACHE_NAME = "personal-finance-v2";

// Only cache /_next/static/** — these files have content hashes and are
// truly immutable. Everything else (HTML, API, icons) must go to the network
// because stale HTML after a deploy causes 404s on iOS Safari PWA.
const isImmutableAsset = (pathname) => pathname.startsWith("/_next/static/");

self.addEventListener("install", () => {
  // No HTML pre-caching. Pre-caching navigation responses caused the iOS
  // Safari PWA 404: cached HTML referenced old JS chunk hashes that no
  // longer existed after a fresh deploy.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // API routes: network only — never cache auth-sensitive data.
  // Do NOT fall back to cache on error; a stale 200 response from a
  // logged-out session would show private data to unauthenticated users.
  if (url.pathname.startsWith("/api/")) {
    return; // Let the browser handle it normally
  }

  // Next.js static assets: cache-first (content-hashed, safe forever)
  if (isImmutableAsset(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok) {
              caches
                .open(CACHE_NAME)
                .then((cache) => cache.put(request, response.clone()));
            }
            return response;
          })
      )
    );
    return;
  }

  // Navigation and all other requests: network-first, no caching.
  // This ensures fresh HTML on every page load, which is critical for
  // iOS Safari PWA — stale HTML causes 404 when JS chunk hashes change.
  event.respondWith(fetch(request));
});
