/*
 * FoodDecode service worker.
 * - API responses (which may contain health data) are NEVER cached: /api/* always goes to the network.
 * - Static assets, OCR engine files and illustrations: cache-first.
 * - Pages: network-first, falling back to the cache, then /offline. Private pages are not cached.
 */
const VERSION = "fd-v2.0.0";
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-pages`;
const PRECACHE_PAGES = ["/", "/offline", "/scan", "/scan/review", "/search", "/learn", "/about", "/compare"];
const PRECACHE_FILES = ["/manifest.webmanifest", "/icon-192.png", "/sample-label.png", "/illustrations/reader.webp", "/illustrations/scanner.webp", "/illustrations/magnifier.webp", "/illustrations/head.webp", "/illustrations/calculator.webp", "/illustrations/chart.webp", "/illustrations/confused.webp"];
const PRIVATE = /^\/(dashboard|profile|history|settings|onboarding|login|register)(\/|$)/;

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const pages = await caches.open(PAGES);
    const stat = await caches.open(STATIC);
    await stat.addAll(PRECACHE_FILES).catch(() => {});
    const assets = new Set();
    for (const url of PRECACHE_PAGES) {
      try {
        const res = await fetch(url, { credentials: "omit" });
        if (!res.ok) continue;
        const html = await res.clone().text();
        await pages.put(url, res);
        for (const m of html.matchAll(/\/_next\/static\/[^"'\s)]+/g)) assets.add(m[0]);
      } catch { /* offline during install */ }
    }
    await Promise.all([...assets].map((a) => stat.add(a).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (!k.startsWith(VERSION)) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // never cache API (health data)

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/ocr/") || url.pathname.startsWith("/illustrations/") || /\.(png|svg|webp|woff2?|webmanifest)$/.test(url.pathname)) {
    e.respondWith((async () => {
      const c = await caches.open(STATIC);
      const hit = await c.match(req, { ignoreSearch: url.pathname.startsWith("/ocr/") });
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    })());
    return;
  }

  if (req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html") || url.searchParams.has("_rsc")) {
    e.respondWith((async () => {
      const c = await caches.open(PAGES);
      try {
        const res = await fetch(req);
        if (res.ok && !PRIVATE.test(url.pathname) && !url.searchParams.has("_rsc")) c.put(url.pathname, res.clone());
        return res;
      } catch {
        return (await c.match(url.pathname)) || (await c.match("/offline")) || new Response("Offline", { status: 503 });
      }
    })());
  }
});
