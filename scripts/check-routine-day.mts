// The routine day must start at 04:00 (when the morning set begins), so a bedtime read after midnight belongs to the night before.
// Run: npx tsx scripts/check-routine-day.mts
import { routineDay } from "../src/lib/progress.js";

process.env.TZ = "Asia/Dubai";
const at = (s: string) => new Date(s);
const cases: [string, string][] = [
  ["2026-10-01T23:59:00+04:00", "2026-10-01"], // bedtime, same night
  ["2026-10-02T00:30:00+04:00", "2026-10-01"], // bedtime, after midnight: still the night of the 1st
  ["2026-10-02T03:59:00+04:00", "2026-10-01"],
  ["2026-10-02T04:00:00+04:00", "2026-10-02"], // morning begins: a new routine day
  ["2026-10-02T19:59:00+04:00", "2026-10-02"],
  ["2026-10-02T21:00:00+04:00", "2026-10-02"],
];
let bad = 0;
for (const [t, want] of cases) {
  const got = routineDay(at(t));
  if (got !== want) { bad++; console.log(`FAIL ${t}: ${got}, expected ${want}`); }
}
console.log(bad ? `${bad} failed` : `routine day ok (${cases.length} cases)`);
process.exit(bad ? 1 : 0);
