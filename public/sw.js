const CACHE = 'roviq-shell-v3';

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
  // Media range responses (206) cannot be stored in Cache Storage. Stream directly.
  if (req.headers.has('Range') || req.destination === 'video' || req.destination === 'audio' || /\.(mp4|webm|mov|mp3|m4a|ogg)$/i.test(path)) return;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res && res.ok && res.status !== 206) {
        // A cache quota/write failure must never turn a successful fetch into a failed request.
        try { const cache = await caches.open(CACHE); await cache.put(req, res.clone()); }
        catch { /* Keep serving the valid network response. */ }
      }
      return res;
    } catch {
      const cached = await caches.match(req);
      if (cached) return cached;
      throw new Error('offline and no cached copy');
    }
  })());
});

