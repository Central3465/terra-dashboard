const CACHE_NAME = 'terra-cache-v1';
const urls = [
    "/",
    "/index.html",
    "/css/index.css",
    "/js/app.js",
    "/js/storage.js",
    "/js/identity.js",
    "/js/pomodoro.js",
    "/js/goals.js",
    "/js/weather.js",
    "/js/calendar.js",
    "/js/widgets.js",
    "/js/hackatime.js",
    "/utils/dom.js",
    "/utils/makeDraggable.js",
    "/utils/makeResizable.js"
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