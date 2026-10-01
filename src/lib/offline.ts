"use client";
import { QURAN_CACHE, chapters, surahUrl } from "./quran";
import { clearSaved, markSaved } from "./quran-store";

/**
 * "Download everything": copies every page, its scripts, styles and fonts, and the whole Qur'an into Cache Storage on
 * this device, so the app opens with no connection. Nothing is sent anywhere; the service worker serves the copies.
 */
const BUILD = process.env.NEXT_PUBLIC_BUILD_ID || "dev";
export const OFFLINE_PREFIX = "rp-offline-";
export const OFFLINE_CACHE = `${OFFLINE_PREFIX}${BUILD}`;
const KEY = "rp:v1:offline:all";

export interface OfflineRecord { build: string; at: number; bytes: number; files: number; urls: string[] }

export function readRecord(): OfflineRecord | null {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return r && typeof r.build === "string" && Array.isArray(r.urls) ? r : null;
  } catch { return null; }
}
const writeRecord = (r: OfflineRecord | null) => {
  try { r ? localStorage.setItem(KEY, JSON.stringify(r)) : localStorage.removeItem(KEY); } catch {}
  window.dispatchEvent(new Event("rp-offline"));
};

const ASSET_RE = /\/_next\/static\/[A-Za-z0-9_\-./%~+]+\.(?:js|css|woff2?|ttf|otf|png|svg|ico|json|webp|avif)/g;

/** Pages to keep, so the Settings page and a refresh after a deploy use the same list. */
export async function downloadEverything(
  pages: string[],
  onProgress: (done: number, total: number) => void,
): Promise<OfflineRecord> {
  if (!("caches" in window)) throw new Error("This browser cannot keep files for offline use.");
  const cache = await caches.open(OFFLINE_CACHE);
  const quran = await caches.open(QURAN_CACHE);
  const have = new Set((await quran.keys()).map((r) => new URL(r.url).pathname));

  const extra = ["/manifest.webmanifest", "/icons/180", "/icons/192", "/icons/512", "/icons/maskable", "/favicon.ico"];
  const seen = new Set<string>();
  const queue: { url: string; kind: "page" | "asset" | "quran" }[] = [];
  const add = (url: string, kind: "page" | "asset" | "quran") => { if (!seen.has(url)) { seen.add(url); queue.push({ url, kind }); } };
  [...pages, ...extra].forEach((u) => add(u, "page"));
  const ids = chapters.map((c) => c.id);
  ids.filter((n) => !have.has(surahUrl(n))).forEach((n) => add(surahUrl(n), "quran"));

  let done = 0, bytes = 0, files = 0;
  const tick = () => onProgress(done, seen.size);
  tick();

  const work = async (item: { url: string; kind: string }) => {
    const res = await fetch(item.url, { cache: "reload" });
    if (!res.ok) throw new Error(`${item.url}: ${res.status}`);
    const copy = res.clone();
    const type = res.headers.get("content-type") ?? "";
    if (item.kind === "quran") await quran.put(item.url, copy);
    else await cache.put(item.url, copy);
    const text = /html|css|javascript/.test(type) ? await res.clone().text() : null;
    bytes += (await res.clone().blob()).size;
    files++;
    if (text) {
      // Scripts, styles and fonts this page or stylesheet points at.
      for (const m of text.matchAll(ASSET_RE)) add(m[0], "asset");
      if (/css/.test(type)) for (const m of text.matchAll(/url\(([^)]+)\)/g)) {
        const raw = m[1].trim().replace(/^['"]|['"]$/g, "");
        if (raw.startsWith("data:")) continue;
        try { const u = new URL(raw, new URL(item.url, location.origin)); if (u.origin === location.origin) add(u.pathname + u.search, "asset"); } catch {}
      }
    }
    done++;
    tick();
  };

  // A few at a time keeps a phone responsive.
  const lane = async () => { for (let it = queue.shift(); it; it = queue.shift()) await work(it); };
  await Promise.all(Array.from({ length: 6 }, lane));

  markSaved(ids);
  try { await navigator.storage?.persist?.(); } catch {}

  // The copy is complete: older offline copies (from earlier deploys) are no longer needed.
  for (const k of await caches.keys()) if (k.startsWith(OFFLINE_PREFIX) && k !== OFFLINE_CACHE) await caches.delete(k);

  const record: OfflineRecord = { build: BUILD, at: Date.now(), bytes, files, urls: pages };
  writeRecord(record);
  return record;
}

export async function removeEverything() {
  for (const k of await caches.keys()) if (k.startsWith(OFFLINE_PREFIX) || k === QURAN_CACHE) await caches.delete(k);
  clearSaved();
  writeRecord(null);
}
