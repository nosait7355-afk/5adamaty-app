/**
 * Service Worker — تخزين مؤقت خفيف لغلاف التطبيق (PWA، Phase 10).
 *
 * لا يخزّن استجابات الـAPI أبدًا (بيانات حيّة دائمًا)؛ يخزّن الأصول الثابتة
 * فقط ويقدّم صفحة أوفلاين بسيطة حين ينقطع الاتصال أثناء التنقّل.
 */

const CACHE_NAME = 'khadamaty-shell-v1';
const OFFLINE_URL = '/offline.html';
const SHELL_ASSETS = [OFFLINE_URL, '/icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // لا تخزين لطلبات الـAPI — بيانات حيّة فقط.
  if (url.pathname.startsWith('/api/')) return;

  // تنقّل بين الصفحات: شبكة أولًا، وعند الفشل صفحة أوفلاين.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  // أصول ثابتة (صور، خطوط، حزم Next): كاش أولًا، ثم شبكة، وتُحدَّث الكاش بصمت.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            return response;
          })
      )
    );
  }
});
