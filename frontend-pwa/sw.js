const CACHE_NAME = 'nightingale-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/manifest.json'
  // 生产环境中会把您的 CSS/JS 打包产物加进来
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// 基本的离线降级策略：网络优先，失败则走缓存
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});