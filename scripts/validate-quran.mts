/** Structural checks on the bundled Qur'an. Fails the build on any gap. */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const meta = JSON.parse(readFileSync(join(ROOT, "data", "quran", "chapters.json"), "utf8"));
const errors: string[] = [];

if (meta.chapters.length !== 114) errors.push(`expected 114 chapters, found ${meta.chapters.length}`);
if (meta.juz.length !== 30) errors.push(`expected 30 juz, found ${meta.juz.length}`);
if (!Array.isArray(meta.pool) || meta.pool.length !== 114) errors.push("missing ayah-of-the-day pool");
if (!meta.bismillah?.trim()) errors.push("missing Bismillah line");

let total = 0;
for (const c of meta.chapters) {
  const file = join(ROOT, "public", "quran-data", meta.source.dataVersion, `${c.id}.json`);
  if (!existsSync(file)) { errors.push(`surah ${c.id}: file missing`); continue; }
  const verses = JSON.parse(readFileSync(file, "utf8")) as { n: number; ar: string; tg?: [number, number, number][]; tr: string; tu?: [number, number][]; ts?: [number, number][]; en: string }[];
  total += verses.length;
  if (verses.length !== c.verses) errors.push(`surah ${c.id}: ${verses.length} verses, expected ${c.verses}`);
  verses.forEach((v, i) => {
    if (v.n !== i + 1) errors.push(`surah ${c.id}: verse ${i + 1} numbered ${v.n}`);
    if (!v.ar.trim()) errors.push(`surah ${c.id}:${v.n}: empty Arabic`);
    let edge = 0;
    for (const [from, to, cls] of v.tg ?? []) {
      if (!(from >= edge && to > from && to <= v.ar.length && cls >= 0 && cls < 15)) errors.push(`surah ${c.id}:${v.n}: bad tajweed range ${from}-${to}`);
      edge = to;
    }
    let tuEdge = 0;
    for (const [from, to] of v.tu ?? []) {
      if (!(from >= tuEdge && to > from && to <= v.tr.length)) errors.push(`surah ${c.id}:${v.n}: bad underline range ${from}-${to}`);
      tuEdge = to;
    }
    let tsEdge = 0;
    for (const [from, to] of v.ts ?? []) {
      if (!(from >= tsEdge && to > from && to <= v.tr.length)) errors.push(`surah ${c.id}:${v.n}: bad silent-letter range ${from}-${to}`);
      tsEdge = to;
    }
    if (!v.en.trim()) errors.push(`surah ${c.id}:${v.n}: empty translation`);
    if (!v.tr.trim()) errors.push(`surah ${c.id}:${v.n}: empty transliteration`);
  });
}
if (total !== 6236) errors.push(`expected 6236 verses, found ${total}`);

// Every juz range must point at a real verse.
for (const j of meta.juz) for (const r of j.ranges) {
  const c = meta.chapters[r.surah - 1];
  if (!c || r.from < 1 || r.to > c.verses) errors.push(`juz ${j.n}: bad range ${r.surah}:${r.from}-${r.to}`);
}

// The short-verse list for reminders (scripts/build-reminder-ayat.mts) must be a faithful, current copy of the source files.
{
  const file = join(ROOT, "public", "quran-data", meta.source.dataVersion, "short.json");
  const exclude = new Set<string>(JSON.parse(readFileSync(join(ROOT, "data", "reminder-ayat-exclude.json"), "utf8")));
  if (!existsSync(file)) errors.push("short.json is missing: run npx tsx scripts/build-reminder-ayat.mts");
  else {
    const short = JSON.parse(readFileSync(file, "utf8")) as [number, number, string][];
    let expected = 0;
    const seen = new Set<string>();
    for (const c of meta.chapters) {
      const verses = JSON.parse(readFileSync(join(ROOT, "public", "quran-data", meta.source.dataVersion, `${c.id}.json`), "utf8")) as { n: number; en: string }[];
      for (const v of verses) if (v.en.length <= 140 && !exclude.has(`${c.id}:${v.n}`)) expected++;
      for (const [s, n, en] of short) {
        if (s !== c.id) continue;
        seen.add(`${s}:${n}`);
        if (verses[n - 1]?.en !== en) errors.push(`short.json ${s}:${n} differs from the source translation`);
        if (exclude.has(`${s}:${n}`)) errors.push(`short.json ${s}:${n} is on the exclusion list`);
      }
    }
    if (seen.size !== short.length) errors.push("short.json has duplicate or unknown verses");
    if (short.length !== expected) errors.push(`short.json has ${short.length} verses, expected ${expected}: run npx tsx scripts/build-reminder-ayat.mts`);
  }
}

if (errors.length) {
  console.error(`\nQur'an validation failed (${errors.length}):\n` + errors.slice(0, 30).map((m) => "  - " + m).join("\n") + "\n");
  process.exit(1);
}
console.log(`Qur'an OK: 114 surahs, ${total} verses, 30 juz.`);
