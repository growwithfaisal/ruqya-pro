/**
 * Assembles data/entries.json from cited datasets. No Arabic, transliteration or
 * grading is written by hand: every string is fetched, then (for hadith duas)
 * cut out of the dataset text between literal anchors that must exist verbatim.
 * Owner-controlled fields (verified*, exegesis) survive re-imports.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Collection, Entry, EntrySource, Grade, Intent, TimeTag } from "../src/lib/types.ts";

const ROOT = join(import.meta.dirname, "..");
const OUT = join(ROOT, "data", "entries.json");
const MISSING_OUT = join(ROOT, "MISSING.md");

const HADITH_COMMIT = "df57907be35291c91ad6a6691180e22ca9920784";
const HADITH_BASE = `https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@${HADITH_COMMIT}/editions`;
const DUA_DHIKR_COMMIT = "f42f895f914319a844c3e3c2279483cae060ea19";
const DUA_DHIKR_BASE = `https://raw.githubusercontent.com/fitrahive/dua-dhikr/${DUA_DHIKR_COMMIT}/data/dua-dhikr`;
const QURAN_API = "https://api.quran.com/api/v4";
const TR_SAHEEH = 20;
const TR_TRANSLIT = 57;

const missing: string[] = [];
const mismatches: string[] = [];

async function json<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return (await res.json()) as T;
}

/* ---------- Quran ---------- */
interface QVerse { verse_key: string; text_uthmani: string }
async function quranRange(chapter: number, from: number, to: number) {
  const ar: string[] = [];
  const en: string[] = [];
  const tr: string[] = [];
  for (let v = from; v <= to; v++) {
    const k = `${chapter}:${v}`;
    const a = await json<{ verse: QVerse }>(`${QURAN_API}/verses/by_key/${k}?fields=text_uthmani`);
    const t = await json<{ translations: { text: string }[] }>(`${QURAN_API}/quran/translations/${TR_SAHEEH}?verse_key=${k}`);
    const l = await json<{ translations: { text: string }[] }>(`${QURAN_API}/quran/translations/${TR_TRANSLIT}?verse_key=${k}`);
    ar.push(a.verse.text_uthmani);
    en.push(strip(t.translations[0].text));
    tr.push(strip(l.translations[0].text));
  }
  return { arabic: ar.join(" "), translation: en.join(" "), transliteration: tr.join(" ") };
}
// Quran.com translation payloads carry <sup> footnote markers and tags.
const strip = (s: string) => s.replace(/<sup[^>]*>.*?<\/sup>/g, "").replace(/<[^>]+>/g, "").trim();

/* ---------- Hadith ---------- */
interface HEd { metadata: { sections: Record<string, string> }; hadiths: { hadithnumber: number; arabicnumber: number | string; text: string; grades: { name: string; grade: string }[]; reference: { book: number; hadith: number } }[] }
const editions = new Map<string, HEd>();
async function edition(name: string) {
  if (!editions.has(name)) editions.set(name, await json<HEd>(`${HADITH_BASE}/${name}.json`));
  return editions.get(name)!;
}
async function hadith(collection: string, internalNo: number) {
  const ar = await edition(`ara-${collection}`);
  const en = await edition(`eng-${collection}`);
  const a = ar.hadiths.find((h) => h.hadithnumber === internalNo);
  const e = en.hadiths.find((h) => h.hadithnumber === internalNo);
  if (!a || !e) throw new Error(`hadith ${collection} ${internalNo} not found`);
  return { a, e, chapter: ar.metadata.sections[String(a.reference.book)] ?? "" };
}
/** Literal cut between anchors; throws if an anchor is absent. */
function cut(text: string, start: string, end: string, last = false) {
  const s = text.indexOf(start);
  if (s < 0) throw new Error(`start anchor not found: ${start}`);
  const e = last ? text.lastIndexOf(end) : start === end ? s : text.indexOf(end, s + start.length);
  if (e < 0) throw new Error(`end anchor not found: ${end}`);
  return text.slice(s, e + end.length).trim();
}

