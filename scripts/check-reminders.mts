// Checks the reminder schedule the phone builds (src/lib/reminder-schedule.ts) and the service worker's choice of what to show
// (public/reminders-sw.js). Run: npx tsx scripts/check-reminders.mts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { DEFAULT_PREFS, HORIZON_DAYS, atTime, buildSchedule, serverTimes, versesFor, type Item, type ReminderPrefs, type ShortVerse } from "../src/lib/reminder-schedule";
import { readHref } from "../src/lib/quran";

const ROOT = join(import.meta.dirname, "..");
const short = JSON.parse(readFileSync(join(ROOT, "public/quran-data/v6/short.json"), "utf8")) as ShortVerse[];
const { dueNow, prune } = createRequire(import.meta.url)("../public/reminders-sw.js") as {
  dueNow: (items: Item[], shown: Record<string, number>, now: number) => { show: Item[]; mark: boolean };
  prune: (shown: Record<string, number>, now: number) => Record<string, number>;
};

let groups = 0, bad = 0;
const ok = (name: string, fn: () => void) => { try { fn(); groups++; } catch (e) { bad++; console.error("FAIL", name, "\n", e); } };

const place = { lat: 51.51, lon: -0.13, at: 0 };
const prayer = { method: "MuslimWorldLeague", asr: "standard" } as const;
const all: ReminderPrefs = { ...DEFAULT_PREFS, on: true, ayat: { on: true, times: ["11:00", "20:00"] } };
const build = (prefs: ReminderPrefs, now: Date, p = place as typeof place | null) => buildSchedule(prefs, { place: p, prayer, now, short });

process.env.TZ = "Europe/London";
const NOW = new Date("2026-10-02T08:00:00+01:00");

ok("everything on: ordered, in range, within the server's limit, and tells the server only minutes", () => {
  const items = build(all, NOW);
  assert.ok(items.length > 350 && items.length <= 590, `${items.length} items`);
  for (let i = 1; i < items.length; i++) assert.ok(items[i].at >= items[i - 1].at);
  assert.ok(items.every((i) => i.at > NOW.getTime()));
  assert.ok(items[items.length - 1].at < NOW.getTime() + (HORIZON_DAYS + 1) * 86400_000);
  assert.equal(new Set(items.map((i) => i.id)).size, items.length, "ids are unique (they are the notification tags)");
  const times = serverTimes(items);
  assert.ok(times.every((t) => t % 60 === 0));
  assert.deepEqual(times, [...new Set(times)].sort((a, b) => a - b));
  assert.ok(times.length <= items.length);
});

