const CACHE = 'investai-v3';
const ASSETS = [
  '/invest/index.html',
  '/invest/styles.css',
  '/invest/app.js',
  '/invest/manifest.json',
  '/invest/icon.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = e.request.url;
  if (url.includes('api.coingecko.com') ||
      url.includes('api.anthropic.com') ||
      url.includes('finnhub.io')) {
    return;
  }
  // Network-first for app shell so updates apply on reload
  if (url.includes('/invest/')) {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});

self.addEventListener('push', e => {
  const data = e.data?.json() || {};
  e.waitUntil(
    self.registration.showNotification(data.title || 'InvestAI', {
      body: data.body || 'Alerta de inversion',
      icon: '/invest/icon.svg',
      badge: '/invest/icon.svg',
      vibrate: [200, 100, 200]
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow('/invest/index.html'));
});
