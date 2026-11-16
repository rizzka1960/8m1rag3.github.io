/* Offline cache for Рой. CACHE changes whenever any game file changes, so updates reach players. */
const CACHE = 'roy-779f596274';
const FILES = ["./", "audio.js", "game.js", "i18n.js", "index.html", "license.js", "manifest.webmanifest", "platform.js", "fonts/OFL.txt", "fonts/Rubik-cyrillic.woff2", "fonts/Rubik-latin-ext.woff2", "fonts/Rubik-latin.woff2", "fonts/RussoOne-cyrillic.woff2", "fonts/RussoOne-latin-ext.woff2", "fonts/RussoOne-latin.woff2", "icons/apple-touch-icon.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png"];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request)));
});