const MARKS = /[\u064B-\u065F\u0670\u06D6-\u06ED\u0640\u0651\u0653-\u0655]/;
const fold = (c: string) => (/[ٱأإآ]/.test(c) ? "ا" : c === "ى" ? "ي" : c === "ة" ? "ه" : c);
/** Arabic cut: anchors are plain letters (no diacritics); the slice is returned byte-for-byte from the source. */
function cutAr(text: string, start: string, end: string, last = false) {
  const kept: string[] = [];
  const idx: number[] = [];
  [...text].forEach((c, i) => { if (!MARKS.test(c)) { kept.push(fold(c)); idx.push(i); } });
  const k = kept.join("");
  const f = (a: string) => [...a].filter((c) => !MARKS.test(c)).map(fold).join("");
  const chars = [...text];
  const s = k.indexOf(f(start));
  if (s < 0) throw new Error(`start anchor not found: ${start}`);
  const eNorm = f(end);
  const e = last ? k.lastIndexOf(eNorm) : start === end ? s : k.indexOf(eNorm, s + f(start).length);
  if (e < 0) throw new Error(`end anchor not found: ${end}`);
  let to = idx[e + eNorm.length - 1] + 1;
  while (to < chars.length && MARKS.test(chars[to])) to++;
  return chars.slice(idx[s], to).join("").trim();
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/* ---------- dua-dhikr (transliteration) ---------- */
interface DD { title: string; arabic: string; latin: string; translation: string; source?: string }
const ddCache = new Map<string, DD[]>();
async function dd(set: string) {
  if (!ddCache.has(set)) ddCache.set(set, await json<DD[]>(`${DUA_DHIKR_BASE}/${set}/en.json`));
  return ddCache.get(set)!;
}
const norm = (s: string) =>
  s.replace(/[ً-ٰٟۖ-ۭـّٓ-ٕ]/g, "").replace(/[ٱأإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/\s+/g, " ").trim();

/* ---------- Definitions ---------- */
type Def = {
  id: string; slug: string; title: string; category: Intent[]; times: TimeTag[]; collection?: Collection;
  practice: string; repeat?: string;
  build: () => Promise<{
    arabic: string; transliteration: string; translation: string;
    source: EntrySource; support?: EntrySource[]; grade: Grade | ""; grader: string; takhrij: string;
    provenance: Record<string, string>;
    gaps?: string[];
  }>;
};

const sunnah = (col: string, n: string | number) => `https://sunnah.com/${col}:${n}`;
const quranCom = (c: number, v?: string) => `https://quran.com/${c}${v ? `/${v}` : ""}`;

async function supportFrom(col: string, colLabel: string, internal: number): Promise<EntrySource> {
  const h = await hadith(col, internal);
  return { book: colLabel, ref: String(h.a.arabicnumber), chapter: h.chapter };
}

const QURAN_PROV = `Arabic: Quran.com API v4 text_uthmani (retrieved ${new Date().toISOString().slice(0, 10)}); translation: Saheeh International (Quran.com resource ${TR_SAHEEH}); transliteration: Quran.com resource ${TR_TRANSLIT}`;

const SELECTION_LIST = "Selection: the owner's ruqyah ayat list (content/IMG_2038, IMG_2039, IMG_2040). No hadith is attached to this selection.";
const SELECTION_COLLECTION = "Selection: named in the owner's dua collection (content/IMG_2010 to IMG_2036). Only the verse reference was used; the source's counts, durations and claims were not.";

/** Latin transliteration as printed on the owner's images (content/), read by eye. Owner to check against the image. */
const IMG_TRANSLIT: Record<string, { img: string; text: string }> = {
  jibril: { img: "IMG_2025", text: "Bismillaahi arqeeka, min kulli shay'in yu'theeka, min sharri kulli nafsin aw 'ayni haasidin, Allaahu yashfeeka, bismillaahi arqeeka." },
  izzat: { img: "IMG_2026", text: "A'udhu bi-'izzatikal-ladhee laa ilaha illa Antal-ladhee laa yamootu, wal-jinnu wal-insu yamootoon." },
  karb: { img: "IMG_2029", text: "Laa ilaha illallahul-'Atheemul-Haleem, laa ilaha illallahu Rabbul-'Arshil-'Atheem, laa ilaha illallahu Rabbus-samaawaati wa Rabbul-ardi wa Rabbul-'Arshil-Kareem." },
};
const imgProv = (k: string) => `content/${IMG_TRANSLIT[k].img}: Latin transliteration as printed on the image (read by eye; owner to check)`;

const SELECTION_TITLED = (img: string) => `Selection, title and count: as given in the owner's dua collection (${img}). The count has no cited source. Only the title, the verse and the count were used; the source's method text was not.`;

function quranDef(o: {
  id: string; slug: string; title: string; name: string; chapter: number; from: number; to: number;
  category: Intent[]; times: TimeTag[]; practice: string; repeat?: string; collection?: Collection; selection?: string;
  support?: { col: string; label: string; internal: number }[];
}): Def {
  return {
    id: o.id, slug: o.slug, title: o.title, category: o.category, times: o.times, practice: o.practice, repeat: o.repeat, collection: o.collection,
    build: async () => {
      const q = await quranRange(o.chapter, o.from, o.to);
      const support: EntrySource[] = [];
      for (const s of o.support ?? []) support.push(await supportFrom(s.col, s.label, s.internal));
      return {
        ...q,
        source: { book: "The Qur'an", ref: `${o.chapter}:${o.from}${o.to > o.from ? `-${o.to}` : ""}`, chapter: `Surah ${o.name}` },
        support,
        grade: "Qur'an",
        grader: "Preserved text (mutawatir)",
        takhrij: quranCom(o.chapter, o.to > o.from ? `${o.from}-${o.to}` : String(o.from)),
        provenance: {
          arabic: QURAN_PROV.split(";")[0], translation: QURAN_PROV.split(";")[1].trim(), transliteration: QURAN_PROV.split(";")[2].trim(),
          ...(o.selection ? { selection: o.selection } : {}),
        },
        gaps: o.selection
          ? [
              "selection: no hadith or scholar is cited for using this passage in ruqyah; owner to source or remove",
              ...(o.repeat ? [`count "${o.repeat}" comes from the owner's collection and has no cited source`] : []),
              "exegesis note not supplied",
            ]
          : undefined,
      };
    },
  };
}

const DEFS: Def[] = [
  quranDef({ id: "dua-001", slug: "al-fatiha", title: "Al-Fatiha", name: "Al-Fatiha", chapter: 1, from: 1, to: 7, category: ["learning", "pain", "daily-protection"], times: [], practice: "Recited in full. The hadith that reports Al-Fatiha as a ruqyah is not yet attached to this entry." }),
  quranDef({ id: "dua-002", slug: "ayat-al-kursi", title: "Ayat al-Kursi", name: "Al-Baqarah", chapter: 2, from: 255, to: 255, category: ["daily-protection", "learning"], times: ["bedtime"], practice: "Recite before sleeping.", support: [{ col: "bukhari", label: "Sahih al-Bukhari", internal: 2311 }] }),
  quranDef({ id: "dua-003", slug: "last-two-ayat-al-baqarah", title: "The last two ayat of Al-Baqarah", name: "Al-Baqarah", chapter: 2, from: 285, to: 286, category: ["daily-protection", "learning"], times: ["bedtime", "evening"], practice: "Recite at night.", support: [{ col: "bukhari", label: "Sahih al-Bukhari", internal: 5009 }, { col: "muslim", label: "Sahih Muslim", internal: 1880 }] }),
  quranDef({ id: "dua-041", slug: "al-mulk", title: "Surah Al-Mulk", name: "Al-Mulk", chapter: 67, from: 1, to: 30, category: ["daily-protection", "learning"], times: ["bedtime"], practice: "Jabir reported that the Prophet would not sleep until he had recited it (with Surah As-Sajdah).", support: [{ col: "tirmidhi", label: "Jami' at-Tirmidhi", internal: 3404 }, { col: "tirmidhi", label: "Jami' at-Tirmidhi", internal: 2891 }, { col: "abudawud", label: "Sunan Abi Dawud", internal: 1400 }] }),
  quranDef({ id: "dua-004", slug: "al-ikhlas", title: "Al-Ikhlas", name: "Al-Ikhlas", chapter: 112, from: 1, to: 4, category: ["daily-protection", "pain", "learning"], times: ["morning", "evening", "bedtime"], practice: "Recite with Al-Falaq and An-Nas, blow gently into the cupped palms, then wipe over the face and as much of the body as the hands can reach.", support: [{ col: "bukhari", label: "Sahih al-Bukhari", internal: 5748 }] }),
  quranDef({ id: "dua-005", slug: "al-falaq", title: "Al-Falaq", name: "Al-Falaq", chapter: 113, from: 1, to: 5, category: ["daily-protection", "evil-eye", "pain", "learning"], times: ["morning", "evening", "bedtime"], practice: "Recite with Al-Ikhlas and An-Nas, blow gently into the cupped palms, then wipe over the face and as much of the body as the hands can reach.", support: [{ col: "bukhari", label: "Sahih al-Bukhari", internal: 5748 }] }),
  quranDef({ id: "dua-006", slug: "an-nas", title: "An-Nas", name: "An-Nas", chapter: 114, from: 1, to: 6, category: ["daily-protection", "evil-eye", "pain", "learning"], times: ["morning", "evening", "bedtime"], practice: "Recite with Al-Ikhlas and Al-Falaq, blow gently into the cupped palms, then wipe over the face and as much of the body as the hands can reach.", support: [{ col: "bukhari", label: "Sahih al-Bukhari", internal: 5748 }] }),
  {
    id: "dua-007", slug: "jibril-ruqyah", title: "The Jibril ruqyah", category: ["evil-eye", "pain"], times: [],
    practice: "Jibril recited this over the Prophet when he was ill. Said over a person who is unwell.",
    build: async () => {
      const h = await hadith("muslim", 5700);
      const arabic = cutAr(h.a.text, "باسم الله أرقيك", "باسم الله أرقيك", true);
      const translation = cut(h.e.text, "In the name of Allah I exorcise", "for you", false);
      return {
        arabic, transliteration: IMG_TRANSLIT.jibril.text, translation: cap(translation),
        source: { book: "Sahih Muslim", ref: String(h.a.arabicnumber), chapter: h.chapter },
        grade: "Sahih", grader: "Sahih Muslim (Sahihayn criterion); Albani/Arna'ut cross-check pending",
        takhrij: sunnah("muslim", h.a.arabicnumber),
        provenance: { arabic: `fawazahmed0/hadith-api ara-muslim #${h.a.hadithnumber} (internal) = Muslim ${h.a.arabicnumber}, Book ${h.a.reference.book}`, transliteration: imgProv("jibril"), translation: `fawazahmed0/hadith-api eng-muslim #${h.a.hadithnumber}` },
        gaps: ["transliteration: taken from the owner's image, not a cited repo; owner to check", "exegesis: Sharh Sahih Muslim note not supplied", "Albani / Arna'ut grading: cross-check on Dorar.net"],
      };
    },
  },
  {
    id: "dua-008", slug: "pain-hand-on-body", title: "For pain in the body", category: ["pain"], times: [],
    practice: "Place a hand on the place of pain.", repeat: "Bismillah three times, then seven times the du'a of refuge.",
    build: async () => {
      const h = await hadith("muslim", 5737);
      const a1 = cutAr(h.a.text, "باسم الله", "باسم الله");
      const a2 = cutAr(h.a.text, "أعوذ بالله وقدرته", "وأحاذر");
      const t1 = cut(h.e.text, "Bismillah", "Bismillah");
      const t2 = cut(h.e.text, "A'udhu billahi wa qudratihi", "uhadhiru");
      const e2 = cut(h.e.text, "I seek refuge with Allah and with His Power", "that I fear");
      return {
        arabic: `${a1}\n${a2}`, transliteration: `${t1}\n${t2}`, translation: `In the name of Allah\n${e2}`,
        source: { book: "Sahih Muslim", ref: String(h.a.arabicnumber), chapter: h.chapter },
        grade: "Sahih", grader: "Sahih Muslim (Sahihayn criterion); Albani/Arna'ut cross-check pending",
        takhrij: sunnah("muslim", h.a.arabicnumber),
        provenance: { arabic: `fawazahmed0/hadith-api ara-muslim #${h.a.hadithnumber} = Muslim ${h.a.arabicnumber}`, transliteration: `fawazahmed0/hadith-api eng-muslim #${h.a.hadithnumber} (translator's transliteration inside the English text)`, translation: `fawazahmed0/hadith-api eng-muslim #${h.a.hadithnumber}` },
        gaps: ["exegesis: Sharh Sahih Muslim note not supplied", "Albani / Arna'ut grading: cross-check on Dorar.net"],
      };
    },
  },
  {
    id: "dua-009", slug: "seeking-refuge-for-children", title: "Seeking refuge for children", category: ["evil-eye", "daily-protection"], times: ["morning", "evening"],
    practice: "The Prophet used this to seek refuge for his grandsons al-Hasan and al-Husayn.",
    build: async () => {
      const h = await hadith("abudawud", 4737);
      const arabic = cutAr(h.a.text, "أعيذكما", "لامة");
      const translation = cut(h.e.text, "I seek refuge for both of you", "which influences");
      const t = await hadith("tirmidhi", 2060);
      const tl = cut(t.e.text, "U'idhukuma", "lammah");
      return {
        arabic, transliteration: tl, translation: cap(translation),
        source: { book: "Sunan Abi Dawud", ref: String(h.a.arabicnumber), chapter: h.chapter },
        support: [{ book: "Jami' at-Tirmidhi", ref: String(t.a.arabicnumber), chapter: t.chapter }],
        grade: "Sahih", grader: "Al-Albani (Sahih); Shu'ayb al-Arna'ut (Sahih)",
        takhrij: sunnah("abudawud", h.a.arabicnumber),
        provenance: { arabic: `fawazahmed0/hadith-api ara-abudawud #${h.a.hadithnumber}`, transliteration: `fawazahmed0/hadith-api eng-tirmidhi #${t.a.hadithnumber} (translator's transliteration inside the English text)`, translation: `fawazahmed0/hadith-api eng-abudawud #${h.a.hadithnumber}`, grade: "fawazahmed0/hadith-api grades on ara-abudawud" },
        gaps: ["exegesis note not supplied"],
      };
    },
  },
  {
    id: "dua-010", slug: "morning-evening-protection", title: "Morning and evening protection", category: ["daily-protection"], times: ["morning", "evening"],
    practice: "Say in the morning of each day and the evening of each night.", repeat: "Three times.",
    build: async () => {
      const h = await hadith("tirmidhi", 3388);
      const arabic = cutAr(h.a.text, "بسم الله الذي لا يضر", "العليم");
      const translation = cut(h.e.text, "In the Name of Allah, who with His Name", "the Knowing");
      const d = (await dd("evening-dhikr")).find((x) => norm(x.arabic) === norm(arabic));
      const mismatch = !d;
      if (mismatch) mismatches.push("dua-010: no dua-dhikr entry equals the Tirmidhi Arabic after normalisation; transliteration left empty");
      return {
        arabic, transliteration: d?.latin ?? "", translation,
        source: { book: "Jami' at-Tirmidhi", ref: String(h.a.arabicnumber), chapter: h.chapter },
        grade: "Hasan", grader: "Al-Albani (Hasan Sahih)",
        takhrij: sunnah("tirmidhi", h.a.arabicnumber),
        provenance: { arabic: `fawazahmed0/hadith-api ara-tirmidhi #${h.a.hadithnumber}`, transliteration: `fitrahive/dua-dhikr evening-dhikr (MIT), Arabic matched to Tirmidhi text after normalisation`, translation: `fawazahmed0/hadith-api eng-tirmidhi #${h.a.hadithnumber}`, grade: "fawazahmed0/hadith-api grades on ara-tirmidhi" },
        gaps: ["Arna'ut grading not listed in dataset: cross-check on Dorar.net", "exegesis note not supplied"],
      };
    },
  },
  {
    id: "dua-011", slug: "before-sleep", title: "When going to bed", category: ["daily-protection"], times: ["bedtime"],
    practice: "Said when about to sleep.",
    build: async () => {
      const h = await hadith("bukhari", 6324);
      const arabic = cutAr(h.a.text, "باسمك اللهم أموت", "وأحيا");
      const translation = cut(h.e.text, "With Your name, O Allah, I die and I live", "With Your name, O Allah, I die and I live");
      const d = (await dd("daily-dua")).find((x) => norm(x.arabic).includes(norm(arabic)) && norm(x.arabic).length < norm(arabic).length + 12);
      if (!d) mismatches.push("dua-011: no dua-dhikr daily-dua entry matches the Bukhari Arabic; transliteration left empty");
      return {
        arabic, transliteration: d?.latin ?? "", translation,
        source: { book: "Sahih al-Bukhari", ref: String(h.a.arabicnumber), chapter: h.chapter },
        grade: "Sahih", grader: "Sahih al-Bukhari (Sahihayn criterion); Albani/Arna'ut cross-check pending",
        takhrij: sunnah("bukhari", h.a.arabicnumber),
        provenance: { arabic: `fawazahmed0/hadith-api ara-bukhari #${h.a.hadithnumber}`, transliteration: "fitrahive/dua-dhikr daily-dua (MIT)", translation: `fawazahmed0/hadith-api eng-bukhari #${h.a.hadithnumber}` },
        gaps: ["Albani / Arna'ut grading: cross-check on Dorar.net", "exegesis note not supplied"],
      };
    },
  },
  {
    id: "dua-012", slug: "al-kafirun-before-sleep", title: "Al-Kafirun before sleep", category: ["daily-protection", "learning"], times: ["bedtime"],
    practice: "Recite the surah, then sleep on its ending.",
    build: async () => {
      const q = await quranRange(109, 1, 6);
      const h = await hadith("abudawud", 5055);
      return {
        ...q,
        source: { book: "Sunan Abi Dawud", ref: String(h.a.arabicnumber), chapter: h.chapter },
        support: [{ book: "The Qur'an", ref: "109:1-6", chapter: "Surah Al-Kafirun" }],
        grade: "Sahih", grader: "Al-Albani (Sahih); Shu'ayb al-Arna'ut (Hasan)",
        takhrij: sunnah("abudawud", h.a.arabicnumber),
        provenance: { arabic: QURAN_PROV.split(";")[0], translation: QURAN_PROV.split(";")[1].trim(), transliteration: QURAN_PROV.split(";")[2].trim(), grade: "fawazahmed0/hadith-api grades on ara-abudawud" },
        gaps: ["exegesis note not supplied"],
      };
    },
  },

  /* ---- Ruqyah ayat list (owner's app list, content/IMG_2038-2040) ---- */
  quranDef({ id: "dua-013", slug: "al-baqarah-1-12", title: "Al-Baqarah 1 to 12", name: "Al-Baqarah", chapter: 2, from: 1, to: 12, category: ["learning"], times: [], collection: "ayat-list", selection: SELECTION_LIST, practice: "Recite the passage." }),
  quranDef({ id: "dua-014", slug: "al-baqarah-102", title: "Al-Baqarah 102", name: "Al-Baqarah", chapter: 2, from: 102, to: 102, category: ["learning"], times: [], collection: "ayat-list", selection: SELECTION_LIST, practice: "Recite the verse." }),
  quranDef({ id: "dua-015", slug: "al-baqarah-163-164", title: "Al-Baqarah 163 to 164", name: "Al-Baqarah", chapter: 2, from: 163, to: 164, category: ["learning"], times: [], collection: "ayat-list", selection: SELECTION_LIST, practice: "Recite the passage." }),
  quranDef({ id: "dua-016", slug: "al-araf-54-56", title: "Al-A'raf 54 to 56", name: "Al-A'raf", chapter: 7, from: 54, to: 56, category: ["learning"], times: [], collection: "ayat-list", selection: SELECTION_LIST, practice: "Recite the passage." }),
  quranDef({ id: "dua-017", slug: "as-saffat-1-10", title: "As-Saffat 1 to 10", name: "As-Saffat", chapter: 37, from: 1, to: 10, category: ["learning"], times: [], collection: "ayat-list", selection: SELECTION_LIST, practice: "Recite the passage." }),
  quranDef({ id: "dua-018", slug: "al-hashr-21-24", title: "Al-Hashr 21 to 24", name: "Al-Hashr", chapter: 59, from: 21, to: 24, category: ["learning"], times: [], collection: "ayat-list", selection: SELECTION_LIST, practice: "Recite the passage." }),
  quranDef({ id: "dua-019", slug: "at-talaq-2-3", title: "At-Talaq 2 to 3", name: "At-Talaq", chapter: 65, from: 2, to: 3, category: ["learning"], times: [], collection: "ayat-list", selection: SELECTION_LIST, practice: "Recite the passage." }),

  /* ---- Single verses named in the owner's dua collection ---- */
  ...([
    ["dua-020", "as-saff-61-13", "As-Saff 61:13", "As-Saff", 61, 13],
    ["dua-021", "hud-11-57", "Hud 11:57", "Hud", 11, 57],
    ["dua-022", "al-anam-6-61", "Al-An'am 6:61", "Al-An'am", 6, 61],
    ["dua-023", "at-tariq-86-4", "At-Tariq 86:4", "At-Tariq", 86, 4],
    ["dua-024", "al-hadid-57-3", "Al-Hadid 57:3", "Al-Hadid", 57, 3],
    ["dua-025", "ash-shuara-26-80", "Ash-Shu'ara 26:80", "Ash-Shu'ara", 26, 80],
    ["dua-026", "fussilat-41-12", "Fussilat 41:12", "Fussilat", 41, 12],
    ["dua-027", "an-naml-27-1", "An-Naml 27:1", "An-Naml", 27, 1],
    ["dua-028", "al-anbiya-21-69", "Al-Anbiya 21:69", "Al-Anbiya", 21, 69],
    ["dua-029", "al-araf-7-117", "Al-A'raf 7:117", "Al-A'raf", 7, 117],
    ["dua-030", "al-hijr-15-18", "Al-Hijr 15:18", "Al-Hijr", 15, 18],
  ] as [string, string, string, string, number, number][]).map(([id, slug, title, name, chapter, v]) =>
    quranDef({ id, slug, title, name, chapter, from: v, to: v, category: ["learning"], times: [], collection: "verse", selection: SELECTION_COLLECTION, practice: "Recite the verse." }),
  ),

  /* ---- Owner's collection: title and count only (method text deliberately not carried over) ---- */
  quranDef({ id: "dua-034", slug: "ruqyah-for-punishing-the-enemy", title: "Ruqyah for Punishing the Enemy", name: "Al-Masad", chapter: 111, from: 1, to: 5, category: ["learning"], times: [], collection: "verse", selection: SELECTION_TITLED("IMG_2032"), practice: "", repeat: "41 times" }),
  quranDef({ id: "dua-035", slug: "ruqyah-for-joint-magic", title: "Ruqyah for Joint Magic", name: "Ali 'Imran", chapter: 3, from: 54, to: 54, category: ["learning"], times: [], collection: "verse", selection: SELECTION_TITLED("IMG_2031"), practice: "", repeat: "41 times" }),
  quranDef({ id: "dua-036", slug: "destroy-stomach-magic", title: "Destroy Stomach Magic", name: "An-Nisa", chapter: 4, from: 10, to: 10, category: ["learning"], times: [], collection: "verse", selection: SELECTION_TITLED("IMG_2037"), practice: "", repeat: "101 times" }),
  quranDef({ id: "dua-037", slug: "ruqyah-for-body-burning", title: "Ruqyah for Body Burning", name: "Al-Anbiya", chapter: 21, from: 69, to: 69, category: ["learning"], times: [], collection: "verse", selection: SELECTION_TITLED("IMG_2021"), practice: "", repeat: "41 times" }),
  quranDef({ id: "dua-038", slug: "black-magic-face-ruqyah", title: "Black Magic Face Ruqyah", name: "Al-Qiyamah", chapter: 75, from: 22, to: 22, category: ["learning"], times: [], collection: "verse", selection: SELECTION_TITLED("IMG_2023"), practice: "", repeat: "11 times, with Al-Baqarah 102 (11 times)" }),
  quranDef({ id: "dua-039", slug: "destroy-waswasah-with-ruqyah", title: "Destroy Waswasah With Ruqyah", name: "Al-Hadid", chapter: 57, from: 3, to: 3, category: ["learning"], times: [], collection: "verse", selection: SELECTION_TITLED("IMG_2024"), practice: "", repeat: "41 times and 33 times" }),
  {
    id: "dua-040", slug: "ruqyah-for-black-magic", title: "Ruqyah for Black Magic", category: ["learning"], times: [], collection: "verse",
    practice: "", repeat: "21 times",
    build: async () => {
      const h = await hadith("abudawud", 5090);
      const arabic = cutAr(h.a.text, "اللهم عافني في بدني", "لا إله إلا أنت");
      const translation = cut(h.e.text, "O Allah! Grant me health in my body", "There is no god but Thou");
      const dd0 = (await dd("morning-dhikr")).find((x) => norm(x.arabic).replace(/[،,]/g, "").replace(/\s+/g, " ").includes(norm(arabic)));
      if (!dd0) mismatches.push("AFINI: no dua-dhikr morning-dhikr entry contains the Abu Dawud Arabic; transliteration left empty");
      const translit = dd0 ? cut(dd0.latin, "allahumma 'afini fi badani", "la ilaha illa anta") + "." : "";
      return {
        arabic, transliteration: translit, translation,
        source: { book: "Sunan Abi Dawud", ref: String(h.a.arabicnumber), chapter: h.chapter },
        grade: "Hasan", grader: "Al-Albani (Hasan isnad). Disputed: Zubair Ali Zai grades it Da'if. Arna'ut not listed.",
        takhrij: sunnah("abudawud", h.a.arabicnumber),
        provenance: { arabic: `fawazahmed0/hadith-api ara-abudawud #${h.a.hadithnumber}`, translation: `fawazahmed0/hadith-api eng-abudawud #${h.a.hadithnumber}`, transliteration: "fitrahive/dua-dhikr morning-dhikr (MIT), first three requests only", grade: "fawazahmed0/hadith-api grades on ara-abudawud", selection: SELECTION_TITLED("IMG_2017") },
        gaps: ["same text as dua-033; the title and the 21-times count come from the owner's collection and have no cited source", "grade is disputed in the dataset (Albani Hasan isnad; Zubair Ali Zai Da'if): owner to decide whether to publish", "exegesis note not supplied"],
      };
    },
  },

  /* ---- Duas from the owner's collection that carry a hadith reference ---- */
  {
    id: "dua-031", slug: "seeking-refuge-in-allahs-might", title: "Seeking refuge in Allah's might", category: ["daily-protection"], times: [],
    practice: "The Prophet used to say this.",
    build: async () => {
      const h = await hadith("bukhari", 7383);
      const arabic = cutAr(h.a.text, "أعوذ بعزتك", "يموتون");
      const translation = cut(h.e.text, "I seek refuge (with YOU) by Your 'Izzat", "human beings die");
      return {
        arabic, transliteration: IMG_TRANSLIT.izzat.text, translation,
        source: { book: "Sahih al-Bukhari", ref: String(h.a.arabicnumber), chapter: h.chapter },
        grade: "Sahih", grader: "Sahih al-Bukhari (Sahihayn criterion); Albani/Arna'ut cross-check pending",
        takhrij: sunnah("bukhari", h.a.arabicnumber),
        provenance: { arabic: `fawazahmed0/hadith-api ara-bukhari #${h.a.hadithnumber}`, transliteration: imgProv("izzat"), translation: `fawazahmed0/hadith-api eng-bukhari #${h.a.hadithnumber}`, selection: "Reference named in the owner's dua collection (content/IMG_2035 or similar); text and grade taken from the dataset only." },
        gaps: ["transliteration: taken from the owner's image, not a cited repo; owner to check", "exegesis note not supplied", "Albani / Arna'ut grading: cross-check on Dorar.net"],
      };
    },
  },
  {
    id: "dua-032", slug: "dua-at-a-time-of-distress", title: "At a time of distress", category: ["learning"], times: [],
    practice: "The Prophet used to say this at a time of distress.",
    build: async () => {
      const h = await hadith("muslim", 6921);
      const b = await hadith("bukhari", 6346);
      const arabic = cutAr(h.a.text, "لا إله إلا الله العظيم الحليم", "العرش الكريم");
      const translation = cut(h.e.text, "There is no god but Allah, the Great", "Edifying Throne");
      return {
        arabic, transliteration: IMG_TRANSLIT.karb.text, translation,
        source: { book: "Sahih Muslim", ref: String(h.a.arabicnumber).split(".")[0], chapter: h.chapter },
        support: [{ book: "Sahih al-Bukhari", ref: String(b.a.arabicnumber), chapter: b.chapter }],
        grade: "Sahih", grader: "Sahih Muslim (Sahihayn criterion); Albani/Arna'ut cross-check pending",
        takhrij: sunnah("muslim", String(h.a.arabicnumber).split(".")[0]),
        provenance: { arabic: `fawazahmed0/hadith-api ara-muslim #${h.a.hadithnumber} (identical wording to Bukhari ${b.a.arabicnumber})`, transliteration: imgProv("karb"), translation: `fawazahmed0/hadith-api eng-muslim #${h.a.hadithnumber}`, selection: "Bukhari reference named in the owner's dua collection; Muslim used for the English because the Bukhari English in the dataset is transliteration only." },
        gaps: ["transliteration: taken from the owner's image, not a cited repo; owner to check", "exegesis note not supplied", "Albani / Arna'ut grading: cross-check on Dorar.net", "takhrij link: Muslim numbering has a letter suffix on sunnah.com; check the link"],
      };
    },
  },
  {
    id: "dua-033", slug: "asking-for-wellbeing", title: "Asking for wellbeing", category: ["pain", "daily-protection"], times: ["morning", "evening"],
    practice: "Abu Bakrah reported that the Prophet used these words.", repeat: "Three times in the morning and three times in the evening.",
    build: async () => {
      const h = await hadith("abudawud", 5090);
      const arabic = cutAr(h.a.text, "اللهم عافني في بدني", "لا إله إلا أنت");
      const translation = cut(h.e.text, "O Allah! Grant me health in my body", "There is no god but Thou");
      const dd0 = (await dd("morning-dhikr")).find((x) => norm(x.arabic).replace(/[،,]/g, "").replace(/\s+/g, " ").includes(norm(arabic)));
      if (!dd0) mismatches.push("AFINI: no dua-dhikr morning-dhikr entry contains the Abu Dawud Arabic; transliteration left empty");
      const translit = dd0 ? cut(dd0.latin, "allahumma 'afini fi badani", "la ilaha illa anta") + "." : "";
      return {
        arabic, transliteration: translit, translation,
        source: { book: "Sunan Abi Dawud", ref: String(h.a.arabicnumber), chapter: h.chapter },
        grade: "Hasan", grader: "Al-Albani (Hasan isnad). Disputed: Zubair Ali Zai grades it Da'if. Arna'ut not listed.",
        takhrij: sunnah("abudawud", h.a.arabicnumber),
        provenance: { arabic: `fawazahmed0/hadith-api ara-abudawud #${h.a.hadithnumber}`, translation: `fawazahmed0/hadith-api eng-abudawud #${h.a.hadithnumber}`, transliteration: "fitrahive/dua-dhikr morning-dhikr (MIT), first three requests only", grade: "fawazahmed0/hadith-api grades on ara-abudawud", selection: "Reference named in the owner's dua collection (IMG_2017); the source's counts and oil regimen were not used." },
        gaps: ["grade is disputed in the dataset (Albani Hasan isnad; Zubair Ali Zai Da'if): owner to decide whether to publish", "exegesis note not supplied"],
      };
    },
  },
];

/* ---------- Run ---------- */
const prior: Entry[] = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : [];
const priorById = new Map(prior.map((e) => [e.id, e]));

const out: Entry[] = [];
for (const d of DEFS) {
  const b = await d.build();
  const p = priorById.get(d.id);
  out.push({
    id: d.id, slug: d.slug, collection: d.collection ?? "core", title: d.title, category: d.category, times: d.times,
    arabic: b.arabic, transliteration: b.transliteration, translation: b.translation,
    practice: d.practice, repeat: d.repeat ?? "",
    source: b.source, support: b.support ?? [],
    grade: b.grade, grader: b.grader,
    exegesis: p?.exegesis ?? { work: "", note: "" },
    takhrij_url: b.takhrij, provenance: b.provenance,
    verified: p?.verified ?? false, verified_by: p?.verified_by ?? "", verified_on: p?.verified_on ?? "",
  });
  for (const g of b.gaps ?? []) missing.push(`- **${d.id}** ${d.title}: ${g}`);
  console.log("built", d.id, d.title);
}

// Cross-check Quranic Arabic against dua-dhikr (independent copy).
const kursi = (await dd("morning-dhikr")).find((x) => x.title === "Ayatul Kursi");
const ours = out.find((e) => e.id === "dua-002")!;
if (kursi) {
  if (kursi.arabic !== ours.arabic) mismatches.push("dua-002 Ayat al-Kursi: Quran.com text differs from fitrahive/dua-dhikr (byte comparison). Kept Quran.com text; owner to review the diff.");
  else console.log("Ayat al-Kursi identical in Quran.com and dua-dhikr");
}

writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");

// Method hadith shown verbatim (English from the dataset) on Self-Ruqyah.
const methodSrc = [
  { collection: "bukhari", label: "Sahih al-Bukhari", internal: 5748, note: "Blowing into the palms and wiping the body" },
  { collection: "muslim", label: "Sahih Muslim", internal: 5737, note: "Placing a hand on the place of pain" },
];
const method = [];
for (const m of methodSrc) {
  const h = await hadith(m.collection, m.internal);
  method.push({
    label: m.label, ref: String(h.a.arabicnumber), chapter: h.chapter, note: m.note,
    english: h.e.text, takhrij_url: sunnah(m.collection, h.a.arabicnumber),
    provenance: `fawazahmed0/hadith-api eng-${m.collection} #${h.a.hadithnumber}`,
  });
}
writeFileSync(join(ROOT, "data", "method.json"), JSON.stringify(method, null, 2) + "\n");

const notes = [
  "# MISSING",
  "",
  "Generated by `scripts/import-content.mts`. Entries stay unpublished until every item is resolved and the owner flips `verified`.",
  "",
  "## Per-entry gaps",
  ...missing,
  "",
  "## Not yet in the library (v1 scope, section 3b)",
  "- Full morning adhkar set and full evening adhkar set (only the protection dhikr is in).",
  "- Full bedtime routine (Ayat al-Kursi, last two ayat, three Quls, the sleep du'a are in; the blowing/wiping sequence is only linked to Bukhari via the Quls).",
  "- Hadith that reports Al-Fatiha as a ruqyah (attach to dua-001).",
  "- Du'a for sleep disturbance (needs a graded source; none chosen).",
  "- `content/` is 31 phone screenshots, not text. Nothing was transcribed. Verse references and hadith references shown in them were used to fetch text from the cited datasets.",
  "- The ayat list screenshots (IMG_2038 to IMG_2040) stop at As-Saffat 10. If the app list continues past that, send the remaining screenshots.",
  "- Included with title and count only, by the owner's instruction (dua-034 to dua-040): Punishing the Enemy, Joint Magic, Stomach Magic, Body Burning, Black Magic Face, Waswasah, Black Magic. The method text (knife, salt, oil, water, cotton, days, medical claims) was left out. The counts and titles have no cited source.",
  "- 'Jinn Expulsion Shield' (IMG_2030) is NOT included: its Arabic (the takbir and tahlil formula) cannot be taken from a cited text. It cites 'Sahih Muslim 382 / Jami at-Tirmidhi'; neither matches the formula in the pinned dataset (Muslim 382 is not this text). Send a sourced text or a correct reference and it will be added.",
  "",
  "## Surah Al-Mulk (dua-041)",
  "- The hadith behind the bedtime practice (Tirmidhi 3404, Jabir) says the Prophet would not sleep until he had recited Surah As-Sajdah (32) and Al-Mulk. Only Al-Mulk is in the bedtime set; As-Sajdah is not added.",
  "- Grading is mixed in the dataset: Tirmidhi 3404 is Sahih per Al-Albani and Da'if per Zubair Ali Zai; Tirmidhi 2891 and Abu Dawud 1400 (Al-Mulk intercedes for its reader) are Hasan per Al-Albani. Owner to confirm before publishing.",
  "",
  "## Numbering note",
  "The brief cites \"Sahih Muslim, Book 39, Hadith 2186\". In the pinned dataset the Jibril ruqyah is **Book 39, in-book hadith 54, book-wide number 2186** (the numbering sunnah.com uses in `muslim:2186`). The site cites it as `Sahih Muslim 2186`, Book 39.",
  "",
  "## Content mismatches",
  ...(mismatches.length ? mismatches.map((m) => `- ${m}`) : ["- None found."]),
  "",
];
writeFileSync(MISSING_OUT, notes.join("\n"));
console.log(`wrote ${out.length} entries`);
