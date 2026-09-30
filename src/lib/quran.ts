import meta from "../../data/quran/chapters.json";

export interface Chapter {
  id: number; name: string; arabic: string; meaning: string; verses: number; bismillahPre: boolean; place: string;
}
export interface JuzRange { surah: number; from: number; to: number }
export interface Juz { n: number; ranges: JuzRange[] }
/** tg: [start, end, class index] colour ranges over `ar` (absent where the source could not be aligned letter for letter). */
export interface Verse { n: number; ar: string; tg?: [number, number, number][]; tr: string; en: string }

/** Order matches scripts/import-quran.mts. Names only; the colours live in globals.css. */
export const TAJWEED = [
  ["ham_wasl", "Hamzat wasl"], ["slnt", "Silent letter"], ["laam_shamsiyah", "Laam shamsiyah"],
  ["madda_normal", "Madd, natural"], ["madda_permissible", "Madd, permissible"], ["madda_necessary", "Madd, necessary"],
  ["madda_obligatory", "Madd, obligatory"], ["qalaqah", "Qalqalah"], ["ikhafa_shafawi", "Ikhfa shafawi"],
  ["ikhafa", "Ikhfa"], ["idgham_shafawi", "Idgham shafawi"], ["iqlab", "Iqlab"],
  ["idgham_ghunnah", "Idgham with ghunnah"], ["idgham_wo_ghunnah", "Idgham without ghunnah"], ["ghunnah", "Ghunnah"],
] as const;

/** The juz a verse falls in. */
export function juzOf(surah: number, verse: number) {
  for (const j of juz) if (j.ranges.some((r) => r.surah === surah && verse >= r.from && verse <= r.to)) return j.n;
  return 1;
}

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
