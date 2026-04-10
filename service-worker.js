const CACHE_NAME = 'moneycalc-v7';
const STATIC_ASSETS = [
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// ── INSTALL: pre-cache static assets ──────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
  // Do NOT call skipWaiting here — let the in-app banner trigger it
});

// ── ACTIVATE: clear old caches, then notify all tabs ─────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => {
        self.clients.claim();
        // Tell every open tab that the new version is live
        self.clients.matchAll({ type: 'window' }).then((clients) => {
          clients.forEach((client) =>
            client.postMessage({ type: 'NEW_VERSION' })
          );
        });
      })
  );
});

// ── FETCH: network-first for HTML, cache-first for everything else ─────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only intercept same-origin requests
  if (url.origin !== self.location.origin) return;

  const isHTML =
    url.pathname === '/' ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('/');

  if (isHTML) {
    // Network-first: always get the freshest HTML when online
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
          return networkResponse;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    // Cache-first: icons, manifest, etc.
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((networkResponse) => {
          if (
            !networkResponse ||
            networkResponse.status !== 200 ||
            networkResponse.type !== 'basic'
          ) {
            return networkResponse;
          }
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
          return networkResponse;
        });
      })
    );
  }
});

// ── MESSAGE: allow the page to trigger skipWaiting ────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
