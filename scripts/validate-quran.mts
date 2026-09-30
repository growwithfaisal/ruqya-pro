/** Structural checks on the bundled Qur'an. Fails the build on any gap. */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const meta = JSON.parse(readFileSync(join(ROOT, "data", "quran", "chapters.json"), "utf8"));
const errors: string[] = [];

if (meta.chapters.length !== 114) errors.push(`expected 114 chapters, found ${meta.chapters.length}`);
if (meta.juz.length !== 30) errors.push(`expected 30 juz, found ${meta.juz.length}`);
if (!meta.bismillah?.trim()) errors.push("missing Bismillah line");

let total = 0;
for (const c of meta.chapters) {
  const file = join(ROOT, "public", "quran-data", meta.source.dataVersion, `${c.id}.json`);
  if (!existsSync(file)) { errors.push(`surah ${c.id}: file missing`); continue; }
  const verses = JSON.parse(readFileSync(file, "utf8")) as { n: number; ar: string; tr: string; en: string }[];
  total += verses.length;
  if (verses.length !== c.verses) errors.push(`surah ${c.id}: ${verses.length} verses, expected ${c.verses}`);
  verses.forEach((v, i) => {
    if (v.n !== i + 1) errors.push(`surah ${c.id}: verse ${i + 1} numbered ${v.n}`);
    if (!v.ar.trim()) errors.push(`surah ${c.id}:${v.n}: empty Arabic`);
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

if (errors.length) {
  console.error(`\nQur'an validation failed (${errors.length}):\n` + errors.slice(0, 30).map((m) => "  - " + m).join("\n") + "\n");
  process.exit(1);
}
console.log(`Qur'an OK: 114 surahs, ${total} verses, 30 juz.`);
