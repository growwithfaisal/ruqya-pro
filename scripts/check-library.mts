// Checks the owner's lists (data/library.json) against the owner's brief of 2026-10-03: the right entries, in the right order, with
// the right counts, each Qur'an entry equal to the Qur'an data, and the duas without a source clearly marked.
// Run: npx tsx scripts/check-library.mts          (add --online to re-fetch the hadith dataset and compare every hadith entry's Arabic)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

type Count = { times?: number; text?: string; basis: string | null };
type Item = { id: string; title?: string; count?: Count };
type Entry = { id: string; title: string; slug: string; arabic: string; transliteration: string; translation: string; unsourced?: boolean; grade: string; source: { book: string; ref: string }; verified: boolean };

const ROOT = join(import.meta.dirname, "..");
const entries = JSON.parse(readFileSync(join(ROOT, "data/entries.json"), "utf8")) as Entry[];
const lib = JSON.parse(readFileSync(join(ROOT, "data/library.json"), "utf8")) as { categories: Record<string, Item[]>; selfRuqyah: { preparation: { text: string; entryId?: string; source?: { label: string } }[]; ayat: Item[]; duas: Item[] } };
const by = new Map(entries.map((e) => [e.id, e]));
const title = (i: Item) => i.title ?? by.get(i.id)!.title;

let groups = 0, bad = 0;
const ok = (name: string, fn: () => void | Promise<void>) => Promise.resolve().then(fn).then(() => { groups++; }).catch((e) => { bad++; console.error("FAIL", name, "\n", e.message ?? e); });

/** What each list must hold: the owner's order, with the owner's names. */
const WANT: Record<string, string[]> = {
  "daily-protection": ["Surah Al-Fatiha", "Ayat al-Kursi", "Surah Al-Ikhlas", "Surah Al-Falaq", "Surah An-Nas", "Surah Al-Kahf (18:1-10)", "Dua for Protection From Harm", "Dua for Protection From Evil"],
  pain: ["Surah Al-Fatiha", "Dua for Pain", "Dua for Visiting a Sick Person", "Dua for Healing", "Surah Al-Anbiya (21:83)", "Surah Ar-Rahman"],
  "evil-eye": ["Surah Al-Ikhlas", "Surah Al-Falaq", "Surah An-Nas", "Surah Al-Fatiha", "Ayat al-Kursi", "Dua for Protection From Harm", "Dua for Protection From Evil", "Dua for Evil Eye", "Dua for Protection of Children"],
  financial: ["Surah At-Talaq (65:2-3)", "Surah Al-Mu'minun (23:115-118)", "Dua for Money", "Dua for Halal Riqz", "Dua to Remove Mountains of Debt", "Dua for Blessings in Provision", "Dua for Protection from Debt and Anxiety", "Suleiman (AS) Dua for Wealth"],
  emotional: ["Prophet (SAW) Dua for Worry", "Yunus (AS) Dua for Distress", "Dua for Anxiety", "Dua for Depression", "Dua for Extreme Distress", "Statement of Trust and Letting Go (1 of 2)", "Statement of Trust and Letting Go (2 of 2)"],
};
const AYAT = [
  "Surah Al-Ikhlas", "Surah Al-Falaq", "Surah An-Nas", "Surah Al-Fatiha", "Ayat al-Kursi",
  "Surah Al-Baqarah (2:1-12)", "Surah Al-Baqarah (2:102)", "Surah Al-Baqarah (2:163-164)", "Surah Al-Baqarah (2:285-286)",
  "Ruqyah for Joint Magic", "Destroy Stomach Magic", "Surah Al-An'am (6:61)", "Surah Al-A'raf (7:54-56)", "Surah Al-A'raf (7:117)", "Surah Hud (11:57)", "Surah Al-Hijr (15:18)",
  "Ruqyah for Body Burning", "Surah Ash-Shu'ara (26:80)", "Surah An-Naml (27:1)", "Surah As-Saffat (37:1-10)", "Surah Fussilat (41:12)", "Destroy Waswasah With Ruqyah",
  "Surah Al-Hashr (59:21-24)", "Surah As-Saff (61:13)", "Surah At-Talaq (65:2-3)", "Black Magic Face Ruqyah", "Surah At-Tariq (86:4)", "Ruqyah for Punishing the Enemy",
];
const DUAS = ["Dua for Protection From Harm", "Dua for Protection From Evil", "Dua for Evil Eye", "Dua for Protection of Children", "Jibril (AS) Dua for Ruqyah", "Dua for Pain", "Dua for Healing", "Dua for Good Health", "Seeking refuge in Allah's might", "Dua for Extreme Distress"];

