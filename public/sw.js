// StellarRec Service Worker
const CACHE_NAME = 'stellarrec-v1';
const urlsToCache = [
  '/',
  '/dashboard.html',
  '/demo.html',
  '/assets/js/dashboard.js',
  '/assets/js/vendor/fuse.min.js',
  '/assets/js/vendor/localforage.min.js',
  '/assets/us_institutions_by_state_2023.json'
];

self.addEventListener('install', function(event) {
  // Perform install steps
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        // Cache hit - return response
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});