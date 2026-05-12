const STATIC_CACHE = "pf-static-v1"; // content-addressed /_next/static/* — never needs invalidation
const PAGES_CACHE = "pf-pages-v1";  // HTML pages — offline fallback only
const KNOWN_CACHES = [STATIC_CACHE, PAGES_CACHE];

self.addEventListener("install", () => {
  // No pre-caching: pages may require auth, so cache them as visited instead
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !KNOWN_CACHES.includes(k)).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  // API: skip SW entirely — HTTP Cache-Control headers handle caching
  if (url.pathname.startsWith("/api/")) return;

  // Next.js static chunks: cache-first (URLs are content-addressed with hashes)
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok) {
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, response.clone()));
            }
            return response;
          })
      )
    );
    return;
  }

  // HTML page navigations: network-first, store for offline fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            caches.open(PAGES_CACHE).then((cache) => cache.put(request, response.clone()));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached ?? caches.match("/dashboard"))
        )
    );
  }
});
