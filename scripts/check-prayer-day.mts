// Checks the rows behind the "all prayer times" panel: six times in order, one running now (none between midnight and Fajr),
// the right one next, and tomorrow's Fajr offered only once Isha has passed.
// Run: npx tsx scripts/check-prayer-day.mts   (the time zone is set per city so local midnight is real)
import { dayRows, methodLabel, prayerNow } from "../src/lib/prayer.js";

const prefs = { method: "MuslimWorldLeague", asr: "standard" } as const;
const cities: [string, number, number, string][] = [
  ["London", 51.51, -0.13, "Europe/London"],
  ["Dubai", 25.2, 55.27, "Asia/Dubai"],
  ["Sydney", -33.87, 151.21, "Australia/Sydney"],
  ["Karachi", 24.86, 67.01, "Asia/Karachi"],
];
const dates = ["2026-03-20", "2026-06-21", "2026-10-02", "2026-12-21"];
let bad = 0, checked = 0;
const fail = (m: string) => { bad++; console.log("FAIL", m); };

for (const [name, lat, lon, tz] of cities) for (const d of dates) {
  process.env.TZ = tz;
  const place = { lat, lon, at: 0 };
  const start = new Date(`${d}T00:00:00`);
  for (let m = 0; m < 24 * 60; m += 20) {
    const now = new Date(start.getTime() + m * 60_000);
    const tag = `${name} ${d} ${now.toTimeString().slice(0, 5)}`;
    const v = dayRows(place, prefs, now), n = prayerNow(place, prefs, now);
    if (!v) { fail(`${tag}: no rows`); continue; }
    checked++;
    if (v.rows.length !== 6) fail(`${tag}: ${v.rows.length} rows`);
    for (let i = 1; i < v.rows.length; i++) if (v.rows[i].at <= v.rows[i - 1].at) fail(`${tag}: rows out of order at ${i}`);
    const now_ = v.rows.filter((r) => r.state === "now"), next = v.rows.filter((r) => r.state === "next");
    if (now_.length > 1 || next.length > 1) fail(`${tag}: ${now_.length} now, ${next.length} next`);
    const first = v.rows[0].at.getTime(), last = v.rows[5].at.getTime();
    // Before today's Fajr nothing is running (yesterday's Isha is); Fajr is next.
    if (now.getTime() < first) {
      if (now_.length) fail(`${tag}: a prayer is running before Fajr`);
      if (next[0]?.name !== "Fajr") fail(`${tag}: next before Fajr is ${next[0]?.name}`);
      if (v.tomorrowFajr) fail(`${tag}: tomorrow's Fajr offered before Fajr`);
    }
    // After today's Isha it is running, nothing is next in the list, and tomorrow's Fajr is offered.
    if (now.getTime() >= last) {
      if (now_[0]?.name !== "Isha") fail(`${tag}: after Isha, running is ${now_[0]?.name}`);
      if (next.length) fail(`${tag}: a next prayer in today's list after Isha`);
      if (!v.tomorrowFajr || v.tomorrowFajr.name !== "Fajr" || v.tomorrowFajr.at.getTime() <= now.getTime()) fail(`${tag}: no tomorrow's Fajr after Isha`);
    } else if (v.tomorrowFajr) fail(`${tag}: tomorrow's Fajr offered before Isha`);
    // The marks agree with the card's own idea of now and next.
    if (n) {
      const c = v.rows.find((r) => r.at.getTime() === n.current.at.getTime()), x = v.rows.find((r) => r.at.getTime() === n.next.at.getTime());
      if (c && c.state !== "now") fail(`${tag}: ${c.name} is current but marked ${c.state}`);
      if (x && x.state !== "next") fail(`${tag}: ${x.name} is next but marked ${x.state}`);
    }
    // Everything before the running one has passed; everything after the next is still to come.
    for (const r of v.rows) {
      if (r.state === "past" && r.at > now) fail(`${tag}: ${r.name} marked past but is ahead`);
      if (r.state === "later" && r.at <= now) fail(`${tag}: ${r.name} marked later but has passed`);
    }
  }
}

const label = methodLabel({ method: "auto", asr: "hanafi" });
if (!/\(automatic\)$/.test(label.method) || label.asr !== "Hanafi") fail(`methodLabel auto/hanafi gave ${JSON.stringify(label)}`);
const named = methodLabel({ method: "Karachi", asr: "standard" });
if (named.method !== "University of Islamic Sciences, Karachi" || named.asr !== "Standard") fail(`methodLabel Karachi gave ${JSON.stringify(named)}`);

console.log(`${checked} moments checked, ${bad} failures`);
process.exit(bad ? 1 : 0);
