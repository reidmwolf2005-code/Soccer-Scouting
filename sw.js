const CACHE = 'miac-v1';
const PRECACHE = [
  './MIAC Scouting Hub.dc.html',
  './support.js',
  './assets/miac-logo.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  // Only handle same-origin GET requests; pass everything else through
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  // Network-first for Supabase API calls
  if (e.request.url.includes('supabase.co')) return;
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
