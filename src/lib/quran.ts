import meta from "../../data/quran/chapters.json";

export interface Chapter {
  id: number; name: string; arabic: string; meaning: string; verses: number; bismillahPre: boolean; place: string;
}
export interface JuzRange { surah: number; from: number; to: number }
export interface Juz { n: number; ranges: JuzRange[] }
/** tg: [start, end, class index] colour ranges over `ar` (absent where the source could not be aligned letter for letter). */
export interface Verse { n: number; ar: string; tg?: [number, number, number][]; tr: string; tu?: [number, number][]; ts?: [number, number][]; en: string }
/** tu: [start, end) ranges over `tr` for letters that can be said more than one way (th, h, s, d, t standing for a heavy Arabic letter). */

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
const pool = meta.pool as string[];
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

/**
 * Tajweed colour ranges for a recitation entry that is a run of Qur'an verses (for example 2:285-286).
 * Returns null unless the entry's Arabic is exactly those verses joined by single spaces, so a colour is
 * never applied to text that is not the Qur'an text itself.
 */
export async function tajweedForEntry(
  arabic: string,
  refs: { book: string; ref: string }[],
): Promise<[number, number, number][] | null> {
  for (const r of refs) {
    const m = r.book === "The Qur'an" ? /^(\d+):(\d+)(?:-(\d+))?$/.exec(r.ref) : null;
    if (!m) continue;
    const s = Number(m[1]), from = Number(m[2]), to = Number(m[3] ?? m[2]);
    const all = await loadSurah(s);
    const slice = all.slice(from - 1, to);
    if (slice.map((v) => v.ar).join(" ") !== arabic) continue;
    const out: [number, number, number][] = [];
    let off = 0;
    for (const v of slice) {
      for (const [a, b, c] of v.tg ?? []) out.push([off + a, off + b, c]);
      off += v.ar.length + 1;
    }
    return out;
  }
  return null;
}

/* ---------- Ayah of the day ---------- */

const eligible = (surahIdx: number, verse: number) => (parseInt(pool[surahIdx][(verse - 1) >> 2], 16) >> (3 - ((verse - 1) & 3))) & 1;

/** A small seeded generator, so everyone on the same local date gets the same verse. */
function seeded(date: string) {
  let h = 2166136261;
  for (const c of date) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  let t = (h >>> 0) + 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** One verse for a local date (YYYY-MM-DD), drawn evenly from every verse short enough for a card. Changes at local midnight. */
export function ayahOfTheDay(date: string): { surah: number; verse: number } {
  let total = 0;
  chapters.forEach((c, i) => { for (let v = 1; v <= c.verses; v++) total += eligible(i, v); });
  let k = Math.floor(seeded(date) * total);
  for (let i = 0; i < chapters.length; i++) {
    for (let v = 1; v <= chapters[i].verses; v++) {
      if (!eligible(i, v)) continue;
      if (k === 0) return { surah: i + 1, verse: v };
      k--;
    }
  }
  return { surah: 1, verse: 1 };
}
