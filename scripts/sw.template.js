// SmartDictation service worker.
// GENERATED into public/sw.js by scripts/build-sw.mjs — edit scripts/sw.template.js instead.
//
// Strategy
//  - install:   precache every app page (static HTML) + the JS/CSS each page references + icons / mascots.
//  - pages:     network-first (fresh when online, 4 s timeout on weak Wi-Fi), cached copy when offline,
//               /offline when a page was never cached.
//  - /_next/static/*: cache-first (file names are content-hashed, so never stale).
//  - /stroke-data/*:  cache-first in a cache kept across versions (filled as characters are used).
//  - RSC (client navigation data): network only — if it fails, Next.js falls back to a full page
//               load, which the page strategy above serves from cache.
//  - updates:   a new version waits until the page asks it to take over ("SKIP_WAITING").

const VERSION = "__VERSION__";
/** URL prefix ("" locally, "/<repo>" on GitHub Pages). ROUTES / STATIC_FILES already include it. */
const BASE = __BASE__;
const PRECACHE = `sd-precache-${VERSION}`;
const RUNTIME = `sd-runtime-${VERSION}`;
const STROKES = "sd-strokes";
const ROUTES = __ROUTES__;
const STATIC_FILES = __STATIC_FILES__;
const OFFLINE_URL = `${BASE}/offline`;
const HOME_URL = `${BASE}/dashboard`;
const ESCAPED_BASE = BASE.replace(/[.*+?^$()|[\]\\{}]/g, "\\$&");
const ASSET_PATTERN = new RegExp(ESCAPED_BASE + "/_next/static/[^\"'\\s\\\\)]+", "g");
const NAV_TIMEOUT_MS = 4000;
const MAX_RUNTIME_ENTRIES = 400;

self.addEventListener("install", (event) => {
  event.waitUntil(precache());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = [PRECACHE, RUNTIME, STROKES];
      for (const key of await caches.keys()) {
        if (key.startsWith("sd-") && !keep.includes(key)) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname === `${BASE}/sw.js`) return;

  if (url.pathname.startsWith(`${BASE}/_next/static/`)) {
    event.respondWith(cacheFirst(request, RUNTIME));
  } else if (url.pathname.startsWith(`${BASE}/stroke-data/`)) {
    event.respondWith(cacheFirst(request, STROKES));
  } else if (request.headers.get("RSC") === "1" || url.searchParams.has("_rsc")) {
    event.respondWith(fetch(request).catch(() => Response.error()));
  } else if (request.mode === "navigate") {
    event.respondWith(page(request, url));
  } else {
    event.respondWith(staleWhileRevalidate(request));
  }
});

async function precache() {
  const cache = await caches.open(PRECACHE);
  const assets = new Set(STATIC_FILES);
  await Promise.all(
    ROUTES.map(async (route) => {
      try {
        const response = await fetch(route, { cache: "no-store" });
        if (!response.ok || response.redirected) return;
        await cache.put(route, response.clone());
        const html = await response.text();
        // Asset URLs in the HTML carry the base path (e.g. /<repo>/_next/static/…).
        for (const match of html.matchAll(ASSET_PATTERN)) assets.add(match[0]);
      } catch {
        // A missing page is not fatal; it will be cached the first time it is visited online.
      }
    }),
  );
  await Promise.all([...assets].map((asset) => cache.add(asset).catch(() => undefined)));
}

/** Cache key for a page: path without trailing slash or query; the app root maps to the dashboard. */
function pageKey(url) {
  const path = url.pathname.replace(/\/$/, "");
  return path === BASE || path === "" ? HOME_URL : path;
}

async function page(request, url) {
  const key = pageKey(url);
  try {
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), NAV_TIMEOUT_MS)),
    ]);
    if (response.ok && !response.redirected && response.type === "basic") {
      const copy = response.clone();
      caches.open(RUNTIME).then((cache) => cache.put(key, copy));
    }
    return response;
  } catch {
    return (
      (await caches.match(key, { ignoreSearch: true })) ||
      (await caches.match(OFFLINE_URL)) ||
      Response.error()
    );
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const copy = response.clone();
    const cache = await caches.open(cacheName);
    await cache.put(request, copy);
    if (cacheName === RUNTIME) await trim(cache);
  }
  return response;
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(RUNTIME).then((cache) => cache.put(request, copy));
      }
      return response;
    })
    .catch(() => cached || Response.error());
  return cached || network;
}

async function trim(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_RUNTIME_ENTRIES; i++) await cache.delete(keys[i]);
}
