// Pressure Relief Service Worker
const CACHE = 'pr-v25';
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
    // Network-first for HTML (users always get the latest build when online;
    // cache only as offline fallback). Cache-first for same-origin assets.
    if (e.request.method !== 'GET') return;
    const url = new URL(e.request.url);
    const isHTML = e.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/';
    if (isHTML) {
        e.respondWith(
            fetch(e.request).then(resp => {
                const clone = resp.clone();
                caches.open(CACHE).then(c => c.put(e.request, clone));
                return resp;
            }).catch(() => caches.match(e.request))
        );
        return;
    }
    e.respondWith(
        caches.match(e.request).then(hit =>
            hit || fetch(e.request).then(resp => {
                if (resp.ok && url.pathname.includes('/wasm/')) {
                    const clone = resp.clone();
                    caches.open(CACHE).then(c => c.put(e.request, clone));
                }
                return resp;
            }).catch(() => hit)
        )
    );
});