ok("five prayers a day, titled and worded plainly", () => {
  const items = build({ ...DEFAULT_PREFS, on: true, adhkar: { morning: { on: false, time: "07:00" }, evening: { on: false, time: "17:00" }, bedtime: { on: false, time: "22:00" } }, friday: { on: false, time: "09:00" } }, NOW);
  const p = items.filter((i) => i.id.startsWith("p:"));
  const day2 = p.filter((i) => i.id.endsWith("2026-10-03"));
  assert.deepEqual(day2.map((i) => i.title), ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"]);
  assert.ok(day2.every((i) => /^It is time for \w+\.$/.test(i.body)));
  assert.equal(p.filter((i) => i.title === "Sunrise").length, 0);
});

ok("a lead brings prayers forward and says so", () => {
  const now = build({ ...DEFAULT_PREFS, on: true }, NOW).find((i) => i.id === "p:asr:2026-10-03")!;
  const early = build({ ...DEFAULT_PREFS, on: true, lead: 10 }, NOW).find((i) => i.id === "p:asr:2026-10-03")!;
  assert.equal(now.at - early.at, 10 * 60_000);
  assert.equal(early.body, "Asr is in 10 minutes.");
});

ok("switching a prayer off removes it; no place means no prayers but the rest remain", () => {
  const prefs = { ...DEFAULT_PREFS, on: true, prayers: { ...DEFAULT_PREFS.prayers, fajr: false } };
  assert.equal(build(prefs, NOW).filter((i) => i.id.startsWith("p:fajr")).length, 0);
  const none = build({ ...DEFAULT_PREFS, on: true }, NOW, null);
  assert.equal(none.filter((i) => i.id.startsWith("p:")).length, 0);
  assert.ok(none.filter((i) => i.id.startsWith("a:")).length > 100);
});

ok("adhkar land at the chosen clock time, opening the matching routine", () => {
  const items = build({ ...DEFAULT_PREFS, on: true }, NOW);
  const m = items.find((i) => i.id === "a:morning:2026-10-03")!;
  assert.equal(new Date(m.at).getHours(), 7);
  assert.equal(new Date(m.at).getMinutes(), 0);
  assert.equal(m.url, "/recitations?set=morning");
  assert.equal(m.title, "Morning adhkar");
  assert.equal(items.find((i) => i.id === "a:bedtime:2026-10-03")!.url, "/recitations?set=bedtime");
  // Today's morning time has passed at 08:00, so it is not in the list.
  assert.equal(items.some((i) => i.id === "a:morning:2026-10-02"), false);
  assert.equal(items.some((i) => i.id === "a:evening:2026-10-02"), true);
});

ok("Friday: only Fridays, and it opens Al-Kahf", () => {
  const f = build({ ...DEFAULT_PREFS, on: true }, NOW).filter((i) => i.id.startsWith("f:"));
  assert.ok(f.length >= 6 && f.length <= 7, `${f.length} Fridays`);
  for (const i of f) { assert.equal(new Date(i.at).getDay(), 5); assert.equal(i.url, readHref(18)); assert.match(i.body, /^Surah Al-Kahf, 110 verses\.$/); }
});

ok("daylight saving: the clock time holds on the day the clocks change", () => {
  process.env.TZ = "America/New_York";
  const now = new Date("2026-03-07T12:00:00-05:00");
  const items = build({ ...DEFAULT_PREFS, on: true, adhkar: { ...DEFAULT_PREFS.adhkar, morning: { on: true, time: "07:00" } } }, now);
  const sw = items.find((i) => i.id === "a:morning:2026-03-08")!; // the clocks go forward that night
  assert.equal(new Date(sw.at).getHours(), 7);
  const eve = items.find((i) => i.id === "a:evening:2026-03-08")!;
  assert.equal(new Date(eve.at).getHours(), 17);
  // A time that does not exist that night (02:30) still gives a real moment, not NaN.
  assert.ok(Number.isFinite(atTime(new Date("2026-03-08T12:00:00-04:00"), "02:30", "07:00")));
  const fall = build({ ...DEFAULT_PREFS, on: true }, new Date("2026-10-31T12:00:00-04:00")).find((i) => i.id === "a:morning:2026-11-01")!;
  assert.equal(new Date(fall.at).getHours(), 7);
  process.env.TZ = "Europe/London";
});

ok("verses: two a day, different, short, the same each time they are asked, and exactly as sourced", () => {
  const a = build(all, NOW), b = build(all, new Date("2026-10-02T14:30:00+01:00"));
  const va = a.filter((i) => i.id.startsWith("v:")), vb = b.filter((i) => i.id.startsWith("v:"));
  assert.ok(va.length >= 80);
  const byId = new Map(vb.map((i) => [i.id, i]));
  for (const i of va) {
    const j = byId.get(i.id);
    if (j) { assert.equal(j.body, i.body); assert.equal(j.title, i.title); assert.equal(j.url, i.url); }
  }
  for (const date of ["2026-10-03", "2026-10-04", "2026-12-25"]) {
    const [x, y] = versesFor(short, date)!;
    assert.notDeepEqual(x, y);
    assert.deepEqual(versesFor(short, date), [x, y]);
  }
  const day = va.filter((i) => i.id.endsWith("2026-10-03"));
  assert.equal(day.length, 2);
  for (const i of day) {
    const [, s, v] = /^(.+) (\d+:\d+)$/.exec(i.title) ? [0, ...i.title.split(" ").pop()!.split(":").map(Number)] : [0, 0, 0];
    const src = short.find(([ss, vv]) => ss === s && vv === v)!;
    assert.ok(src, `${i.title} is in the short list`);
    assert.equal(i.body, src[2]);
    assert.ok(i.body.length <= 140);
    assert.equal(i.url, readHref(s, v));
  }
  assert.equal(new Date(day[0].at).getHours(), 11);
  assert.equal(new Date(day[1].at).getHours(), 20);
  // Switched off, or no verse list yet: none.
  assert.equal(build({ ...all, ayat: { ...all.ayat, on: false } }, NOW).some((i) => i.id.startsWith("v:")), false);
  assert.equal(buildSchedule(all, { place, prayer, now: NOW, short: [] }).some((i) => i.id.startsWith("v:")), false);
});

ok("the service worker shows what is due: on time, early, late, twice, together, and nothing", () => {
  const t = 1_800_000_000_000;
  const mk = (id: string, at: number, extra: Partial<Item> = {}): Item => ({ id, at, title: id, body: "b", url: "/", ...extra });
  // on time
  let r = dueNow([mk("asr", t)], {}, t + 20_000);
  assert.deepEqual(r.show.map((i) => i.id), ["asr"]);
  assert.equal(r.mark, true);
  // a poke a little before the clock says (clock skew)
  assert.deepEqual(dueNow([mk("asr", t + 90_000)], {}, t).show.map((i) => i.id), ["asr"]);
  // well early: not yet, so only the plain notice
  assert.equal(dueNow([mk("asr", t + 10 * 60_000)], {}, t).show[0].id, "refresh");
  // late but within the window
  assert.deepEqual(dueNow([mk("asr", t - 10 * 60_000)], {}, t).show.map((i) => i.id), ["asr"]);
  // too late: skipped
  assert.equal(dueNow([mk("asr", t - 25 * 60_000)], {}, t).show[0].id, "refresh");
  // the same poke twice: the second replays the same notification (same id/tag) and does not mark again
  r = dueNow([mk("asr", t)], { asr: t + 5_000 }, t + 30_000);
  assert.deepEqual(r.show.map((i) => i.id), ["asr"]);
  assert.equal(r.mark, false);
  // shown long ago and no longer recent: the plain notice, not a repeat of the old one
  assert.equal(dueNow([mk("asr", t)], { asr: t }, t + 6 * 60_000).show[0].id, "refresh");
  // two reminders for one minute: both
  assert.deepEqual(dueNow([mk("b", t), mk("a", t - 60_000)], {}, t + 5_000).show.map((i) => i.id), ["a", "b"]);
  // one already shown, one new: only the new one
  assert.deepEqual(dueNow([mk("a", t - 60_000), mk("b", t)], { a: t - 30_000 }, t + 5_000).show.map((i) => i.id), ["b"]);
  // a one-off that expired is ignored
  assert.equal(dueNow([mk("welcome", t, { until: t + 1000 })], {}, t + 5_000).show[0].id, "refresh");
  // nothing scheduled: always something to show
  const none = dueNow([], {}, t).show;
  assert.equal(none.length, 1);
  assert.equal(none[0].url, "/settings#reminders-title");
  assert.deepEqual(dueNow(undefined as unknown as Item[], {}, t).show.map((i) => i.id), ["refresh"]);
  // old records are forgotten
  assert.deepEqual(prune({ old: t - 4 * 86400_000, fresh: t - 1000 }, t), { fresh: t - 1000 });
});

console.log(`${groups} groups passed${bad ? `, ${bad} FAILED` : ""}`);
process.exit(bad ? 1 : 0);
