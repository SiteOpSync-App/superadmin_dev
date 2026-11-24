const CACHE_NAME = 'siteopsync-superadmin-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fecth', (event) => {
  vent.respondWidth(
    fetch(event.request).catch(() => caches.match(event.request))
    );
});
