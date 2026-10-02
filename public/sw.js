/* RuqyaPro service worker.
   - Pages and data: network first, so a new deploy shows up on the next open; the cached copy is only used offline.
   - Fingerprinted assets (/_next/static) and fonts: cache first, they never change under the same URL.
   The cache name carries the build id, so every deploy starts a fresh cache and drops the old one. */
const BUILD = new URL(self.location.href).searchParams.get("v") || "dev";
const PAGES = `rp-pages-${BUILD}`;
const ASSETS = `rp-assets-${BUILD}`;
// Saved Qur'an surahs. NOT tied to the build id, so a deploy never wipes what a reader saved.
// Bump together with DATA_VERSION in src/lib/quran.ts if the Qur'an files ever change.
const QURAN = "rp-quran-v6";
// "Download everything" copy of the app (pages and assets), made from the Settings page. It is named by build, and the
// page deletes the older ones once a fresh copy is complete, so a deploy never leaves a reader without an offline copy.
const OFFLINE_PREFIX = "rp-offline-";

// Reminders: what to show when the reminder server pokes this phone. If this file cannot be fetched the app still works;
// a poke then shows the plain "open the app" notice, so the phone never goes silent.
try { importScripts("/reminders-sw.js"); } catch (e) {}

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith("rp-") && k !== PAGES && k !== ASSETS && k !== QURAN && !k.startsWith(OFFLINE_PREFIX)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Saved surahs are served from the device first; anything not saved goes to the network as usual.
  if (url.pathname.startsWith("/quran-data/")) {
    event.respondWith(
      caches.open(QURAN).then(async (cache) => (await cache.match(req)) || fetch(req)),
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      (async () => {
        const hit = await caches.match(req); // any cache: visited assets or the offline download
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) (await caches.open(ASSETS)).put(req, res.clone());
        return res;
      })(),
    );
    return;
  }

  // Navigations, RSC payloads and everything else on this origin.
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && res.type === "basic") {
          const copy = res.clone();
          caches.open(PAGES).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(async () => {
        const hit = await caches.match(req);
        if (hit) return hit;
        if (req.mode === "navigate") {
          // The reader is one page for every surah (/quran/read?s=..), so any visited copy will do.
          const shell = await caches.match(req, { ignoreSearch: true });
          return shell || (await caches.match("/")) || Response.error();
        }
        return Response.error();
      }),
  );
});

/* ---------------- Reminders ----------------
   The phone's own schedule lives in IndexedDB "rp-reminders" (store "kv": "schedule" = items, "shown" = {id: shownAt}).
   src/lib/reminders.ts writes it; the server only ever sends an empty push at the right minute. */
function remindersDb() {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open("rp-reminders", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("kv");
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
}
async function kvGet(key) {
  const db = await remindersDb();
  return new Promise((resolve, reject) => {
    const q = db.transaction("kv").objectStore("kv").get(key);
    q.onsuccess = () => resolve(q.result);
    q.onerror = () => reject(q.error);
  });
}
async function kvSet(key, value) {
  const db = await remindersDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("kv", "readwrite");
    tx.objectStore("kv").put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let items = [], shown = {};
      try { items = (await kvGet("schedule")) || []; shown = (await kvGet("shown")) || {}; } catch (e) {}
      const now = Date.now();
      const r = self.RPReminders
        ? self.RPReminders.dueNow(items, shown, now)
        : { show: [{ id: "refresh", title: "RuqyaPro", body: "Open the app to refresh your reminders.", url: "/settings#reminders-title" }], mark: false };
      await Promise.all(
        r.show.map((i) =>
          self.registration.showNotification(i.title, { body: i.body, tag: i.id, icon: "/icons/192", data: { url: i.url }, renotify: false }),
        ),
      );
      if (r.mark) {
        for (const i of r.show) shown[i.id] = now;
        try { await kvSet("shown", self.RPReminders.prune(shown, now)); } catch (e) {}
      }
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const w of wins) {
        try {
          await w.focus();
          if ("navigate" in w) await w.navigate(target);
          return;
        } catch (e) {}
      }
      await self.clients.openWindow(target);
    })(),
  );
});
