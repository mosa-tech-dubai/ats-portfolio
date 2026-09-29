/* ATS — UAE Used Cars Advisor: offline shell.
   The whole advisor is static, so once this is cached the app works with no
   signal — which is the point, since it gets used in basement car parks and
   at auction yards.

   Bump CACHE whenever a precached file changes, or returning visitors keep
   the old copy until the cache is evicted. */
const CACHE = 'ats-advisor-v3';

const PRECACHE = [
  'advisor.html',
  'assets/advisor.css',
  'assets/advisor.js',
  'data/models.json',
  'manifest.webmanifest',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/icon-maskable-512.png',
  'assets/icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      // Individually, so one missing file cannot fail the whole install.
      .then((c) => Promise.allSettled(PRECACHE.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // Page loads: fresh when online, cached shell when not.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('advisor.html')))
    );
    return;
  }

  // Everything else — local assets and the web fonts — stale-while-revalidate:
  // instant from cache, refreshed in the background for the next load.
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((res) => {
          if (res && (res.ok || res.type === 'opaque')) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || net;
    })
  );
});
