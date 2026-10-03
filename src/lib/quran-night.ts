import { prayerNow, type Place, type PrayerPrefs } from "./prayer";

/** Surah Al-Waqi'ah. Its reminder on Home is for the night, so its progress is kept per night, not per calendar day. */
export const WAQIAH = 56;

/** A night's reading: the date of the evening it began, and the verses read in it ("56:1"). The same shape as "seen today". */
export interface NightSeen { date: string; keys: string[] }

const localDate = (d: Date) => d.toLocaleDateString("en-CA");

/**
 * The night `now` falls in, named by the date of the evening it began (YYYY-MM-DD), or null outside the night.
 * The night runs from Maghrib to Fajr: by the real prayer times when a place is saved, else from 18:30 to 05:00.
 * So a verse read at 00:30 belongs to the evening before, and the reminder neither resets at midnight nor carries a
 * reading done after midnight into the next evening.
 */
export function nightOf(now: Date, place: Place | null, prefs: PrayerPrefs): string | null {
  const pn = place ? prayerNow(place, prefs, now) : null;
  const h = now.getHours() + now.getMinutes() / 60;
  const inNight = pn ? pn.current.name === "Maghrib" || pn.current.name === "Isha" : h >= 18.5 || h < 5;
  if (!inNight) return null;
  // Evening hours name tonight; the hours after midnight belong to the evening before. Noon keeps the date clear of DST shifts.
  return h >= 12 ? localDate(now) : localDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12));
}

/** The night record after reading `key` in `night`: a new night starts empty. Returns null when nothing changes. */
export function addToNight(prev: NightSeen | null, night: string, key: string): NightSeen | null {
  const rec = prev && prev.date === night ? prev : { date: night, keys: [] };
  return rec.keys.includes(key) ? (rec === prev ? null : rec) : { date: night, keys: [...rec.keys, key] };
}

/** How many verses of a surah were read in the given night. */
export const nightCount = (rec: NightSeen | null, night: string | null, surah: number) =>
  rec && night && rec.date === night ? rec.keys.filter((k) => k.startsWith(`${surah}:`)).length : 0;
