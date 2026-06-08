/* SweepStake Live service worker.
 * Strategy:
 *  - App shell (HTML/CSS/JS/icons): cache-first, so the app opens offline.
 *  - API GET requests: network-first with cache fallback, so you see the last
 *    known leaderboard/fixtures when offline.
 *  - API writes & WebSockets: always network (never cached).
 */
const CACHE = "sweepstake-v1";
const SHELL = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Never intercept websockets or non-GET.
  if (request.method !== "GET" || url.protocol === "ws:" || url.protocol === "wss:") return;

  // API GETs: network-first, fall back to cache.
  if (url.pathname.startsWith("/api/")) {
    e.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // App shell & static: cache-first.
  e.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});
