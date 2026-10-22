const CACHE_NAME = 'terra-cache-v1';
const urls = [
    "/",
    "/index.html",
    "/css/index.css",
    "/js/app.js"
]

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urls))
    );
});

self.addEventListener("fetch", event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
    );
});