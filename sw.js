const CACHE_NAME = 'tabi-app-shell-v54-day-planner';
const APP_SHELL = [
  './',
  './index.html',
  './app.js?v=20261021-day-planner',
  './photo-links.js?v=20261020-photo-links',
  './cloud-sync.js?v=20261021-day-planner',
  './workspace.js?v=20261020-photo-links',
  './saved-library.js?v=20261021-day-planner',
  './account-backup.js?v=20261020-photo-links',
  './booking-files.js?v=20261020-booking-files',
  './route-order.js?v=20261014-route-organiser',
  './route-assistant.js?v=20261021-day-planner',
  './day-planner.css?v=20261021-day-planner',
  './day-planner-core.js?v=20261021-day-planner',
  './day-planner.js?v=20261021-day-planner',
  './schedule.js',
  './stop-editor.js',
  './stop-editor.css',
  './stay-links.js',
  './stay-links.css',
  './reading.js',
  './reading.css',
  './apple-ui.css',
  './emoji-ui.js',
  './styles.css',
  './refinements.css',
  './features.css',
  './live-tools.css',
  './no-budget.css',
  './links-refine.css',
  './mobile-inputs.css',
  './itinerary-cards.css',
  './nearby-picks.css',
  './nearby-picks-refine.css',
  './saved-places.css',
  './visual-refinement.css',
  './bookings.css',
  './manifest.webmanifest',
  './assets/orbis-icon.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok && new URL(event.request.url).origin === self.location.origin) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
    }
    return response;
  }).catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html'))));
});

