/**
 * Builds the offline Qur'an from Quran.com API v4.
 *   data/quran/chapters.json        chapter list, juz map, one Bismillah line (from Al-Fatiha 1:1)
 *   public/quran-data/v1/{n}.json   [{n, ar, tr, en}] per surah
 * Arabic is stored exactly as returned (leading spaces included). Nothing here is typed or corrected by hand.
 * A second Uthmani source is compared letter-by-letter (diacritics ignored) and mismatches are REPORTED, never fixed.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { silentTranslit, underlineTranslit } from "./lib/translit-marks.mjs";

const ROOT = join(import.meta.dirname, "..");
const API = "https://api.quran.com/api/v4";
const TR_EN = 20; // Saheeh International
// Transliteration: Tanzil's original text (word-spaced), as packaged by risan/quran-json 3.1.2. Quran.com's resource 57 joins words and drops letters.
const TANZIL_TRANSLIT = "https://cdn.jsdelivr.net/npm/quran-json@3.1.2/dist/quran_transliteration.json";
const SECOND = "https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1/editions/ara-quranuthmanihaf.min.json"; // King Fahd Complex, Uthmani Hafs
const DATA_VERSION = "v5"; // v2 added tajweed colour ranges; v3 switched transliteration to Tanzil's word-spaced text; v4 added underline ranges (tu); v5 adds silent-letter ranges (ts). Bump the cache name in public/sw.js with it.
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


/* ---------- Tajweed alignment ---------- */
export const TAJWEED = [
  "ham_wasl", "slnt", "laam_shamsiyah", "madda_normal", "madda_permissible", "madda_necessary", "madda_obligatory",
  "qalaqah", "ikhafa_shafawi", "ikhafa", "idgham_shafawi", "iqlab", "idgham_ghunnah", "idgham_wo_ghunnah", "ghunnah",
];
const isMark = (o: number) =>
  (o >= 0x64b && o <= 0x65f) || o === 0x670 || o === 0x640 || o === 0x672 || (o >= 0x6d6 && o <= 0x6ed) || (o >= 0x8d3 && o <= 0x8ff);
const SKIP = new Set([0x200c, 0x200d, 0x200e, 0x200f]);
const FOLD: Record<number, number> = { 0x66e: 0x64a, 0x649: 0x64a, 0x626: 0x64a, 0x623: 0x627, 0x625: 0x627, 0x622: 0x627, 0x671: 0x627, 0x624: 0x648, 0x629: 0x647, 0x6cc: 0x64a };
interface Cluster { base: string; start: number; end: number }
function clusters(s: string): Cluster[] {
  const out: Cluster[] = [];
  for (let i = 0; i < s.length; i++) {
    const o = s.charCodeAt(i);
    if (SKIP.has(o)) continue;
    if (o === 0x20) { if (out.length && out[out.length - 1].base !== " ") out.push({ base: " ", start: i, end: i + 1 }); continue; }
    if (isMark(o)) { if (out.length && out[out.length - 1].base !== " ") out[out.length - 1].end = i + 1; continue; }
    out.push({ base: String.fromCharCode(FOLD[o] ?? o), start: i, end: i + 1 });
  }
  while (out.length && out[out.length - 1].base === " ") out.pop();
  return out;
}
/** [start, end, class index] ranges over `ar`, or null when the tagged text does not line up with it. */
function alignTajweed(ar: string, tagged: string): [number, number, number][] | null {
  const src = tagged.replace(/\s*<span class=end>[^<]*<\/span>\s*$/, "");
  let text = "";
  const spans: { s: number; e: number; cls: number }[] = [];
  for (const m of src.matchAll(/<tajweed class=(\w+)>([\s\S]*?)<\/tajweed>|([^<]+)|<[^>]+>/g)) {
    if (m[1]) {
      const cls = TAJWEED.indexOf(m[1]);
      if (cls < 0) return null;
      spans.push({ s: text.length, e: text.length + m[2].length, cls });
      text += m[2];
    } else if (m[3]) text += m[3];
  }
  const ca = clusters(ar);
  const cb = clusters(text);
  if (ca.map((c) => c.base).join("") !== cb.map((c) => c.base).join("")) return null;
  const out: [number, number, number][] = [];
  for (const sp of spans) {
    const hit = cb.map((c, i) => (c.start < sp.e && c.end > sp.s ? i : -1)).filter((i) => i >= 0);
    if (!hit.length) continue;
    const from = ca[hit[0]].start;
    const to = ca[hit[hit.length - 1]].end;
    const last = out[out.length - 1];
    if (last && from < last[1]) continue; // never overlap
    out.push([from, to, sp.cls]);
  }
  return out;
}


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

const tanzil = await json<{ id: number; verses: { id: number; transliteration: string }[] }[]>(TANZIL_TRANSLIT);
const tanzilTr = (surah: number) => tanzil.find((x) => x.id === surah)!.verses;

