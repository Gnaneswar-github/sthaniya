/*
 * Nativa service worker: the app keeps working without a connection once it has been opened.
 *
 * - Pages: network first, falling back to the last copy we saw (or the offline page).
 * - Build assets, fonts and local images: cache first — they are content-hashed or static.
 * - Wikimedia photos: stale-while-revalidate, capped, so a trip's pictures survive offline.
 * - API calls and map tiles are never cached: trips are generated live, and OpenStreetMap's
 *   tile policy asks apps not to store tiles in bulk.
 */
const VERSION = "nativa-v1";
const PAGES = `${VERSION}-pages`;
const ASSETS = `${VERSION}-assets`;
const PHOTOS = `${VERSION}-photos`;
const PHOTO_LIMIT = 80;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGES)
      .then((cache) => cache.addAll(["/", "/plan", "/offline"]))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

async function trim(cacheName, limit) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - limit)).map((key) => cache.delete(key)));
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) return;
  if (url.hostname.endsWith("tile.openstreetmap.org")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(PAGES).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match("/offline")) || Response.error()),
    );
    return;
  }

  const sameOriginAsset =
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/_next/static/") || /\.(?:jpg|jpeg|png|webp|svg|woff2?)$/.test(url.pathname));

  if (sameOriginAsset) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(ASSETS).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  if (url.hostname.endsWith("wikimedia.org")) {
    event.respondWith(
      caches.open(PHOTOS).then(async (cache) => {
        const hit = await cache.match(request);
        const network = fetch(request)
          .then((response) => {
            cache.put(request, response.clone()).then(() => trim(PHOTOS, PHOTO_LIMIT));
            return response;
          })
          .catch(() => hit);
        return hit || network;
      }),
    );
  }
});
