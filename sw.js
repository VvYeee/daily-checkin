const CACHE_NAME = 'vitalcheckin-v34';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

// Network-first with 3s timeout for HTML — prevents hanging on slow networks
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.mode === 'navigate' || (req.method === 'GET' && req.headers.get('accept') && req.headers.get('accept').includes('text/html'))) {
    e.respondWith(
      Promise.race([
        fetch(req).then(resp => {
          if (resp && resp.status === 200) {
            const respClone = resp.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, respClone));
          }
          return resp;
        }),
        new Promise(resolve => setTimeout(() => resolve(null), 3000))
      ]).then(resp => {
        if (resp) return resp;
        // Timeout — fall back to cache
        return caches.match(req).then(cached => cached || caches.match('./'));
      }).catch(() => caches.match(req).then(cached => cached || caches.match('./')))
    );
    return;
  }
  // Cache-first for other assets
  e.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(resp => {
        if (resp && resp.status === 200 && req.method === 'GET') {
          const respClone = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, respClone));
        }
        return resp;
      }).catch(() => cached);
    })
  );
});
