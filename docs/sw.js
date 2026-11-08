// Service worker: guarda el juego en el celular para jugar sin internet.
const CACHE = 'sigilo-202611080954';
const LOCAL = ['./', 'index.html', 'manifest.json', 'pedro_model.js', 'clara_model.js', 'vigia_model.js', 'sereno_model.js',
  'zorro_model.js', 'corona_model.js', 'escenario_model.js', 'trasandino_model.js', 'playa_model.js', 'icons/icon-192.png', 'icons/icon-512.png'];
const CDN = ['https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
  'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js',
  'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/utils/SkeletonUtils.js'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(LOCAL).then(() => Promise.all(CDN.map(u => c.add(new Request(u, { mode: 'cors' })).catch(() => {}))))));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Primero la red para la página (así se ven las actualizaciones), primero el caché para lo demás
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const isPage = req.mode === 'navigate';
  if (isPage) {
    e.respondWith(fetch(req).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put('index.html', cp)); return r; }).catch(() => caches.match('index.html')));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r.ok && (req.url.startsWith(self.location.origin) || CDN.includes(req.url) || req.url.includes('fonts.g'))) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
    return r;
  })));
});
