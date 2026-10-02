import { prayerDay, type Place, type PrayerPrefs } from "./prayer";
import { chapter, readHref, seeded } from "./quran";

/**
 * Works out what a phone should be reminded of, and when, for the next 45 days. Pure: no storage, no network, no clock but `now`.
 * The result lives on the phone; the server is only ever told the minutes (see reminders.ts and reminders-worker/).
 */
export type PrayerKey = "fajr" | "dhuhr" | "asr" | "maghrib" | "isha";
export type AdhkarKey = "morning" | "evening" | "bedtime";
export type Lead = 0 | 5 | 10 | 15 | 30;

export interface ReminderPrefs {
  on: boolean;
  prayers: Record<PrayerKey, boolean>;
  lead: Lead;
  adhkar: Record<AdhkarKey, { on: boolean; time: string }>;
  friday: { on: boolean; time: string };
  ayat: { on: boolean; times: [string, string] };
}

export const DEFAULT_PREFS: ReminderPrefs = {
  on: false,
  prayers: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true },
  lead: 0,
  adhkar: { morning: { on: true, time: "07:00" }, evening: { on: true, time: "17:00" }, bedtime: { on: true, time: "22:00" } },
  friday: { on: true, time: "09:00" },
  ayat: { on: false, times: ["11:00", "20:00"] },
};

/** One reminder, as kept on the phone. `at` is epoch milliseconds. `until` lets a one-off (a test) expire. */
export interface Item { id: string; at: number; title: string; body: string; url: string; until?: number }
export type ShortVerse = [surah: number, verse: number, translation: string];

export const HORIZON_DAYS = 45;
/** The server keeps at most 600 times for a phone. */
const MAX_ITEMS = 590;

export const PRAYER_LABEL: Record<PrayerKey, string> = { fajr: "Fajr", dhuhr: "Dhuhr", asr: "Asr", maghrib: "Maghrib", isha: "Isha" };
export const ADHKAR_LABEL: Record<AdhkarKey, string> = { morning: "Morning adhkar", evening: "Evening adhkar", bedtime: "Bedtime routine" };
const BY_NAME: Record<string, PrayerKey> = { Fajr: "fajr", Dhuhr: "dhuhr", Asr: "asr", Maghrib: "maghrib", Isha: "isha" };

const localDate = (d: Date) => d.toLocaleDateString("en-CA");

/** A clock time such as "07:30" on the calendar day of `day`, in the device's own time zone (so daylight saving is right). */
export function atTime(day: Date, hhmm: string, fallback: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm) ?? /^(\d{1,2}):(\d{2})$/.exec(fallback)!;
  const d = new Date(day);
  d.setHours(Math.min(23, Number(m[1])), Math.min(59, Number(m[2])), 0, 0);
  return d.getTime();
}

/** Two different verses for a date, the same every time this is asked, so a re-sync never changes one already announced. */
export function versesFor(short: ShortVerse[], date: string): [ShortVerse, ShortVerse] | null {
  if (short.length < 2) return null;
  const a = Math.floor(seeded(`${date}#reminder-0`) * short.length);
  let b = Math.floor(seeded(`${date}#reminder-1`) * short.length);
  if (b === a) b = (b + 1) % short.length;
  return [short[a], short[b]];
}

export interface Context { place: Place | null; prayer: PrayerPrefs; now: Date; short: ShortVerse[] }

export function buildSchedule(prefs: ReminderPrefs, ctx: Context): Item[] {
  const { now } = ctx;
  const items: Item[] = [];
  const kahf = chapter(18);

  for (let n = 0; n < HORIZON_DAYS; n++) {
    const day = new Date(now);
    day.setDate(day.getDate() + n);
    const date = localDate(day);

    if (ctx.place && (Object.values(prefs.prayers).some(Boolean))) {
      for (const m of prayerDay(ctx.place, ctx.prayer, day)) {
        const key = BY_NAME[m.name];
        if (!key || !prefs.prayers[key] || Number.isNaN(m.at.getTime())) continue;
        items.push({
          id: `p:${key}:${date}`,
          at: m.at.getTime() - prefs.lead * 60_000,
          title: m.name,
          body: prefs.lead ? `${m.name} is in ${prefs.lead} minutes.` : `It is time for ${m.name}.`,
          url: "/",
        });
      }
    }

    for (const set of ["morning", "evening", "bedtime"] as const) {
      const a = prefs.adhkar[set];
      if (!a.on) continue;
      items.push({
        id: `a:${set}:${date}`,
        at: atTime(day, a.time, DEFAULT_PREFS.adhkar[set].time),
        title: ADHKAR_LABEL[set],
        body: "A few minutes of remembrance.",
        url: `/recitations?set=${set}`,
      });
    }

    if (prefs.friday.on && day.getDay() === 5) {
      items.push({
        id: `f:${date}`,
        at: atTime(day, prefs.friday.time, DEFAULT_PREFS.friday.time),
        title: "Friday recitation",
        body: `Surah ${kahf.name}, ${kahf.verses} verses.`,
        url: readHref(18),
      });
    }

    if (prefs.ayat.on) {
      const pair = versesFor(ctx.short, date);
      if (pair) {
        pair.forEach(([s, v, en], slot) => {
          items.push({
            id: `v:${slot}:${date}`,
            at: atTime(day, prefs.ayat.times[slot], DEFAULT_PREFS.ayat.times[slot]),
            title: `${chapter(s).name} ${s}:${v}`,
            body: en,
            url: readHref(s, v),
          });
        });
      }
    }
  }

  const t = now.getTime();
  return items.filter((i) => i.at > t).sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1)).slice(0, MAX_ITEMS);
}

/** The only thing the server is told: the minutes (epoch seconds), unique and ascending. */
export function serverTimes(items: Item[]): number[] {
  return [...new Set(items.map((i) => Math.floor(i.at / 60_000) * 60))].sort((a, b) => a - b);
}
