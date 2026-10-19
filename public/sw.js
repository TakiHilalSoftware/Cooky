// Cooky's service worker. Deliberately small (PRD §4, ARCHITECTURE §5.15):
// it caches only the static offline page and its script, never a private
// page or API response. When a page can't load (no connection), it serves
// the offline page, which shows this person's list from IndexedDB.
const CACHE = "cooky-offline-v1";
const SHELL = ["/offline.html", "/offline.js"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (SHELL.includes(url.pathname)) {
    event.respondWith(caches.match(request).then((cached) => cached ?? fetch(request)));
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
  }
});

// Web Push (PRD §3.6). The payload is already localized for this device and
// never holds message text, only who it's from. While Cooky is open and
// focused, the in-app toast shows instead of a system notification.
self.addEventListener("push", (event) => {
  let data;
  try {
    data = event.data ? event.data.json() : null;
  } catch {
    data = null;
  }
  if (!data || typeof data.title !== "string") return;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const focused = windows.some((w) => w.focused && w.visibilityState === "visible");
      if (focused) return undefined;
      return self.registration.showNotification(data.title, {
        body: data.body,
        tag: data.tag,
        icon: "/icon.svg",
        badge: "/icon.svg",
        data: { url: typeof data.url === "string" && data.url.startsWith("/") ? data.url : "/" },
      });
    }),
  );
});

// Opens the page the notification is about: an open Cooky tab if there is one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = event.notification.data && event.notification.data.url ? event.notification.data.url : "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      // Paths in pushes have no locale; the app's proxy adds the person's own.
      if (open) return open.navigate(path).then((w) => (w ?? open).focus());
      return self.clients.openWindow(path);
    }),
  );
});