/** The counts the owner listed, as the app should label them. A source is named only where the cited hadith says the count. */
const COUNT = (id: string, list: string): string => {
  const c = ([...(lib.categories[list] ?? []), ...(list === "ayat" ? lib.selfRuqyah.ayat : []), ...(list === "duas" ? lib.selfRuqyah.duas : [])].find((i) => i.id === id))?.count;
  if (!c) return "";
  const what = c.text ?? { 3: "Three times", 7: "Seven times" }[c.times!] ?? `${c.times} times`;
  return c.basis ? `${what} · ${c.basis}` : `Suggested: ${what.charAt(0).toLowerCase()}${what.slice(1)}`;
};

await ok("every section holds the owner's items, in the owner's order, under the owner's names", () => {
  for (const [id, want] of Object.entries(WANT)) assert.deepEqual(lib.categories[id].map(title), want, id);
  assert.deepEqual(lib.selfRuqyah.ayat.map(title), AYAT);
  assert.deepEqual(lib.selfRuqyah.duas.map(title), DUAS);
  assert.equal(lib.selfRuqyah.ayat.length, 28);
  assert.deepEqual(Object.keys(lib.categories), ["daily-protection", "pain", "evil-eye", "financial", "emotional"]);
});

await ok("no entry twice in one list, and every item is a real entry", () => {
  for (const [name, list] of [...Object.entries(lib.categories), ["ayat", lib.selfRuqyah.ayat], ["duas", lib.selfRuqyah.duas]] as [string, Item[]][]) {
    assert.equal(new Set(list.map((i) => i.id)).size, list.length, `${name} repeats an entry`);
    for (const i of list) assert.ok(by.has(i.id), `${name}: ${i.id}`);
  }
});

await ok("counts: the owner's numbers, each with its source or marked as suggested", () => {
  const sources: Record<string, string> = { "Abu Dawud 5082": "the three Quls", "Tirmidhi 3604": "A'udhu bi kalimatillah", "Tirmidhi 3388": "Protection From Harm", "Muslim 2202": "the pain dua", "Abu Dawud 3106": "visiting the sick", "Abu Dawud 5090": "good health" };
  assert.equal(COUNT("dua-004", "daily-protection"), "Three times · Abu Dawud 5082");
  assert.equal(COUNT("dua-010", "daily-protection"), "Three times · Tirmidhi 3388");
  assert.equal(COUNT("dua-050", "daily-protection"), "Three times · Tirmidhi 3604");
  assert.equal(COUNT("dua-001", "pain"), "Suggested: seven times");
  assert.equal(COUNT("dua-008", "pain"), "Bismillah three times, then the dua of refuge seven times · Muslim 2202");
  assert.equal(COUNT("dua-052", "pain"), "Seven times · Abu Dawud 3106");
  assert.equal(COUNT("dua-051", "evil-eye"), "Suggested: three times");
  assert.equal(COUNT("dua-048", "emotional"), "Suggested: seven times", "Hasbiya Allah rests on a hadith graded Mawdu: never cited");
  assert.equal(COUNT("dua-049", "emotional"), "Suggested: seven times");
  assert.equal(COUNT("dua-001", "ayat"), "Suggested: three times");
  assert.equal(COUNT("dua-002", "ayat"), "Suggested: three times");
  assert.equal(COUNT("dua-003", "ayat"), "Suggested: three times");
  assert.equal(COUNT("dua-033", "duas"), "Three times · Abu Dawud 5090");
  assert.equal(COUNT("dua-007", "duas"), "Suggested: three times");
  assert.equal(COUNT("dua-009", "duas"), "Suggested: three times");
  for (const l of [...Object.values(lib.categories), lib.selfRuqyah.ayat, lib.selfRuqyah.duas]) for (const i of l) if (i.count?.basis) assert.ok(i.count.basis in sources, `unknown count source ${i.count.basis}`);
  // The rest of the lists carry no count at all.
  for (const id of ["dua-019", "dua-045", "dua-054", "dua-055", "dua-056", "dua-046", "dua-057", "dua-047", "dua-032"]) for (const l of Object.values(lib.categories)) assert.equal(l.find((i) => i.id === id)?.count, undefined, id);
});

await ok("one dua, two names: the anxiety dua is named differently in Financial Blockages and Emotional Reset", () => {
  assert.equal(title(lib.categories.financial.find((i) => i.id === "dua-056")!), "Dua for Protection from Debt and Anxiety");
  assert.equal(title(lib.categories.emotional.find((i) => i.id === "dua-056")!), "Dua for Anxiety");
});

