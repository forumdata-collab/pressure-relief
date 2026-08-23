// Pressure Relief Service Worker
const CACHE = 'pr-v19';
// Bump CACHE together with the footer version string in index.html on every HTML change.
const ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './icon-192.png',
    './icon-512.png'
];
// wasm/ is runtime-cached (10MB, only fetch when camera used)

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        )
    );
});

self.addEventListener('fetch', e => {
    // Cache-first for same-origin; network fallback
    if (e.request.method !== 'GET') return;
    e.respondWith(
        caches.match(e.request).then(hit =>
            hit || fetch(e.request).then(resp => {
                // Runtime-cache wasm assets + html
                if (resp.ok && (e.request.url.includes('/wasm/') || e.request.url.endsWith('.html') || e.request.url === location.origin + '/')) {
                    const clone = resp.clone();
                    caches.open(CACHE).then(c => c.put(e.request, clone));
                }
                // Never serve a stale HTML shell from cache when we're online
                return resp;
            }).catch(() => hit)
        )
    );
});
