/* SaVi Fund Manager — service worker (offline cache + Web Push) */
const CACHE = "savi-v4";          // change this number whenever you upload new files
const ASSETS = ["./Lender.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", e => {
  // one missing file must not block the install
  e.waitUntil(caches.open(CACHE)
    .then(c => Promise.allSettled(ASSETS.map(a => c.add(a))))
    .then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;   // API calls go straight to the network

  // HTML: network first (always the newest version), cache only as the offline fallback
  if (req.destination === "document" || req.url.endsWith(".html")) {
    e.respondWith(fetch(req).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res;
    }).catch(() => caches.match(req).then(hit => hit || caches.match("./Lender.html"))));
    return;
  }
  // icons, manifest: cache first
  e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
});

/* ===== Web Push: show the notification and open the app when tapped ===== */
self.addEventListener("push", event => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) {}
  event.waitUntil(self.registration.showNotification(d.title || "SaVi Fund", {
    body: d.body || "Tap to open",
    icon: "icon-192.png",
    tag: d.tag || "savi",
    renotify: true,
    data: { url: d.url || "Lender.html" }
  }));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "Lender.html", self.registration.scope).href;
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      for (const c of list) { if ("focus" in c) { c.navigate(url); return c.focus(); } }
      return clients.openWindow(url);
    })
  );
});