await ok("Qur'an entries are exactly the Qur'an data", () => {
  const dir = join(ROOT, "public/quran-data/v6");
  let n = 0;
  for (const e of entries) {
    if (e.source.book !== "The Qur'an") continue;
    const m = /^(\d+):(\d+)(?:-(\d+))?$/.exec(e.source.ref);
    assert.ok(m, `${e.id} ref ${e.source.ref}`);
    const verses = JSON.parse(readFileSync(join(dir, `${m![1]}.json`), "utf8")) as { n: number; ar: string }[];
    const from = Number(m![2]), to = Number(m![3] ?? m![2]);
    assert.equal(e.arabic, verses.slice(from - 1, to).map((v) => v.ar).join(" "), `${e.id} ${e.title}`);
    n++;
  }
  assert.ok(n >= 30, `${n} Qur'an entries checked`);
});

await ok("the duas without a source: no grade, the owner's transliteration, never verified; Arabic only where the owner supplied it", () => {
  const un = entries.filter((e) => e.unsourced) as (Entry & { provenance: Record<string, string> })[];
  assert.deepEqual(un.map((e) => e.id), ["dua-059", "dua-060", "dua-061"]);
  for (const e of un) {
    assert.equal(e.grade, "");
    assert.equal(e.verified, false);
    assert.ok(e.transliteration.length > 10);
    if (e.arabic) assert.match(e.provenance.arabic, /supplied by the owner/i, `${e.id}: Arabic must be recorded as owner-supplied`);
  }
  assert.equal(by.get("dua-059")!.transliteration, "Ya Razzaqu urzuqni halalan tayyiba.");
  assert.equal(by.get("dua-061")!.transliteration, "Allahumma Akhrijnee min adhulumaati ilaa annur.");
  // Halal Riqz: the Arabic and English printed on the owner's image. A mistyped letter would show here; the marks themselves are the owner's to check.
  const riqz = by.get("dua-059")! as Entry & { provenance: Record<string, string> };
  const plain = riqz.arabic.replace(/[\u064B-\u0652]/g, "").replace(/\u0649/g, "\u064A");
  assert.equal(plain, "\u064A\u0627 \u0631\u0632\u0627\u0642 \u0627\u0631\u0632\u0642\u0646\u064A \u062D\u0644\u0627\u0644\u0627 \u0637\u064A\u0628\u0627", "Halal Riqz letters");
  assert.equal(riqz.arabic.split(" ").length, 5);
  assert.equal(riqz.translation, "O The provider! please provide me with halal and good rizq.");
  assert.match(riqz.provenance.translation, /not a cited translation/);
  assert.equal(by.get("dua-060")!.arabic, "");
  assert.equal(by.get("dua-061")!.arabic, "");
});

await ok("the new hadith duas have Arabic, a grade and a cited book; the old claim-titled entries are gone", () => {
  for (const id of ["dua-050", "dua-051", "dua-052", "dua-053", "dua-054", "dua-055", "dua-056", "dua-057", "dua-058"]) {
    const e = by.get(id)!;
    assert.ok(e.arabic.trim().length > 10, `${id} Arabic`);
    assert.ok(["Sahih", "Hasan"].includes(e.grade), `${id} grade ${e.grade}`);
    assert.ok(e.source.book && e.source.ref, `${id} source`);
    assert.ok(e.translation.trim(), `${id} translation`);
  }
  // Money: the owner's first-person transliteration adapted to the narrated third-person Arabic, and recorded as such.
  const money = by.get("dua-054")! as Entry & { provenance: Record<string, string> };
  assert.equal(money.transliteration, "Allahumma \u2018akthir m\u0101lahu wa waladahu, wa b\u0101rik lahu feem\u0101 a\u2018taytahu.");
  assert.match(money.provenance.transliteration, /adapted word for word/);
  assert.ok(!/m\u0101lee|waladee|a\u2018taytanee/.test(money.transliteration), "the first-person endings must not appear under third-person Arabic");
  for (const gone of ["dua-037", "dua-039", "dua-040"]) assert.equal(by.has(gone), false, gone);
  // Titles that make a claim are kept only where the owner chose them: six passages, titled as in the owner's earlier collection.
  const OWNER_TITLED = new Set(["dua-034", "dua-035", "dua-036", "dua-038", "dua-028", "dua-024"]);
  for (const e of entries) if (!OWNER_TITLED.has(e.id)) assert.ok(!/magic|punishing|burning|waswasah/i.test(e.title), `${e.id} carries a claim in its title: ${e.title}`);
});

