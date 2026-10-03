/**
 * Assembles data/entries.json from cited datasets. No Arabic, transliteration or
 * grading is written by hand: every string is fetched, then (for hadith duas)
 * cut out of the dataset text between literal anchors that must exist verbatim.
 * Owner-controlled fields (verified*, exegesis) survive re-imports.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { silentTranslit, underlineTranslit } from "./lib/translit-marks.mjs";
import type { Collection, Entry, EntrySource, Grade, TimeTag } from "../src/lib/types.ts";

const ROOT = join(import.meta.dirname, "..");
const OUT = join(ROOT, "data", "entries.json");
const MISSING_OUT = join(ROOT, "MISSING.md");

const HADITH_COMMIT = "df57907be35291c91ad6a6691180e22ca9920784";
const HADITH_BASE = `https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@${HADITH_COMMIT}/editions`;
const DUA_DHIKR_COMMIT = "f42f895f914319a844c3e3c2279483cae060ea19";
const DUA_DHIKR_BASE = `https://raw.githubusercontent.com/fitrahive/dua-dhikr/${DUA_DHIKR_COMMIT}/data/dua-dhikr`;
const QURAN_API = "https://api.quran.com/api/v4";
const TR_SAHEEH = 20;
const TANZIL_TRANSLIT = "https://cdn.jsdelivr.net/npm/quran-json@3.1.2/dist/quran_transliteration.json"; // Tanzil en.transliteration, word-spaced

const missing: string[] = [];
const mismatches: string[] = [];

async function json<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return (await res.json()) as T;
}

/* ---------- Quran ---------- */
interface QVerse { verse_key: string; text_uthmani: string }
let tanzilCache: { id: number; verses: { id: number; transliteration: string }[] }[] | null = null;
async function quranRange(chapter: number, from: number, to: number) {
  const ar: string[] = [];
  const en: string[] = [];
  const tr: string[] = [];
  const tu: [number, number][] = [];
  const ts: [number, number][] = [];
  let off = 0;
  for (let v = from; v <= to; v++) {
    const k = `${chapter}:${v}`;
    const a = await json<{ verse: QVerse }>(`${QURAN_API}/verses/by_key/${k}?fields=text_uthmani`);
    const t = await json<{ translations: { text: string }[] }>(`${QURAN_API}/quran/translations/${TR_SAHEEH}?verse_key=${k}`);
    const tz = (tanzilCache ??= await json<NonNullable<typeof tanzilCache>>(TANZIL_TRANSLIT));
    const l = tz.find((x) => x.id === chapter)!.verses[v - 1];
    const trText = l.transliteration.trim();
    for (const [x, y] of underlineTranslit(a.verse.text_uthmani, trText)) tu.push([off + x, off + y]);
    for (const [x, y] of silentTranslit(a.verse.text_uthmani, trText)) ts.push([off + x, off + y]);
    off += trText.length + 1;
    ar.push(a.verse.text_uthmani);
    en.push(strip(t.translations[0].text));
    tr.push(trText);
  }
  return { arabic: ar.join(" "), translation: en.join(" "), transliteration: tr.join(" "), tu, ts };
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
/** Looks a hadith up by its book-wide number (arabicnumber), e.g. 2709 finds "2709.01" in Muslim. */
async function hadithAn(collection: string, arabicNo: string) {
  const ar = await edition(`ara-${collection}`);
  const en = await edition(`eng-${collection}`);
  const a = ar.hadiths.find((h) => String(h.arabicnumber) === arabicNo) ?? ar.hadiths.find((h) => String(h.arabicnumber).split(".")[0] === arabicNo);
  const e = a && en.hadiths.find((h) => h.hadithnumber === a.hadithnumber);
  if (!a || !e) throw new Error(`hadith ${collection} ${arabicNo} not found`);
  return { a, e, chapter: ar.metadata.sections[String(a.reference.book)] ?? "" };
}
const gradesOf = (h: { grades: { name: string; grade: string }[] }) => h.grades.map((g) => `${g.name} (${g.grade})`).join("; ");
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
  id: string; slug: string; title: string; times: TimeTag[]; collection?: Collection; verseByVerse?: boolean; unsourced?: boolean;
  practice: string; repeat?: string;
  build: () => Promise<{
    arabic: string; transliteration: string; translation: string; tu?: [number, number][]; ts?: [number, number][];
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

const QURAN_PROV = `Arabic: Quran.com API v4 text_uthmani (retrieved ${new Date().toISOString().slice(0, 10)}); translation: Saheeh International (Quran.com resource ${TR_SAHEEH}); transliteration: Tanzil en.transliteration via risan/quran-json 3.1.2`;

const SELECTION_LIST = "Selection: the owner's ruqyah ayat list (content/IMG_2038, IMG_2039, IMG_2040). No hadith is attached to this selection.";
const SELECTION_COLLECTION = "Selection: named in the owner's dua collection (content/IMG_2010 to IMG_2036). Only the verse reference was used; the source's counts, durations and claims were not.";

/** Latin transliteration as printed on the owner's images (content/), read by eye. Owner to check against the image. */
const IMG_TRANSLIT: Record<string, { img: string; text: string }> = {
  jibril: { img: "IMG_2025", text: "Bismillaahi arqeeka, min kulli shay'in yu'theeka, min sharri kulli nafsin aw 'ayni haasidin, Allaahu yashfeeka, bismillaahi arqeeka." },
  izzat: { img: "IMG_2026", text: "A'udhu bi-'izzatikal-ladhee laa ilaha illa Antal-ladhee laa yamootu, wal-jinnu wal-insu yamootoon." },
  karb: { img: "IMG_2029", text: "Laa ilaha illallahul-'Atheemul-Haleem, laa ilaha illallahu Rabbul-'Arshil-'Atheem, laa ilaha illallahu Rabbus-samaawaati wa Rabbul-ardi wa Rabbul-'Arshil-Kareem." },
};
/** Transliteration typed by the owner in the library brief of 2026-10-03, spelling exactly as given. Not from a cited repo; owner to check. */
const OWNER_TR = {
  evil: "A’ūdhu bi kalimāti-llāhit-tāmmāti min sharri mā khalaq.",
  evilEye: "A’ūdhu bi-kalimāt-illāhi t-tāmmāti min kulli shayṭānin wa-hāmmattin, wa-min kulli ‘aynin lāmmah.",
  sick: "As'alullāha ‘l-`Aẓīma Rabba ‘l-`Arshil-`Aẓīmi an yashfiyak.",
  healing: "Allah humma Rabban-naas, adhhibil-ba’s, washfi antash-Shaafi laa shifaa’a illaa shifaa’uka shifaa’an laa yughaadiru saqamaa.",
  debt: "Allahumma akfini bihalalika an haramika wa agnini bifadlika amman siwak.",
  anxiety: "Allahumma innee a’uzubika min alhammi wal huzni wal ajzi wal kasli wal bukhli wal jubni wa dala’id dayni wa galabatir rijaal.",
  worry: "Yā Ḥayyu yā Qayyūm, bi-raḥmatika astaghīth, aṣliḥ lī sha’nī kullah, wa lā takilnī ilā nafsī ṭarfata ʿayn.",
  halal: "Ya Razzaqu urzuqni halalan tayyiba.",
  provision: "Allahummaghfir li dhanbi, wa wassi' li fi dari, wa barik li fi rizqi.",
  depression: "Allahumma Akhrijnee min adhulumaati ilaa annur.",
};
const OWNER_PROV = "Supplied by the owner (library brief, 2026-10-03), spelling as typed; not from a cited repo; owner to check";
const imgProv = (k: string) => `content/${IMG_TRANSLIT[k].img}: Latin transliteration as printed on the image (read by eye; owner to check)`;

const SELECTION_OWNER_LIST = "Selection: named in the owner's list of ruqyah ayats (library brief of 2026-10-03). No hadith is attached to this selection. The titles and counts the earlier collection gave this passage were removed: they had no cited source.";
const SELECTION_TITLED = (img: string) => `Selection, title and count: as given in the owner's dua collection (${img}). The count has no cited source. Only the title, the verse and the count were used; the source's method text was not.`;

function quranDef(o: {
  id: string; slug: string; title: string; name: string; chapter: number; from: number; to: number;
  times: TimeTag[]; practice: string; repeat?: string; collection?: Collection; selection?: string; verseByVerse?: boolean;
  support?: { col: string; label: string; internal: number }[];
}): Def {
  return {
    id: o.id, slug: o.slug, title: o.title, times: o.times, practice: o.practice, repeat: o.repeat, collection: o.collection, verseByVerse: o.verseByVerse,
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
  quranDef({ id: "dua-001", slug: "al-fatiha", title: "Al-Fatiha", name: "Al-Fatiha", chapter: 1, from: 1, to: 7, times: [], practice: "Recited in full. The hadith that reports Al-Fatiha as a ruqyah is not yet attached to this entry." }),
  quranDef({ id: "dua-002", slug: "ayat-al-kursi", title: "Ayat al-Kursi", name: "Al-Baqarah", chapter: 2, from: 255, to: 255, times: ["bedtime"], practice: "Recite before sleeping.", support: [{ col: "bukhari", label: "Sahih al-Bukhari", internal: 2311 }] }),
  quranDef({ id: "dua-003", slug: "last-two-ayat-al-baqarah", title: "The last two ayat of Al-Baqarah", name: "Al-Baqarah", chapter: 2, from: 285, to: 286, times: ["bedtime", "evening"], practice: "Recite at night.", support: [{ col: "bukhari", label: "Sahih al-Bukhari", internal: 5009 }, { col: "muslim", label: "Sahih Muslim", internal: 1880 }] }),
  quranDef({ id: "dua-041", slug: "al-mulk", title: "Surah Al-Mulk", name: "Al-Mulk", chapter: 67, from: 1, to: 30, verseByVerse: true, times: ["bedtime"], practice: "Jabir reported that the Prophet would not sleep until he had recited it (with Surah As-Sajdah).", support: [{ col: "tirmidhi", label: "Jami' at-Tirmidhi", internal: 3404 }, { col: "tirmidhi", label: "Jami' at-Tirmidhi", internal: 2891 }, { col: "abudawud", label: "Sunan Abi Dawud", internal: 1400 }] }),
  quranDef({ id: "dua-004", slug: "al-ikhlas", title: "Al-Ikhlas", name: "Al-Ikhlas", chapter: 112, from: 1, to: 4, times: ["morning", "evening", "bedtime"], practice: "Recite with Al-Falaq and An-Nas, blow gently into the cupped palms, then wipe over the face and as much of the body as the hands can reach.", support: [{ col: "bukhari", label: "Sahih al-Bukhari", internal: 5748 }] }),
  quranDef({ id: "dua-005", slug: "al-falaq", title: "Al-Falaq", name: "Al-Falaq", chapter: 113, from: 1, to: 5, times: ["morning", "evening", "bedtime"], practice: "Recite with Al-Ikhlas and An-Nas, blow gently into the cupped palms, then wipe over the face and as much of the body as the hands can reach.", support: [{ col: "bukhari", label: "Sahih al-Bukhari", internal: 5748 }] }),
  quranDef({ id: "dua-006", slug: "an-nas", title: "An-Nas", name: "An-Nas", chapter: 114, from: 1, to: 6, times: ["morning", "evening", "bedtime"], practice: "Recite with Al-Ikhlas and Al-Falaq, blow gently into the cupped palms, then wipe over the face and as much of the body as the hands can reach.", support: [{ col: "bukhari", label: "Sahih al-Bukhari", internal: 5748 }] }),
  {
    id: "dua-007", slug: "jibril-ruqyah", title: "The Jibril ruqyah", times: [],
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
    id: "dua-008", slug: "pain-hand-on-body", title: "For pain in the body", times: [],
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
    id: "dua-009", slug: "seeking-refuge-for-children", title: "Seeking refuge for children", times: ["morning", "evening"],
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
    id: "dua-010", slug: "morning-evening-protection", title: "Morning and evening protection", times: ["morning", "evening"],
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
    id: "dua-011", slug: "before-sleep", title: "When going to bed", times: [], // owner removed it from the bedtime routine; still in the deck under Daily protection
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
    id: "dua-012", slug: "al-kafirun-before-sleep", title: "Al-Kafirun before sleep", times: ["bedtime"],
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
  quranDef({ id: "dua-013", slug: "al-baqarah-1-12", title: "Al-Baqarah 1 to 12", name: "Al-Baqarah", chapter: 2, from: 1, to: 12, times: [], collection: "ayat-list", selection: SELECTION_LIST, practice: "Recite the passage." }),
  quranDef({ id: "dua-014", slug: "al-baqarah-102", title: "Al-Baqarah 102", name: "Al-Baqarah", chapter: 2, from: 102, to: 102, times: [], collection: "ayat-list", selection: SELECTION_LIST, practice: "Recite the verse." }),
  quranDef({ id: "dua-015", slug: "al-baqarah-163-164", title: "Al-Baqarah 163 to 164", name: "Al-Baqarah", chapter: 2, from: 163, to: 164, times: [], collection: "ayat-list", selection: SELECTION_LIST, practice: "Recite the passage." }),
  quranDef({ id: "dua-016", slug: "al-araf-54-56", title: "Al-A'raf 54 to 56", name: "Al-A'raf", chapter: 7, from: 54, to: 56, times: [], collection: "ayat-list", selection: SELECTION_LIST, practice: "Recite the passage." }),
  quranDef({ id: "dua-017", slug: "as-saffat-1-10", title: "As-Saffat 1 to 10", name: "As-Saffat", chapter: 37, from: 1, to: 10, times: [], collection: "ayat-list", selection: SELECTION_LIST, practice: "Recite the passage." }),
  quranDef({ id: "dua-018", slug: "al-hashr-21-24", title: "Al-Hashr 21 to 24", name: "Al-Hashr", chapter: 59, from: 21, to: 24, times: [], collection: "ayat-list", selection: SELECTION_LIST, practice: "Recite the passage." }),
  quranDef({ id: "dua-019", slug: "at-talaq-2-3", title: "At-Talaq 2 to 3", name: "At-Talaq", chapter: 65, from: 2, to: 3, times: [], collection: "ayat-list", selection: SELECTION_LIST, practice: "Recite the passage." }),

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
    quranDef({ id, slug, title, name, chapter, from: v, to: v, times: [], collection: "verse", selection: SELECTION_COLLECTION, practice: "Recite the verse." }),
  ),

  /* ---- Owner's collection: title and count only (method text deliberately not carried over) ---- */
  quranDef({ id: "dua-034", slug: "al-masad-111-1-5", title: "Ruqyah for Punishing the Enemy", name: "Al-Masad", chapter: 111, from: 1, to: 5, times: [], collection: "verse", selection: SELECTION_OWNER_LIST, practice: "Recite the passage." }),
  quranDef({ id: "dua-035", slug: "ali-imran-3-54", title: "Ruqyah for Joint Magic", name: "Ali 'Imran", chapter: 3, from: 54, to: 54, times: [], collection: "verse", selection: SELECTION_OWNER_LIST, practice: "Recite the passage." }),
  quranDef({ id: "dua-036", slug: "an-nisa-4-10", title: "Destroy Stomach Magic", name: "An-Nisa", chapter: 4, from: 10, to: 10, times: [], collection: "verse", selection: SELECTION_OWNER_LIST, practice: "Recite the passage." }),
  quranDef({ id: "dua-038", slug: "al-qiyamah-75-22", title: "Black Magic Face Ruqyah", name: "Al-Qiyamah", chapter: 75, from: 22, to: 22, times: [], collection: "verse", selection: SELECTION_OWNER_LIST, practice: "Recite the passage." }),

  /* ---- Duas from the owner's collection that carry a hadith reference ---- */
  {
    id: "dua-031", slug: "seeking-refuge-in-allahs-might", title: "Seeking refuge in Allah's might", times: [],
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
    id: "dua-032", slug: "dua-at-a-time-of-distress", title: "At a time of distress", times: [],
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
    id: "dua-033", slug: "asking-for-wellbeing", title: "Asking for wellbeing", times: ["morning", "evening"],
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

  /* ---- Library brief of 2026-10-03: Qur'an passages ---- */
  quranDef({ id: "dua-042", slug: "al-kahf-1-10", title: "Surah Al-Kahf (18:1-10)", name: "Al-Kahf", chapter: 18, from: 1, to: 10, times: [], practice: "Recite the first ten verses.", support: [{ col: "muslim", label: "Sahih Muslim", internal: 1883 }] }),
  quranDef({ id: "dua-043", slug: "ar-rahman", title: "Surah Ar-Rahman", name: "Ar-Rahman", chapter: 55, from: 1, to: 78, verseByVerse: true, times: [], practice: "Recite the surah." }),
  quranDef({ id: "dua-044", slug: "al-anbiya-21-83", title: "Surah Al-Anbiya (21:83)", name: "Al-Anbiya", chapter: 21, from: 83, to: 83, times: [], practice: "The call of the Prophet Ayyub (Job) when he was afflicted." }),
  quranDef({ id: "dua-045", slug: "al-muminun-23-115-118", title: "Surah Al-Mu'minun (23:115-118)", name: "Al-Mu'minun", chapter: 23, from: 115, to: 118, times: [], practice: "Recite the passage." }),
  quranDef({ id: "dua-046", slug: "suleiman-dua-for-wealth", title: "Suleiman (AS) Dua for Wealth", name: "Sad", chapter: 38, from: 35, to: 35, times: [], practice: "The dua of the Prophet Sulayman." }),
  quranDef({ id: "dua-047", slug: "yunus-dua-for-distress", title: "Yunus (AS) Dua for Distress", name: "Al-Anbiya", chapter: 21, from: 87, to: 87, times: [], practice: "The call of the Prophet Yunus (Jonah) from the darkness." }),
  quranDef({ id: "dua-048", slug: "trust-and-letting-go-hasbiya-allah", title: "Statement of Trust and Letting Go (1 of 2)", name: "At-Tawbah", chapter: 9, from: 129, to: 129, times: [], practice: "Say it as a statement of reliance on Allah." }),
  quranDef({ id: "dua-049", slug: "trust-and-letting-go-hasbunallah", title: "Statement of Trust and Letting Go (2 of 2)", name: "Ali 'Imran", chapter: 3, from: 173, to: 173, times: [], practice: "Say it as a statement of reliance on Allah." }),

  /* ---- Library brief of 2026-10-03: hadith duas (Arabic cut verbatim from the dataset; transliteration as typed by the owner) ---- */
  {
    id: "dua-050", slug: "protection-from-evil", title: "Dua for Protection From Evil", times: [],
    practice: "Khawla bint Hakim reported that the Prophet said to say this on stopping at a place.",
    build: async () => {
      const h = await hadithAn("muslim", "2709");
      const arabic = cutAr(h.a.text, "أعوذ بكلمات الله التامات", "من شر ما خلق");
      const translation = cut(h.e.text, "I seek refuge in the Perfect Word of Allah", "He created");
      const ad = await hadithAn("abudawud", "3898");
      const tm = await hadithAn("tirmidhi", "3437");
      return {
        arabic, transliteration: OWNER_TR.evil, translation: cap(translation),
        source: { book: "Sahih Muslim", ref: String(h.a.arabicnumber).split(".")[0], chapter: h.chapter },
        support: [{ book: "Sunan Abi Dawud", ref: String(ad.a.arabicnumber), chapter: ad.chapter }, { book: "Jami' at-Tirmidhi", ref: String(tm.a.arabicnumber), chapter: tm.chapter }],
        grade: "Sahih", grader: "Sahih Muslim (Sahihayn criterion); Abu Dawud 3898 and Tirmidhi 3437: Al-Albani (Sahih)",
        takhrij: sunnah("muslim", String(h.a.arabicnumber).split(".")[0]),
        provenance: { arabic: `fawazahmed0/hadith-api ara-muslim #${h.a.hadithnumber} = Muslim ${String(h.a.arabicnumber).split(".")[0]}`, transliteration: OWNER_PROV, translation: `fawazahmed0/hadith-api eng-muslim #${h.a.hadithnumber}`, grade: "fawazahmed0/hadith-api grades on ara-abudawud and ara-tirmidhi" },
        gaps: ["transliteration: supplied by the owner, not a cited repo; owner to check", "exegesis note not supplied", "Albani / Arna'ut grading of the Muslim text: cross-check on Dorar.net"],
      };
    },
  },
  {
    id: "dua-051", slug: "dua-for-evil-eye", title: "Dua for Evil Eye", times: [],
    practice: "Ibn Abbas reported that the Prophet said Ibrahim used to seek refuge with these words for Isma'il and Ishaq.",
    build: async () => {
      const h = await hadithAn("bukhari", "3371");
      const arabic = cutAr(h.a.text, "أعوذ بكلمات الله التامة", "عين لامة");
      const translation = cut(h.e.text, "O Allah! I seek Refuge with Your Perfect Words", "envious eye");
      const im = await hadithAn("ibnmajah", "3525");
      return {
        arabic, transliteration: OWNER_TR.evilEye, translation,
        source: { book: "Sahih al-Bukhari", ref: String(h.a.arabicnumber), chapter: h.chapter },
        support: [{ book: "Sunan Ibn Majah", ref: String(im.a.arabicnumber), chapter: im.chapter }],
        grade: "Sahih", grader: "Sahih al-Bukhari (Sahihayn criterion); Ibn Majah 3525: Al-Albani, Arna'ut (Sahih)",
        takhrij: sunnah("bukhari", h.a.arabicnumber),
        provenance: { arabic: `fawazahmed0/hadith-api ara-bukhari #${h.a.hadithnumber}`, transliteration: OWNER_PROV, translation: `fawazahmed0/hadith-api eng-bukhari #${h.a.hadithnumber}`, grade: "fawazahmed0/hadith-api grades on ara-ibnmajah" },
        gaps: ["transliteration: supplied by the owner, not a cited repo; owner to check", "exegesis note not supplied", "Albani / Arna'ut grading of the Bukhari text: cross-check on Dorar.net"],
      };
    },
  },
  {
    id: "dua-052", slug: "visiting-the-sick", title: "Dua for Visiting a Sick Person", times: [],
    practice: "Ibn Abbas reported that the Prophet said to say this with a sick person whose time has not come.",
    build: async () => {
      const h = await hadithAn("abudawud", "3106");
      const arabic = cutAr(h.a.text, "أسأل الله العظيم", "أن يشفيك");
      const translation = cut(h.e.text, "I ask Allah, the Mighty", "to cure you");
      const t = await hadithAn("tirmidhi", "2083");
      return {
        arabic, transliteration: OWNER_TR.sick, translation: cap(translation),
        source: { book: "Sunan Abi Dawud", ref: String(h.a.arabicnumber), chapter: h.chapter },
        support: [{ book: "Jami' at-Tirmidhi", ref: String(t.a.arabicnumber), chapter: t.chapter }],
        grade: "Sahih", grader: `Al-Albani (Sahih); Muhammad Muhyi Al-Din Abdul Hamid (Sahih); Zubair Ali Zai (Isnaad Hasan). Tirmidhi 2083: Al-Albani (Sahih)`,
        takhrij: sunnah("abudawud", h.a.arabicnumber),
        provenance: { arabic: `fawazahmed0/hadith-api ara-abudawud #${h.a.hadithnumber}`, transliteration: OWNER_PROV, translation: `fawazahmed0/hadith-api eng-abudawud #${h.a.hadithnumber}`, grade: "fawazahmed0/hadith-api grades on ara-abudawud" },
        gaps: ["transliteration: supplied by the owner, not a cited repo; owner to check", "exegesis note not supplied"],
      };
    },
  },
  {
    id: "dua-053", slug: "dua-for-healing", title: "Dua for Healing", times: [],
    practice: "Aisha reported that the Prophet passed his right hand over the sick and said this.",
    build: async () => {
      const h = await hadithAn("bukhari", "5743");
      const arabic = cutAr(h.a.text, "اللهم رب الناس", "لا يغادر سقما");
      const translation = cut(h.e.text, "O Allah, the Lord of the people", "no ailment");
      return {
        arabic, transliteration: OWNER_TR.healing, translation,
        source: { book: "Sahih al-Bukhari", ref: String(h.a.arabicnumber), chapter: h.chapter },
        grade: "Sahih", grader: "Sahih al-Bukhari (Sahihayn criterion); Albani/Arna'ut cross-check pending",
        takhrij: sunnah("bukhari", h.a.arabicnumber),
        provenance: { arabic: `fawazahmed0/hadith-api ara-bukhari #${h.a.hadithnumber}`, transliteration: OWNER_PROV, translation: `fawazahmed0/hadith-api eng-bukhari #${h.a.hadithnumber}` },
        gaps: ["transliteration: supplied by the owner, not a cited repo; owner to check", "exegesis note not supplied", "Albani / Arna'ut grading: cross-check on Dorar.net"],
      };
    },
  },
  {
    id: "dua-054", slug: "dua-for-money", title: "Dua for Money", times: [],
    practice: "The Prophet's dua for Anas ibn Malik, as Umm Sulaym asked. Many readers say it for themselves.",
    build: async () => {
      const h = await hadithAn("bukhari", "6334");
      const arabic = cutAr(h.a.text, "اللهم أكثر ماله", "أعطيته");
      const translation = cut(h.e.text, "O Allah! increase his wealth", "what ever you give him");
      const t = await hadithAn("tirmidhi", "3829");
      return {
        arabic, transliteration: "", translation,
        source: { book: "Sahih al-Bukhari", ref: String(h.a.arabicnumber), chapter: h.chapter },
        support: [{ book: "Jami' at-Tirmidhi", ref: String(t.a.arabicnumber), chapter: t.chapter }],
        grade: "Sahih", grader: "Sahih al-Bukhari (Sahihayn criterion); Tirmidhi 3829: Al-Albani (Sahih)",
        takhrij: sunnah("bukhari", h.a.arabicnumber),
        provenance: { arabic: `fawazahmed0/hadith-api ara-bukhari #${h.a.hadithnumber} (third person, for Anas)`, translation: `fawazahmed0/hadith-api eng-bukhari #${h.a.hadithnumber}`, grade: "fawazahmed0/hadith-api grades on ara-tirmidhi", selection: "The owner's list gave a first-person wording; the narrated third-person wording is shown, as the owner decided." },
        gaps: ["transliteration: none; the owner's first-person transliteration does not match the narrated wording; send one for the narrated wording", "exegesis note not supplied"],
      };
    },
  },
  {
    id: "dua-055", slug: "dua-to-remove-mountains-of-debt", title: "Dua to Remove Mountains of Debt", times: [],
    practice: "Ali reported that the Prophet taught these words to a man struggling with what he owed.",
    build: async () => {
      const h = await hadithAn("tirmidhi", "3563");
      const arabic = cutAr(h.a.text, "اللهم اكفني بحلالك", "عمن سواك");
      const translation = cut(h.e.text, "O Allah, suffice me with Your lawful", "besides You");
      return {
        arabic, transliteration: OWNER_TR.debt, translation,
        source: { book: "Jami' at-Tirmidhi", ref: String(h.a.arabicnumber), chapter: h.chapter },
        grade: "Hasan", grader: gradesOf(h.a),
        takhrij: sunnah("tirmidhi", h.a.arabicnumber),
        provenance: { arabic: `fawazahmed0/hadith-api ara-tirmidhi #${h.a.hadithnumber}`, transliteration: OWNER_PROV, translation: `fawazahmed0/hadith-api eng-tirmidhi #${h.a.hadithnumber}`, grade: "fawazahmed0/hadith-api grades on ara-tirmidhi" },
        gaps: ["transliteration: supplied by the owner, not a cited repo; owner to check", "exegesis note not supplied"],
      };
    },
  },
  {
    id: "dua-056", slug: "protection-from-debt-and-anxiety", title: "Dua for Protection from Debt and Anxiety", times: [],
    practice: "Anas reported that the Prophet used to say this.",
    build: async () => {
      const h = await hadithAn("bukhari", "6369");
      const arabic = cutAr(h.a.text, "اللهم إني أعوذ بك من الهم", "وغلبة الرجال");
      const translation = cut(h.e.text, "O Allah! I seek refuge with You from worry", "by (other) men");
      return {
        arabic, transliteration: OWNER_TR.anxiety, translation,
        source: { book: "Sahih al-Bukhari", ref: String(h.a.arabicnumber), chapter: h.chapter },
        grade: "Sahih", grader: "Sahih al-Bukhari (Sahihayn criterion); Albani/Arna'ut cross-check pending",
        takhrij: sunnah("bukhari", h.a.arabicnumber),
        provenance: { arabic: `fawazahmed0/hadith-api ara-bukhari #${h.a.hadithnumber}`, transliteration: OWNER_PROV, translation: `fawazahmed0/hadith-api eng-bukhari #${h.a.hadithnumber}` },
        gaps: ["transliteration: supplied by the owner, not a cited repo; owner to check", "exegesis note not supplied", "Albani / Arna'ut grading: cross-check on Dorar.net"],
      };
    },
  },
  {
    id: "dua-057", slug: "dua-for-worry", title: "Prophet (SAW) Dua for Worry", times: [],
    practice: "Anas reported that the Prophet said this whenever a matter distressed him.",
    build: async () => {
      // The Tirmidhi text (3524) carries only the first request; the full wording is in the Nasa'i / Hakim report that dua-dhikr cites.
      const d = [...(await dd("morning-dhikr")), ...(await dd("evening-dhikr"))].find((x) => norm(x.arabic).includes("يا حي يا قيوم برحمتك استغيث") && norm(x.arabic).includes("طرفه عين"));
      if (!d) throw new Error("dua-057: the dua-dhikr entry was not found");
      const t = await hadithAn("tirmidhi", "3524");
      return {
        arabic: d.arabic, transliteration: OWNER_TR.worry, translation: d.translation,
        source: { book: "An-Nasa'i, 'Amal al-Yawm wal-Layla", ref: "575", chapter: "" },
        support: [{ book: "Jami' at-Tirmidhi", ref: String(t.a.arabicnumber), chapter: t.chapter }, { book: "Al-Hakim, Al-Mustadrak", ref: "1/545", chapter: "" }],
        grade: "Hasan", grader: `As noted by fitrahive/dua-dhikr (As-Sahihah no. 227: hasan). Tirmidhi 3524, first request only: ${gradesOf(t.a)}`,
        takhrij: sunnah("tirmidhi", t.a.arabicnumber),
        provenance: { arabic: "fitrahive/dua-dhikr morning-dhikr (MIT), 'Asking Allah for Guidance'", transliteration: OWNER_PROV, translation: "fitrahive/dua-dhikr morning-dhikr (MIT)", grade: `fitrahive/dua-dhikr source note: ${d.source}` },
        gaps: ["transliteration: supplied by the owner and omits the closing 'abadan' of the Arabic; owner to check", "Nasa'i and Hakim numbers are as cited by dua-dhikr; not in the pinned hadith dataset: cross-check on Dorar.net", "exegesis note not supplied"],
      };
    },
  },
  {
    id: "dua-058", slug: "durood-ibrahim", title: "Durood-e-Ibrahim", times: [],
    practice: "The words the Prophet taught for sending blessings on him.",
    build: async () => {
      const h = await hadithAn("bukhari", "3370");
      const arabic = cutAr(h.a.text, "اللهم صل على محمد", "إنك حميد مجيد", true);
      const translation = cut(h.e.text, "O Allah! Send Your Mercy on Muhammad", "Glorious", true);
      return {
        arabic, transliteration: "", translation,
        source: { book: "Sahih al-Bukhari", ref: String(h.a.arabicnumber), chapter: h.chapter },
        grade: "Sahih", grader: "Sahih al-Bukhari (Sahihayn criterion); Albani/Arna'ut cross-check pending",
        takhrij: sunnah("bukhari", h.a.arabicnumber),
        provenance: { arabic: `fawazahmed0/hadith-api ara-bukhari #${h.a.hadithnumber}`, translation: `fawazahmed0/hadith-api eng-bukhari #${h.a.hadithnumber}`, selection: "Named as 'Durood e Ibrahim' in the owner's Preparation list." },
        gaps: ["transliteration: none supplied; send one for this wording", "exegesis note not supplied", "Albani / Arna'ut grading: cross-check on Dorar.net"],
      };
    },
  },

  /* ---- Library brief of 2026-10-03: duas the owner asked to keep without a graded source. No Arabic exists in any pinned dataset. ---- */
  ...([
    ["dua-059", "dua-for-halal-riqz", "Dua for Halal Riqz", OWNER_TR.halal],
    ["dua-060", "dua-for-blessings-in-provision", "Dua for Blessings in Provision", OWNER_TR.provision],
    ["dua-061", "dua-for-depression", "Dua for Depression", OWNER_TR.depression],
  ] as [string, string, string, string][]).map(([id, slug, title, tr]): Def => ({
    id, slug, title, times: [], unsourced: true, practice: "",
    build: async () => ({
      arabic: "", transliteration: tr, translation: "",
      source: { book: "Mentioned by scholars", ref: "", chapter: "" },
      grade: "" as const, grader: "", takhrij: "",
      provenance: { transliteration: OWNER_PROV, selection: "Kept at the owner's request. Searched for Arabic in the pinned hadith dataset (Bukhari, Muslim, Abu Dawud, Tirmidhi, Ibn Majah, Nasa'i, Malik, Nawawi, Qudsi), fitrahive/dua-dhikr and a Hisn al-Muslim dataset: not found, so there is no Arabic and no graded source." },
      gaps: ["no Arabic and no graded source: not found in any pinned dataset; send the Arabic and where it comes from", "no English translation supplied", "exegesis note not supplied"],
    }),
  })),
];

/** The names the owner gave each item in the library brief of 2026-10-03. */
const TITLE: Record<string, string> = {
  "dua-001": "Surah Al-Fatiha", "dua-002": "Ayat al-Kursi", "dua-003": "Surah Al-Baqarah (2:285-286)",
  "dua-004": "Surah Al-Ikhlas", "dua-005": "Surah Al-Falaq", "dua-006": "Surah An-Nas",
  "dua-007": "Jibril (AS) Dua for Ruqyah", "dua-008": "Dua for Pain", "dua-009": "Dua for Protection of Children", "dua-010": "Dua for Protection From Harm",
  "dua-013": "Surah Al-Baqarah (2:1-12)", "dua-014": "Surah Al-Baqarah (2:102)", "dua-015": "Surah Al-Baqarah (2:163-164)",
  "dua-016": "Surah Al-A'raf (7:54-56)", "dua-017": "Surah As-Saffat (37:1-10)", "dua-018": "Surah Al-Hashr (59:21-24)", "dua-019": "Surah At-Talaq (65:2-3)",
  "dua-020": "Surah As-Saff (61:13)", "dua-021": "Surah Hud (11:57)", "dua-022": "Surah Al-An'am (6:61)", "dua-023": "Surah At-Tariq (86:4)",
  "dua-024": "Surah Al-Hadid (57:3)", "dua-025": "Surah Ash-Shu'ara (26:80)", "dua-026": "Surah Fussilat (41:12)", "dua-027": "Surah An-Naml (27:1)",
  "dua-028": "Surah Al-Anbiya (21:69)", "dua-029": "Surah Al-A'raf (7:117)", "dua-030": "Surah Al-Hijr (15:18)",
  "dua-032": "Dua for Extreme Distress", "dua-033": "Dua for Good Health",
  "dua-034": "Surah Al-Masad (111:1-5)", "dua-035": "Surah Ali 'Imran (3:54)", "dua-036": "Surah An-Nisa (4:10)", "dua-038": "Surah Al-Qiyamah (75:22)",
};

/* ---------- Run ---------- */
const prior: Entry[] = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : [];
const priorById = new Map(prior.map((e) => [e.id, e]));

const out: Entry[] = [];
for (const d of DEFS) {
  const b = await d.build();
  const p = priorById.get(d.id);
  out.push({
    id: d.id, slug: d.slug, collection: d.collection ?? "core", ...(d.verseByVerse ? { verseByVerse: true } : {}), title: TITLE[d.id] ?? d.title, ...(d.unsourced ? { unsourced: true } : {}), times: d.times,
    arabic: b.arabic, transliteration: b.transliteration, translation: b.translation, ...(b.tu?.length ? { tu: b.tu } : {}), ...(b.ts?.length ? { ts: b.ts } : {}),
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


/* ---------- The library: the owner's lists, in the owner's order (brief of 2026-10-03) ---------- */
type Count = { times?: number; text?: string; basis: string | null };
type Item = { id: string; title?: string; count?: Count };

/** A count's basis is shown only if the cited hadith's English text really says it; otherwise the count is "suggested". */
async function basis(label: string, collection: string, no: string, re: RegExp): Promise<string | null> {
  const h = await hadithAn(collection, no);
  if (re.test(h.e.text)) return label;
  mismatches.push(`count basis: ${label} does not say ${re} in the dataset's English text; the count is shown as suggested`);
  return null;
}
const B = {
  ikhlas: await basis("Abu Dawud 5082", "abudawud", "5082", /three times/i),
  evil: await basis("Tirmidhi 3604", "tirmidhi", "3604.02", /three times/i),
  harm: await basis("Tirmidhi 3388", "tirmidhi", "3388", /three times/i),
  pain: await basis("Muslim 2202", "muslim", "2202", /three times and seven times/i),
  sick: await basis("Abu Dawud 3106", "abudawud", "3106", /seven times/i),
  health: await basis("Abu Dawud 5090", "abudawud", "5090", /three times/i),
};
const n = (times: number, b: string | null = null): Count => ({ times, basis: b });
const it = (id: string, count?: Count, title?: string): Item => ({ id, ...(count ? { count } : {}), ...(title ? { title } : {}) });

const library = {
  version: 1,
  categories: {
    "daily-protection": [
      it("dua-001"), it("dua-002"), it("dua-004", n(3, B.ikhlas)), it("dua-005", n(3, B.ikhlas)), it("dua-006", n(3, B.ikhlas)),
      it("dua-042"), it("dua-010", n(3, B.harm)), it("dua-050", n(3, B.evil)),
    ],
    pain: [
      it("dua-001", n(7)), it("dua-008", { text: "Bismillah three times, then the dua of refuge seven times", basis: B.pain }),
      it("dua-052", n(7, B.sick)), it("dua-053"), it("dua-044"), it("dua-043"),
    ],
    "evil-eye": [
      it("dua-004", n(3, B.ikhlas)), it("dua-005", n(3, B.ikhlas)), it("dua-006", n(3, B.ikhlas)), it("dua-001"), it("dua-002"),
      it("dua-010", n(3, B.harm)), it("dua-050", n(3, B.evil)), it("dua-051", n(3)), it("dua-009"),
    ],
    financial: [
      it("dua-019"), it("dua-045"), it("dua-054"), it("dua-059"), it("dua-055"), it("dua-060"), it("dua-056"), it("dua-046"),
    ],
    emotional: [
      it("dua-057"), it("dua-047"), it("dua-056", undefined, "Dua for Anxiety"), it("dua-061"), it("dua-032"),
      it("dua-048", n(7)), it("dua-049", n(7)),
    ],
  },
  selfRuqyah: {
    preparation: [
      { text: "Make wudu." },
      { text: "Make your intention sincerely for Allah.", source: { label: "Sahih al-Bukhari 1", grade: "Sahih", href: sunnah("bukhari", 1) } },
      { text: "Turn to Allah in sincere repentance.", source: { label: "Qur'an 66:8", href: "/quran/read?s=66&v=8" } },
      { text: "Remove idols and amulets from your home and from your body.", source: { label: "Sunan Abi Dawud 3883", grade: "Sahih", href: sunnah("abudawud", 3883) } },
      { text: "Send blessings on the Prophet, with Durood-e-Ibrahim.", entryId: "dua-058" },
    ],
    ayat: [
      it("dua-004", n(3, B.ikhlas)), it("dua-005", n(3, B.ikhlas)), it("dua-006", n(3, B.ikhlas)), it("dua-001", n(3)), it("dua-002", n(3)),
      it("dua-013"), it("dua-014"), it("dua-015"), it("dua-003", n(3)),
      it("dua-035"), it("dua-036"), it("dua-022"), it("dua-016"), it("dua-029"), it("dua-021"), it("dua-030"), it("dua-028"), it("dua-025"),
      it("dua-027"), it("dua-017"), it("dua-026"), it("dua-024"), it("dua-018"), it("dua-020"), it("dua-019"), it("dua-038"), it("dua-023"), it("dua-034"),
    ],
    duas: [
      it("dua-010", n(3, B.harm)), it("dua-050", n(3, B.evil)), it("dua-051", n(3)), it("dua-009", n(3)), it("dua-007", n(3)),
      it("dua-008", { text: "Bismillah three times, then the dua of refuge seven times", basis: B.pain }), it("dua-053"), it("dua-033", n(3, B.health)),
    ],
  },
};
// Every id in every list must be a real entry.
const known = new Set(out.map((e) => e.id));
for (const list of [...Object.values(library.categories), library.selfRuqyah.ayat, library.selfRuqyah.duas]) for (const i of list as Item[]) if (!known.has(i.id)) throw new Error(`library: unknown entry ${i.id}`);
writeFileSync(join(ROOT, "data", "library.json"), JSON.stringify(library, null, 2) + "\n");

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
  "- Library brief of 2026-10-03: the owner's lists for Recitations and Self-Ruqyah are in `data/library.json`. The earlier titles and counts for dua-034 to dua-040 (Punishing the Enemy, Joint Magic, Stomach Magic, Body Burning, Black Magic Face, Waswasah, Black Magic) were removed because they had no cited source; their passages remain under plain names, and the duplicates (21:69, 57:3, Abu Dawud 5090) were dropped.",
  "- Kept without a graded source at the owner's request (dua-059 Halal Riqz, dua-060 Blessings in Provision, dua-061 Depression): shown by transliteration only, labelled \"Not from a graded hadith. Scholars mention this dua.\" No Arabic exists in the pinned hadith dataset, fitrahive/dua-dhikr or a Hisn al-Muslim dataset. Send the Arabic, the English and where each comes from.",
  "- Transliteration for the narrated Money dua (dua-054) and for Durood-e-Ibrahim (dua-058): none supplied. The owner's Money transliteration is the first-person wording, which is not the narrated text.",
  "- The owner's Ya Hayyu ya Qayyum transliteration (dua-057) leaves out the final 'abadan' of the Arabic.",
  "- Counts: each count from the owner's list is shown with its source when the cited hadith's English text says it (Abu Dawud 5082 for the three Quls, Tirmidhi 3604 for A'udhu bi kalimatillah, Tirmidhi 3388, Muslim 2202, Abu Dawud 3106, Abu Dawud 5090) and as \"Suggested\" otherwise (Fatiha, Ayat al-Kursi, 2:285-286, the evil-eye and children duas, Jibril, Hasbiya Allah and Hasbunallah). Hasbiya Allah x7 rests on Abu Dawud 5081, which Al-Albani grades Mawdu in the dataset, so it is not cited.",
  "- 'Jinn Expulsion Shield' (IMG_2030) is NOT included: its Arabic (the takbir and tahlil formula) cannot be taken from a cited text. It cites 'Sahih Muslim 382 / Jami at-Tirmidhi'; neither matches the formula in the pinned dataset (Muslim 382 is not this text). Send a sourced text or a correct reference and it will be added.",
  "",
  "## Surah Al-Mulk (dua-041)",
  "- The hadith behind the bedtime practice (Tirmidhi 3404, Jabir) says the Prophet would not sleep until he had recited Surah As-Sajdah (32) and Al-Mulk. Only Al-Mulk is in the bedtime set; As-Sajdah is not added.",
  "- Grading is mixed in the dataset: Tirmidhi 3404 is Sahih per Al-Albani and Da'if per Zubair Ali Zai; Tirmidhi 2891 and Abu Dawud 1400 (Al-Mulk intercedes for its reader) are Hasan per Al-Albani. Owner to confirm before publishing.",
  "",
  "## Friday recitation (Surah Al-Kahf)",
  "- Home shows a \"Friday recitation\" box (Surah Al-Kahf) on Fridays by the device's calendar. The hadith on reading it on Friday is not in the pinned dataset (Bukhari, Muslim, Abu Dawud, Tirmidhi), so no virtue or reward is stated in the app. Send a sourced reference and it can be added to the Qur'an entry.",
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
