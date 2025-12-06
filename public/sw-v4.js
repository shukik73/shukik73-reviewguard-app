const CACHE_NAME = 'reviewguard-v4';
const LEGACY_CACHES = ['reviewguard-v1', 'reviewguard-v2', 'reviewguard-v3'];

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/login.html',
  '/signup.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
      await self.clients.claim();
      
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({ type: 'SW_UPDATED', version: 'v4' });
      });
    })()
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(
          JSON.stringify({ error: 'Offline', message: 'Please check your internet connection' }),
          { headers: { 'Content-Type': 'application/json' }, status: 503 }
        );
      })
    );
    return;
  }

  if (event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then((cached) => {
            if (cached) return cached;
            return caches.match('/index.html').then((indexCached) => {
              if (indexCached) return indexCached;
              return new Response(
                '<!DOCTYPE html><html><head><title>Offline</title></head><body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;"><div><h1>You are offline</h1><p>Please check your internet connection and try again.</p></div></body></html>',
                { headers: { 'Content-Type': 'text/html' }, status: 503 }
              );
            });
          });
        })
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          return cached || new Response('Resource not available offline', { status: 503 });
        });
      })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
