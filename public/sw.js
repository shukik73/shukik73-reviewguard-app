// This service worker immediately unregisters itself and clears caches
// to fix legacy cache issues

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', async () => {
  // Delete all caches
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map(name => caches.delete(name)));
  
  // Unregister this service worker
  const registration = await self.registration;
  await registration.unregister();
  
  // Notify all clients to reload
  const clients = await self.clients.matchAll();
  clients.forEach(client => client.navigate(client.url));
});

// Pass all requests through to network
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
