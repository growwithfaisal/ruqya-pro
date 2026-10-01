// Samples every blend of the prayer card's sky and reports the weakest text contrast. Run: npx tsx scripts/check-daylight.mts
import { daylight, contrast, nextSky, type SkyName } from "../src/lib/daylight.js";
const names: SkyName[] = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"];
let min = 99, where = "";
for (const n of names) for (let i = 0; i <= 100; i++) {
  const d = daylight(n, nextSky(n), i / 100);
  const c = Math.min(contrast(d.ink, d.top), contrast(d.ink, d.bottom));
  if (c < min) { min = c; where = `${n}→${nextSky(n)} @${i}%`; }
}
console.log(`weakest contrast ${min.toFixed(2)}:1 at ${where}`);
if (min < 4.5) process.exit(1);
