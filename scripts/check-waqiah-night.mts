// Checks the night the Al-Waqi'ah reminder counts: from Maghrib to Fajr, named by the evening it began, so a reading after
// midnight belongs to the evening before and nothing read in the day counts for tonight.
// Run: npx tsx scripts/check-waqiah-night.mts   (the time zone is set per city so local midnight is real)
import assert from "node:assert/strict";
import { prayerNow } from "../src/lib/prayer.js";
import { addToNight, nightCount, nightOf } from "../src/lib/quran-night.js";

const prefs = { method: "MuslimWorldLeague", asr: "standard" } as const;
let groups = 0, bad = 0;
const ok = (name: string, fn: () => void) => { try { fn(); groups++; } catch (e) { bad++; console.error("FAIL", name, "\n", e); } };

const cities: [string, number, number, string][] = [
  ["London", 51.51, -0.13, "Europe/London"],
  ["Toronto", 43.65, -79.38, "America/Toronto"],
  ["Dubai", 25.2, 55.27, "Asia/Dubai"],
  ["Sydney", -33.87, 151.21, "Australia/Sydney"],
];
const dates = ["2026-03-29", "2026-06-21", "2026-10-03", "2026-12-21"];

ok("with a saved place: Maghrib to Fajr is one night, named by its evening", () => {
  for (const [name, lat, lon, tz] of cities) for (const d of dates) {
    process.env.TZ = tz;
    const place = { lat, lon, at: 0 };
    const [y, m, dd] = d.split("-").map(Number);
    const local = (day: number, h: number, min = 0) => new Date(y, m - 1, day, h, min);
    const pm = prayerNow(place, prefs, local(dd, 12))!;
    assert.ok(pm, `${name} ${d}: prayer times`);
    // Find this evening's Maghrib and tomorrow's Fajr from the prayer table itself.
    let maghrib: Date | null = null, fajr: Date | null = null;
    for (let t = local(dd, 12).getTime(); t < local(dd + 1, 12).getTime(); t += 60_000) {
      const n = prayerNow(place, prefs, new Date(t));
      if (!maghrib && n?.current.name === "Maghrib") maghrib = new Date(t);
      if (maghrib && !fajr && n?.current.name === "Fajr") fajr = new Date(t);
    }
    assert.ok(maghrib && fajr, `${name} ${d}: found Maghrib and Fajr`);
    const minus = (t: Date, mins: number) => new Date(t.getTime() - mins * 60_000);
    const plus = (t: Date, mins: number) => new Date(t.getTime() + mins * 60_000);
    assert.equal(nightOf(minus(maghrib!, 2), place, prefs), null, `${name} ${d}: before Maghrib`);
    assert.equal(nightOf(plus(maghrib!, 2), place, prefs), d, `${name} ${d}: just after Maghrib`);
    assert.equal(nightOf(local(dd, 23, 50), place, prefs), d, `${name} ${d}: before midnight`);
    assert.equal(nightOf(local(dd + 1, 0, 30), place, prefs), d, `${name} ${d}: after midnight is still the same night`);
    assert.equal(nightOf(minus(fajr!, 2), place, prefs), d, `${name} ${d}: just before Fajr`);
    assert.equal(nightOf(plus(fajr!, 2), place, prefs), null, `${name} ${d}: after Fajr`);
    assert.equal(nightOf(local(dd, 14), place, prefs), null, `${name} ${d}: the afternoon is not the night`);
  }
});

ok("without a place: 18:30 to 05:00", () => {
  process.env.TZ = "America/New_York";
  const at = (s: string) => new Date(s);
  assert.equal(nightOf(at("2026-10-03T18:29:00"), null, prefs), null);
  assert.equal(nightOf(at("2026-10-03T18:30:00"), null, prefs), "2026-10-03");
  assert.equal(nightOf(at("2026-10-04T00:40:00"), null, prefs), "2026-10-03");
  assert.equal(nightOf(at("2026-10-04T04:59:00"), null, prefs), "2026-10-03");
  assert.equal(nightOf(at("2026-10-04T05:00:00"), null, prefs), null);
  assert.equal(nightOf(at("2026-11-02T01:30:00"), null, prefs), "2026-11-01", "the night the clocks go back");
  assert.equal(nightOf(at("2027-01-01T00:10:00"), null, prefs), "2026-12-31", "across the new year");
});

ok("the reported bug: a reading before midnight still shows after midnight, and one after midnight does not carry to the next evening", () => {
  let rec = addToNight(null, "2026-10-03", "56:1")!;
  rec = addToNight(rec, "2026-10-03", "56:2")!;
  assert.equal(nightCount(rec, "2026-10-03", 56), 2, "23:30 tonight");
  assert.equal(nightCount(rec, "2026-10-03", 56), 2, "00:40, still the night of the 3rd");
  assert.equal(nightCount(rec, "2026-10-04", 56), 0, "the next evening starts at zero");
  assert.equal(nightCount(rec, null, 56), 0, "the daytime has no night");
  assert.equal(addToNight(rec, "2026-10-03", "56:2"), null, "a verse read twice is counted once");
  assert.deepEqual(addToNight(rec, "2026-10-04", "56:5"), { date: "2026-10-04", keys: ["56:5"] }, "a new night starts empty");
});

console.log(`${groups} groups passed${bad ? `, ${bad} FAILED` : ""}`);
process.exit(bad ? 1 : 0);
