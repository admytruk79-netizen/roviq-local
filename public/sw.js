const CACHE = 'roviq-shell-v2';

self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(['/', '/css/discovery-recovery.css'])).then(() => self.skipWaiting())); });

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Network-first: always prefer live network responses (the app ships frequent
// updates and serves no-store headers on purpose), only falling back to the
// last-known-good cached copy when the network is unreachable.
self.addEventListener('fetch', event => {
  const req = event.request;
  const path = new URL(req.url).pathname;
  if (path.startsWith('/api/') || path.startsWith('/admin/') || path.startsWith('/submit')) return;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res && res.ok) {
        const cache = await caches.open(CACHE);
        await cache.put(req, res.clone());
      }
      return res;
    } catch {
      const cached = await caches.match(req);
      if (cached) return cached;
      throw new Error('offline and no cached copy');
    }
  })());
});

