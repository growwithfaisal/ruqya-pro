import meta from "../../data/quran/chapters.json";

export interface Chapter {
  id: number; name: string; arabic: string; meaning: string; verses: number; bismillahPre: boolean; place: string;
}
export interface JuzRange { surah: number; from: number; to: number }
export interface Juz { n: number; ranges: JuzRange[] }
export interface Verse { n: number; ar: string; tr: string; en: string }

export const chapters = meta.chapters as Chapter[];
export const juz = meta.juz as Juz[];
export const bismillah = meta.bismillah as string;
export const DATA_VERSION = meta.source.dataVersion as string;
export const QURAN_CACHE = `rp-quran-${DATA_VERSION}`;

export const chapter = (n: number) => chapters[n - 1];
export const surahUrl = (n: number) => `/quran-data/${DATA_VERSION}/${n}.json`;
export const readHref = (surah: number, verse?: number) => `/quran/read?s=${surah}${verse && verse > 1 ? `&v=${verse}` : ""}`;

/** Clamp anything that came from a URL or from storage to a real surah / verse. */
export function safeSurah(x: unknown) {
  const n = Math.floor(Number(x));
  return n >= 1 && n <= 114 ? n : 1;
}
export function safeVerse(surah: number, x: unknown) {
  const n = Math.floor(Number(x));
  return n >= 1 && n <= chapter(surah).verses ? n : 1;
}

const memory = new Map<number, Promise<Verse[]>>();
/**
 * A surah saved on this device is read straight from Cache Storage, so it opens with no connection even
 * where a service worker is unavailable. Anything not saved comes from the network.
 */
export function loadSurah(n: number): Promise<Verse[]> {
  let p = memory.get(n);
  if (!p) {
    const url = surahUrl(n);
    p = (async () => {
      try {
        if ("caches" in globalThis) {
          const hit = await (await caches.open(QURAN_CACHE)).match(url);
          if (hit) return (await hit.json()) as Verse[];
        }
      } catch {}
      const r = await fetch(url);
      if (!r.ok) throw new Error(`surah ${n}: ${r.status}`);
      return (await r.json()) as Verse[];
    })();
    p.catch(() => memory.delete(n));
    memory.set(n, p);
  }
  return p;
}

/** "Al-Fatiha 1:1 to Al-Baqarah 2:141" */
export function juzSpan(j: Juz) {
  const a = j.ranges[0];
  const b = j.ranges[j.ranges.length - 1];
  return `${chapter(a.surah).name} ${a.surah}:${a.from} to ${chapter(b.surah).name} ${b.surah}:${b.to}`;
}
