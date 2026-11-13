/**
 * Service worker: keeps the app shell available offline.
 * Learning content and progress live in IndexedDB, so /api/* is never cached here.
 *
 * Strategy: stale-while-revalidate for the shell — respond from cache
 * instantly, refresh the cache in the background. Bump VERSION to force a
 * clean re-download of the shell.
 */

const VERSION = 'v1';
const CACHE = `microlearning-shell-${VERSION}`;
const SHELL = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/store.js',
  '/sync.js',
  '/render.js',
  '/manifest.webmanifest',
  '/icon.svg',
  '/lib/srs.js',
  '/lib/module-schema.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('microlearning-shell-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  // All navigations get the single-page shell (routing is hash-based).
  const key = req.mode === 'navigate' ? '/index.html' : url.pathname;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(key);
      const network = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(key, res.clone());
          return res;
        })
        .catch(() => null);
      if (cached) {
        event.waitUntil(network);
        return cached;
      }
      return (await network) ?? new Response('Offline and not cached yet.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
    }),
  );
});
