/* Mutable content refreshes from the network; hashed assets remain cache-first.
   This cache belongs only to this Pages project, not sibling apps on the origin. */
const CACHE = "speak-smart-v2";
const SCOPE = new URL(self.registration.scope);
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./content/manifest.json"];
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("speak-smart-") && key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== SCOPE.origin || !url.pathname.startsWith(SCOPE.pathname)) return;
  const mutable = request.mode === "navigate" || url.pathname.includes("/content/") || url.pathname.endsWith(".webmanifest");
  const cacheResponse = async (response) => {
    if (response.ok) {
      const cache = await caches.open(CACHE);
      await cache.put(request, response.clone());
      // Keep the offline shell current as well as the requested navigation.
      if (request.mode === "navigate") await cache.put(new URL("index.html", SCOPE).href, response.clone());
    }
    return response;
  };
  const network = async () => {
    const response = await fetch(request);
    if (!response.ok) throw new Error("network-response");
    event.waitUntil(cacheResponse(response.clone()).catch(() => undefined));
    return response;
  };
  const fallback = async () => (await caches.match(request, { cacheName: CACHE })) ||
    (request.mode === "navigate" ? await caches.match(new URL("index.html", SCOPE).href, { cacheName: CACHE }) : undefined) ||
    new Response("Unavailable offline", { status: 503 });
  event.respondWith(mutable ? network().catch(fallback) : caches.match(request, { cacheName: CACHE }).then((hit) => hit || network()).catch(fallback));
});