const second = await json<{ quran: { chapter: number; verse: number; text: string }[] }>(SECOND);
const secondByKey = new Map(second.quran.map((v) => [`${v.chapter}:${v.verse}`, v.text]));

mkdirSync(join(ROOT, "public", "quran-data", DATA_VERSION), { recursive: true });
mkdirSync(join(ROOT, "data", "quran"), { recursive: true });

const mismatches: string[] = [];
const pool: Record<number, string> = {};
// A verse is a candidate for "Ayah of the day" when it fits comfortably on a card.
const hex = (bits: number[]) => { let o = ""; for (let i = 0; i < bits.length; i += 4) o += ((bits[i] << 3) | ((bits[i + 1] ?? 0) << 2) | ((bits[i + 2] ?? 0) << 1) | (bits[i + 3] ?? 0)).toString(16); return o; };
const noColour: string[] = [];
let total = 0;
let bismillah = "";

async function surah(c: Chapter) {
  const [ar, tj, en] = await Promise.all([
    json<{ verses: { verse_key: string; text_uthmani: string }[] }>(`${API}/quran/verses/uthmani?chapter_number=${c.id}`),
    json<{ verses: { verse_key: string; text_uthmani_tajweed: string }[] }>(`${API}/quran/verses/uthmani_tajweed?chapter_number=${c.id}`),
    json<{ translations: { text: string }[] }>(`${API}/quran/translations/${TR_EN}?chapter_number=${c.id}`),
  ]);
  const tr = tanzilTr(c.id);
  if (tj.verses.length !== c.verses_count || ar.verses.length !== c.verses_count || en.translations.length !== c.verses_count || tr.length !== c.verses_count)
    throw new Error(`surah ${c.id}: verse count mismatch (${ar.verses.length}/${en.translations.length}/${tr.length} vs ${c.verses_count})`);

  const out = ar.verses.map((v, i) => {
    const n = Number(v.verse_key.split(":")[1]);
    const other = secondByKey.get(v.verse_key);
    if (other === undefined) mismatches.push(`${v.verse_key}: missing in the second source`);
    else if (rasm(other) !== rasm(v.text_uthmani)) mismatches.push(`${v.verse_key}: letters differ from the second source`);
    // Tajweed colours: the API's tagged text uses its own code points, so it is never shown. Its tags are only used
    // to colour letter clusters of the exact Arabic above. Verses that cannot be aligned letter for letter get no colour.
    const tg = alignTajweed(v.text_uthmani, tj.verses[i].text_uthmani_tajweed);
    if (!tg) noColour.push(v.verse_key);
    const trText = tr[i].transliteration.trim();
    const tu = underlineTranslit(v.text_uthmani, trText);
    const ts = silentTranslit(v.text_uthmani, trText);
    return { n, ar: v.text_uthmani, ...(tg && tg.length ? { tg } : {}), tr: trText, ...(tu.length ? { tu } : {}), ...(ts.length ? { ts } : {}), en: strip(en.translations[i].text) };
  });
  pool[c.id] = hex(out.map((v) => (v.ar.trim().length <= 300 && v.en.length <= 400 ? 1 : 0)));
  if (c.id === 1) bismillah = out[0].ar;
  total += out.length;
  writeFileSync(join(ROOT, "public", "quran-data", DATA_VERSION, `${c.id}.json`), JSON.stringify(out));
  process.stdout.write(`${c.id} `);
}

// Four at a time keeps the API happy.
const queue = [...chapters];
await Promise.all(Array.from({ length: 4 }, async () => { for (let c = queue.shift(); c; c = queue.shift()) await surah(c); }));

writeFileSync(
  join(ROOT, "data", "quran", "chapters.json"),
  JSON.stringify(
    {
      source: { arabic: "Quran.com API v4 text_uthmani", translation: `Saheeh International (Quran.com resource ${TR_EN})`, transliteration: "Tanzil (en.transliteration) via risan/quran-json 3.1.2", tajweed: "Quran.com API v4 uthmani_tajweed", retrieved: RETRIEVED, dataVersion: DATA_VERSION },
      bismillah,
      chapters: chapters.map((c) => ({
        id: c.id, name: c.name_simple, arabic: c.name_arabic, meaning: c.translated_name.name,
        verses: c.verses_count, bismillahPre: c.bismillah_pre, place: c.revelation_place,
      })),
      juz,
      pool: chapters.map((c) => pool[c.id]),
    },
    null,
    1,
  ) + "\n",
);

console.log(`\nwrote ${chapters.length} surahs, ${total} verses; tajweed colours on ${total - noColour.length} verses, plain on ${noColour.length}`);
console.log(mismatches.length ? `second-source differences (reported, not fixed): ${mismatches.length}\n` + mismatches.slice(0, 40).join("\n") : "second source agrees on every verse (letters only)");