await ok("six passages carry the owner's own titles everywhere, with the surah named under them and no count", async () => {
  const { surahName } = await import("../src/lib/entries");
  const WANT_TITLES: Record<string, [string, string]> = {
    "dua-034": ["Ruqyah for Punishing the Enemy", "Surah Al-Masad"], "dua-035": ["Ruqyah for Joint Magic", "Surah Ali 'Imran"],
    "dua-036": ["Destroy Stomach Magic", "Surah An-Nisa"], "dua-038": ["Black Magic Face Ruqyah", "Surah Al-Qiyamah"],
    "dua-028": ["Ruqyah for Body Burning", "Surah Al-Anbiya"], "dua-024": ["Destroy Waswasah With Ruqyah", "Surah Al-Hadid"],
  };
  for (const [id, [t, surah]] of Object.entries(WANT_TITLES)) {
    const e = by.get(id)!;
    assert.equal(e.title, t, `${id}: the title is on the entry, not a list-only override`);
    assert.equal(surahName(e as never), surah, `${id}: surah line`);
    assert.equal(lib.selfRuqyah.ayat.find((i) => i.id === id)?.title, undefined, `${id}: no list-level title`);
    assert.equal(lib.selfRuqyah.ayat.find((i) => i.id === id)?.count, undefined, `${id}: the collection's count had no source and is not shown`);
  }
  assert.equal(surahName(by.get("dua-004") as never), "", "a title that already names the surah gets no extra line");
  assert.equal(surahName(by.get("dua-010") as never), "", "hadith have no surah");
  assert.equal(by.has("dua-037") || by.has("dua-039") || by.has("dua-040"), false);
});

await ok("owner's transliteration is kept exactly as typed", () => {
  assert.equal(by.get("dua-050")!.transliteration, "A’ūdhu bi kalimāti-llāhit-tāmmāti min sharri mā khalaq.");
  assert.equal(by.get("dua-052")!.transliteration, "As'alullāha ‘l-`Aẓīma Rabba ‘l-`Arshil-`Aẓīmi an yashfiyak.");
  assert.equal(by.get("dua-057")!.transliteration, "Yā Ḥayyu yā Qayyūm, bi-raḥmatika astaghīth, aṣliḥ lī sha’nī kullah, wa lā takilnī ilā nafsī ṭarfata ʿayn.");
  // Durood-e-Ibrahim: the owner's two lines as printed on their image, one per half of the Arabic.
  const durood = by.get("dua-058")! as Entry & { provenance: Record<string, string> };
  assert.deepEqual(durood.transliteration.split("\n"), [
    "Allaahumma salli 'alaa Muhammadinw wa 'alaa 'aali Muhammad; kamaa sallayta 'alaa 'Ibraaheema wa 'alaa 'aali 'Ibraaheem, 'innaka Hameedun Majeed.",
    "Allaahumma baarik 'alaa Muhammadinw wa 'alaa 'aali Muhammad; kamaa baarakta 'alaa 'Ibraaheema wa 'alaa 'aali 'Ibraaheem, 'innaka Hameedun Majeed.",
  ]);
  assert.match(durood.provenance.transliteration, /Supplied by the owner/);
  assert.equal(durood.source.ref, "3370", "its Arabic and English stay the cited Bukhari text");
});

await ok("Preparation: five steps, sources only where the data has them", () => {
  const p = lib.selfRuqyah.preparation;
  assert.equal(p.length, 5);
  assert.deepEqual(p.map((s) => s.source?.label ?? null), [null, "Sahih al-Bukhari 1", "Qur'an 66:8", "Sunan Abi Dawud 3883", null]);
  assert.equal(p[4].entryId, "dua-058");
});

if (process.argv.includes("--online")) {
  await ok("every new hadith entry's Arabic is cut verbatim from the pinned dataset", async () => {
    const BASE = "https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@df57907be35291c91ad6a6691180e22ca9920784/editions";
    const MARKS = /[ً-ٰٟۖ-ۭـ]/g;
    const plain = (s: string) => s.replace(MARKS, "").replace(/[ٱأإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/\s+/g, " ");
    const map: Record<string, [string, string]> = { "dua-050": ["muslim", "2709"], "dua-051": ["bukhari", "3371"], "dua-052": ["abudawud", "3106"], "dua-053": ["bukhari", "5743"], "dua-054": ["bukhari", "6334"], "dua-055": ["tirmidhi", "3563"], "dua-056": ["bukhari", "6369"], "dua-058": ["bukhari", "3370"] };
    const cache: Record<string, { hadiths: { arabicnumber: number | string; text: string }[] }> = {};
    for (const [id, [col, no]] of Object.entries(map)) {
      cache[col] ??= await (await fetch(`${BASE}/ara-${col}.json`)).json();
      const h = cache[col].hadiths.find((x) => String(x.arabicnumber).split(".")[0] === no)!;
      for (const line of by.get(id)!.arabic.split("\n")) assert.ok(plain(h.text).includes(plain(line)), `${id} is not in ${col} ${no}`);
    }
  });
}

console.log(`${groups} groups passed${bad ? `, ${bad} FAILED` : ""}`);
process.exit(bad ? 1 : 0);
