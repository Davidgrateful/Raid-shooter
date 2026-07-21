/* Raid Shooter service worker.
 *
 * Deliberately conservative: this game has a live leaderboard, live chat, a
 * wallet, and on-chain payouts, so serving STALE data would be worse than
 * being offline. The rules:
 *   - API calls (/api/*) and anything cross-origin (RPC, wallet relay,
 *     Base nodes): never touched — always straight to the network.
 *   - Navigations (the HTML doc): network-first, falling back to the last
 *     cached shell only when genuinely offline, so an install still opens.
 *   - Static same-origin GETs (the /game/*.js engine, icons, css chunks):
 *     stale-while-revalidate — instant load, refreshed in the background.
 *
 * Bump CACHE_VERSION on any change here to evict the old cache.
 */
const CACHE_VERSION = 'raid-v1';
const SHELL_URL = '/';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((c) => c.add(SHELL_URL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Only ever handle our own origin. Wallet relays, RPC, Base nodes, CDNs:
  // let the browser do them untouched.
  if (url.origin !== self.location.origin) return;

  // Never cache the API — leaderboard, chat, sessions, payouts must be live.
  if (url.pathname.startsWith('/api/')) return;

  // HTML navigations: network-first so players always get the newest build,
  // with the cached shell as an offline lifeboat.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(SHELL_URL, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(SHELL_URL).then((r) => r || Response.error()))
    );
    return;
  }

  // Static assets: stale-while-revalidate.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
