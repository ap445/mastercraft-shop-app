// Mastercraft Shop Management — minimal service worker.
//
// This app shows live shop-floor data (jobs, timers, assignments), so this
// worker intentionally does NOT cache pages or API responses — that would
// risk showing stale job data or a stale app after a deploy. Its only job
// is to satisfy the browser's "installable as an app" requirement and to
// let the handful of static icon files load instantly.
const STATIC_CACHE = 'mastercraft-static-v1';
const STATIC_ASSETS = [
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isStaticAsset = STATIC_ASSETS.includes(url.pathname);
  if (isStaticAsset) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
    return;
  }
  // Everything else (pages, API calls, JS/CSS bundles) always goes to the network.
  event.respondWith(fetch(event.request));
});
