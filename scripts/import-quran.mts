/**
 * Builds the offline Qur'an from Quran.com API v4.
 *   data/quran/chapters.json        chapter list, juz map, one Bismillah line (from Al-Fatiha 1:1)
 *   public/quran-data/v1/{n}.json   [{n, ar, tr, en}] per surah
 * Arabic is stored exactly as returned (leading spaces included). Nothing here is typed or corrected by hand.
 * A second Uthmani source is compared letter-by-letter (diacritics ignored) and mismatches are REPORTED, never fixed.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const API = "https://api.quran.com/api/v4";
const TR_EN = 20; // Saheeh International
const TR_LATIN = 57; // transliteration
const SECOND = "https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1/editions/ara-quranuthmanihaf.min.json"; // King Fahd Complex, Uthmani Hafs
const RETRIEVED = new Date().toISOString().slice(0, 10);

const strip = (s: string) => s.replace(/<sup[^>]*>.*?<\/sup>/g, "").replace(/<[^>]+>/g, "").trim();
const rasm = (s: string) =>
  s
    .replace(/[ً-ٰٟۖ-ۭـّٓ-ٕٖ-ٟ࣓-ࣿ۞۩]/g, "")
    .replace(/[ٱأإآ]/g, "ا") // alef forms
    .replace(/[ىيئ]/g, "ي") // yeh forms and yeh-with-hamza
    .replace(/[وؤ]/g, "و") // waw and waw-with-hamza
    .replace(/[ةه]/g, "ه")
    .replace(/[\s‌‍‎‏]/g, "");

async function json<T>(url: string, tries = 4): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return (await res.json()) as T;
    } catch (e) {
      if (i >= tries) throw e;
      await new Promise((r) => setTimeout(r, 600 * (i + 1)));
    }
  }
}

interface Chapter {
  id: number; name_simple: string; name_arabic: string; verses_count: number; bismillah_pre: boolean;
  revelation_place: string; translated_name: { name: string };
}
interface Juz { juz_number: number; verse_mapping: Record<string, string> }

const { chapters } = await json<{ chapters: Chapter[] }>(`${API}/chapters?language=en`);
const { juzs } = await json<{ juzs: Juz[] }>(`${API}/juzs`);

const juzMap = new Map<number, Juz>();
for (const j of juzs) if (!juzMap.has(j.juz_number)) juzMap.set(j.juz_number, j); // the API lists each juz twice
const juz = [...juzMap.values()]
  .sort((a, b) => a.juz_number - b.juz_number)
  .map((j) => ({
    n: j.juz_number,
    ranges: Object.entries(j.verse_mapping).map(([s, r]) => {
      const [from, to] = r.split("-").map(Number);
      return { surah: Number(s), from, to: to ?? from };
    }),
  }));

const second = await json<{ quran: { chapter: number; verse: number; text: string }[] }>(SECOND);
const secondByKey = new Map(second.quran.map((v) => [`${v.chapter}:${v.verse}`, v.text]));

mkdirSync(join(ROOT, "public", "quran-data", "v1"), { recursive: true });
mkdirSync(join(ROOT, "data", "quran"), { recursive: true });

const mismatches: string[] = [];
let total = 0;
let bismillah = "";

async function surah(c: Chapter) {
  const [ar, en, tr] = await Promise.all([
    json<{ verses: { verse_key: string; text_uthmani: string }[] }>(`${API}/quran/verses/uthmani?chapter_number=${c.id}`),
    json<{ translations: { text: string }[] }>(`${API}/quran/translations/${TR_EN}?chapter_number=${c.id}`),
    json<{ translations: { text: string }[] }>(`${API}/quran/translations/${TR_LATIN}?chapter_number=${c.id}`),
  ]);
  if (ar.verses.length !== c.verses_count || en.translations.length !== c.verses_count || tr.translations.length !== c.verses_count)
    throw new Error(`surah ${c.id}: verse count mismatch (${ar.verses.length}/${en.translations.length}/${tr.translations.length} vs ${c.verses_count})`);

  const out = ar.verses.map((v, i) => {
    const n = Number(v.verse_key.split(":")[1]);
    const other = secondByKey.get(v.verse_key);
    if (other === undefined) mismatches.push(`${v.verse_key}: missing in the second source`);
    else if (rasm(other) !== rasm(v.text_uthmani)) mismatches.push(`${v.verse_key}: letters differ from the second source`);
    return { n, ar: v.text_uthmani, tr: strip(tr.translations[i].text), en: strip(en.translations[i].text) };
  });
  if (c.id === 1) bismillah = out[0].ar;
  total += out.length;
  writeFileSync(join(ROOT, "public", "quran-data", "v1", `${c.id}.json`), JSON.stringify(out));
  process.stdout.write(`${c.id} `);
}

// Four at a time keeps the API happy.
const queue = [...chapters];
await Promise.all(Array.from({ length: 4 }, async () => { for (let c = queue.shift(); c; c = queue.shift()) await surah(c); }));

writeFileSync(
  join(ROOT, "data", "quran", "chapters.json"),
  JSON.stringify(
    {
      source: { arabic: "Quran.com API v4 text_uthmani", translation: `Saheeh International (Quran.com resource ${TR_EN})`, transliteration: `Quran.com resource ${TR_LATIN}`, retrieved: RETRIEVED, dataVersion: "v1" },
      bismillah,
      chapters: chapters.map((c) => ({
        id: c.id, name: c.name_simple, arabic: c.name_arabic, meaning: c.translated_name.name,
        verses: c.verses_count, bismillahPre: c.bismillah_pre, place: c.revelation_place,
      })),
      juz,
    },
    null,
    1,
  ) + "\n",
);

console.log(`\nwrote ${chapters.length} surahs, ${total} verses`);
console.log(mismatches.length ? `second-source differences (reported, not fixed): ${mismatches.length}\n` + mismatches.slice(0, 40).join("\n") : "second source agrees on every verse (letters only)");
