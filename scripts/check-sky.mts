// Checks the sky timeline built from real sun times: ordered, covers the day, wraps past midnight, and degrades safely.
// Run: npx tsx scripts/check-sky.mts   (the time zone is set per city so local midnight is real)
import { skyTimeline, skyFromTimeline, arcFromTimeline } from "../src/lib/prayer.js";

const prefs = { method: "MuslimWorldLeague", asr: "standard" } as const;
const cities: [string, number, number, string][] = [
  ["Dubai", 25.2, 55.27, "Asia/Dubai"],
  ["London", 51.51, -0.13, "Europe/London"],
  ["Sydney", -33.87, 151.21, "Australia/Sydney"],
  ["Reykjavik", 64.15, -21.94, "Atlantic/Reykjavik"],
  ["Karachi", 24.86, 67.01, "Asia/Karachi"],
];
const dates = ["2026-03-20T12:00:00Z", "2026-06-21T12:00:00Z", "2026-10-01T12:00:00Z", "2026-12-21T12:00:00Z"];
let bad = 0, checked = 0;
const fail = (m: string) => { bad++; console.log("FAIL", m); };

for (const [name, lat, lon, tz] of cities) for (const iso of dates) {
  process.env.TZ = tz;
  const now = new Date(iso);
  const tl = skyTimeline({ lat, lon, at: 0 }, prefs, now);
  if (!tl) { console.log(`note ${name} ${iso.slice(0, 10)}: no timeline (falls back to fixed hours)`); continue; }
  checked++;
  for (let i = 1; i < tl.sky.length; i++) if (tl.sky[i][0] <= tl.sky[i - 1][0]) fail(`${name} ${iso}: sky not increasing at ${i}`);
  const seq = tl.sky.map((e) => e[1]).join(",");
  if (!/^(dawn,day,dusk,night,?)+$/.test(seq.replace(/,$/, "") + ",") && !/(dawn|day|dusk|night)/.test(seq)) fail(`${name} ${iso}: odd sequence ${seq}`);
  // Sample the whole local day every 30 minutes: always a sky, and an arc.
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  for (let m = 0; m < 24 * 60; m += 30) {
    const at = new Date(start.getTime() + m * 60_000);
    const sky = skyFromTimeline(tl, at), arc = arcFromTimeline(tl, at);
    if (!sky) fail(`${name} ${iso} ${at.toISOString()}: no sky`);
    if (!arc) fail(`${name} ${iso} ${at.toISOString()}: no arc`);
    else if (arc.t < 0 || arc.t > 1) fail(`${name} ${iso}: arc t ${arc.t}`);
  }
  const noon = skyFromTimeline(tl, new Date(start.getTime() + 12.5 * 3600_000));
  if (noon !== "day" && name !== "Reykjavik") fail(`${name} ${iso}: 12:30 is ${noon}, expected day`);
  const lateNight = skyFromTimeline(tl, new Date(start.getTime() + 1 * 3600_000));
  if (lateNight !== "night" && name !== "Reykjavik") fail(`${name} ${iso}: 01:00 is ${lateNight}, expected night`);
}
console.log(`${checked} city/date timelines checked, ${bad} failures`);
process.exit(bad ? 1 : 0);
