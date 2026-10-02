/**
 * Makes public/quran-data/<version>/short.json: the verses whose Saheeh International translation is short enough to read
 * on a lock screen, for the "verses" reminders. Nothing is written or edited by hand: each entry is copied unchanged from
 * the already-sourced surah files, and scripts/validate-quran.mts checks that on every build.
 * To keep a verse out of the reminders, add "surah:verse" (for example "9:5") to data/reminder-ayat-exclude.json and run this again.
 * Run: npx tsx scripts/build-reminder-ayat.mts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const MAX_CHARS = 140;
const ROOT = join(import.meta.dirname, "..");
const meta = JSON.parse(readFileSync(join(ROOT, "data", "quran", "chapters.json"), "utf8"));
const dir = join(ROOT, "public", "quran-data", meta.source.dataVersion);
const exclude = new Set<string>(JSON.parse(readFileSync(join(ROOT, "data", "reminder-ayat-exclude.json"), "utf8")));

const out: [number, number, string][] = [];
for (const c of meta.chapters) {
  const verses = JSON.parse(readFileSync(join(dir, `${c.id}.json`), "utf8")) as { n: number; en: string }[];
  for (const v of verses) if (v.en.length <= MAX_CHARS && !exclude.has(`${c.id}:${v.n}`)) out.push([c.id, v.n, v.en]);
}
writeFileSync(join(dir, "short.json"), JSON.stringify(out));
console.log(`${out.length} verses of ${MAX_CHARS} characters or fewer written to ${meta.source.dataVersion}/short.json (${exclude.size} excluded).`);
