"use client";
import { useEffect } from "react";
import { downloadEverything, readRecord } from "@/lib/offline";
import { QURAN_CACHE, surahUrl } from "@/lib/quran";
import { markSaved, staleSavedIds } from "@/lib/quran-store";

/**
 * Keeps the offline copy current. If someone has downloaded everything and a newer version of the app has since been
 * deployed, the copy is quietly refreshed the next time the app is opened with a connection. Surahs saved one by one are
 * fetched again the same way when the Qur'an files themselves change (a new data version), so nobody loses a saved surah.
 */
export function OfflineSync() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    const rec = readRecord();
    const build = process.env.NEXT_PUBLIC_BUILD_ID || "dev";
    if (!navigator.onLine) return;
    // Wait for the page to settle first.
    if (rec && rec.build !== build) {
      const t = window.setTimeout(() => { downloadEverything(rec.urls, () => {}).catch(() => {}); }, 4000);
      return () => clearTimeout(t);
    }
    const stale = staleSavedIds();
    if (!stale.length || !("caches" in window)) return;
    const t = window.setTimeout(async () => {
      try {
        const cache = await caches.open(QURAN_CACHE);
        const done: number[] = [];
        let next = 0;
        const lane = async () => {
          while (next < stale.length) {
            const n = stale[next++];
            const res = await fetch(surahUrl(n), { cache: "reload" });
            if (!res.ok) continue;
            await cache.put(surahUrl(n), res);
            done.push(n);
          }
        };
        await Promise.all(Array.from({ length: 4 }, lane));
        if (done.length) markSaved(done);
      } catch {}
    }, 4000);
    return () => clearTimeout(t);
  }, []);
  return null;
}
