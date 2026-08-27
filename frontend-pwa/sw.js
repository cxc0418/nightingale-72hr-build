const CACHE_NAME = 'nightingale-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/manifest.json'
  // CSS/JS build assets will be injected here in production
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Basic offline fallback strategy: Network first, fallback to cache
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});