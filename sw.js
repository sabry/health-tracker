// Health Tracker service worker — makes the app installable and usable
// offline. Same network-first strategy as the other personal apps in this
// workspace: online visitors always get what's actually live; the cache is
// purely an offline fallback, never a trap that can outlive a version bump.
//
// Bump CACHE_VERSION whenever any cached file changes (html/css/js/icons)
// so returning visitors get the update instead of a stale cache.
const CACHE_VERSION = "v2";
const CACHE_NAME = `health-tracker-${CACHE_VERSION}`;

const APP_SHELL = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/app.js",
  "./js/storage.js",
  "./js/util.js",
  "./js/ui.js",
  "./js/charts.js",
  "./js/profile.js",
  "./js/dashboard.js",
  "./js/weight.js",
  "./js/vitals.js",
  "./js/activity.js",
  "./js/exercises.js",
  "./js/heartrate.js",
  "./js/screenings.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL.map((url) => new Request(url, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// Network-first, falling back to cache only when the network is unavailable.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const freshRequest = new Request(event.request, { cache: "reload" });

  event.respondWith(
    fetch(freshRequest)
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
