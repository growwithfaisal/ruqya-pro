// Lists the words whose Arabic vowels cannot be matched to the Latin, so no underline or silent mark is drawn for them.
// Run: npx tsx scripts/diag-translit.mts [limit]
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { arabicEvents, joinVocatives, latinVowelChars, matchVowels } from "./lib/translit-marks.mjs";

const ROOT = join(import.meta.dirname, "..");
const ver = JSON.parse(readFileSync(join(ROOT, "data/quran/chapters.json"), "utf8")).source.dataVersion;
const fails = new Map<string, { n: number; ex: string }>();
const skippedEx: string[] = [];
let words = 0, bad = 0, verses = 0, skipped = 0;
for (let s = 1; s <= 114; s++) {
  const d = JSON.parse(readFileSync(join(ROOT, `public/quran-data/${ver}/${s}.json`), "utf8"));
  for (const v of d) {
    verses++;
    const aw = v.ar.split(/\s+/).filter((w: string) => [...w].some((c) => /[ء-يٱ]/.test(c)));
    const raw = [...v.tr.matchAll(/\S+/g)].map((m: RegExpMatchArray) => ({ text: m[0], at: m.index! }));
    const joined = joinVocatives(aw, raw, v.tr);
    if (!joined) { skipped++; if (skippedEx.length < 8) skippedEx.push(`${s}:${v.n} ar=${aw.length} lat=${raw.length}`); continue; }
    const lw = joined.map((t) => t.text);
    aw.forEach((a: string, i: number) => {
      words++;
      const ev = arabicEvents(a);
      if (!ev || !ev.length) return;
      if (!matchVowels(ev, latinVowelChars(lw[i]))) {
        bad++;
        const key = `${a} | ${lw[i]}`;
        const f = fails.get(key) ?? { n: 0, ex: `${s}:${v.n}` };
        f.n++; fails.set(key, f);
      }
    });
  }
}
console.log(skippedEx.join("  "));
console.log(`${verses} verses; ${skipped} verses skipped (word counts differ); ${words} words checked; ${bad} unmatched`);
const top = [...fails.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, Number(process.argv[2] ?? 40));
for (const [k, f] of top) console.log(String(f.n).padStart(4), f.ex.padEnd(8), k);
