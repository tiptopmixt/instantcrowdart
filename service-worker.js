// InstantCrowdChat service worker — app-shell cache, network-first for the shell.
// Realtime/Supabase calls always go to network (never cached).
const CACHE = 'icc-shell-v13';
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/app.js',
  './js/config.js',
  './js/i18n.js',
  './js/mascot.js',
  './js/supabase.js',
  './js/auth.js',
  './js/flags.js',
  './js/router.js',
  './js/data.js',
  './js/realtime.js',
  './js/utils.js',
  './js/legal.js',
  './js/crowd.js',
  './js/locale.js',
  './js/company.js',
  './js/share-card.js',
  './js/fx.js',
  './js/components.js',
  './js/pages/home.js',
  './js/pages/chat.js',
  './js/pages/wall.js',
  './icons/icon-192.svg',
  './icons/icon-512.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Never cache API / realtime / analytics / ads.
  if (url.origin !== location.origin || url.hostname.includes('supabase') || url.hostname.includes('esm.sh')
      || url.hostname.includes('googlesyndication') || url.hostname.includes('anthropic')) {
    return; // let it hit the network directly
  }
  // App shell: NETWORK-FIRST so a new deploy can never mix stale/new modules
  // (a stale mix breaks the whole ES-module graph → blank page). The cache is
  // only a fallback for offline use.
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res && res.status === 200) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request))
  );
});
