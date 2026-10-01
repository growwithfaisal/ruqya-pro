"use client";
import { useMemo, useSyncExternalStore } from "react";
import { CalculationMethod, Coordinates, HighLatitudeRule, Madhab, PrayerTimes } from "adhan";

/**
 * Prayer times are worked out on the device from the sun's position (the adhan library, MIT). No request is made to any
 * server, so the times work offline. The place is the device's own position, rounded to about 1 km, kept in this browser only.
 */
const PLACE_KEY = "rp:v1:prayer:place";
const PREFS_KEY = "rp:v1:prayer:prefs";
const EVENTS = ["rp-prayer", "storage"] as const;

export interface Place { lat: number; lon: number; at: number }
export type MethodId = "auto" | "MuslimWorldLeague" | "NorthAmerica" | "Egyptian" | "Karachi" | "UmmAlQura" | "Dubai" | "Kuwait" | "Qatar" | "Singapore" | "Turkey" | "Tehran" | "MoonsightingCommittee";
export interface PrayerPrefs { method: MethodId; asr: "standard" | "hanafi" }

export const METHODS: { id: Exclude<MethodId, "auto">; label: string }[] = [
  { id: "MuslimWorldLeague", label: "Muslim World League" },
  { id: "NorthAmerica", label: "Islamic Society of North America" },
  { id: "Egyptian", label: "Egyptian General Authority of Survey" },
  { id: "Karachi", label: "University of Islamic Sciences, Karachi" },
  { id: "UmmAlQura", label: "Umm al-Qura University, Makkah" },
  { id: "Dubai", label: "Dubai" },
  { id: "Kuwait", label: "Kuwait" },
  { id: "Qatar", label: "Qatar" },
  { id: "Singapore", label: "Singapore" },
  { id: "Turkey", label: "Diyanet, Turkey" },
  { id: "Tehran", label: "Institute of Geophysics, Tehran" },
  { id: "MoonsightingCommittee", label: "Moonsighting Committee" },
];

const DEFAULTS: PrayerPrefs = { method: "auto", asr: "standard" };
const parse = <T,>(s: string, fallback: T): T => { try { return s ? (JSON.parse(s) as T) : fallback; } catch { return fallback; } };
const read = (k: string) => { try { return localStorage.getItem(k) ?? ""; } catch { return ""; } };

/** The method most used where the device's clock says it is. Only a starting point; Settings can change it. */
export function suggestedMethod(): Exclude<MethodId, "auto"> {
  let tz = "";
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch {}
  if (/^(America|US|Canada)\//.test(tz)) return "NorthAmerica";
  if (/^Asia\/(Karachi|Dhaka|Kolkata|Calcutta|Colombo|Kabul)$/.test(tz)) return "Karachi";
  if (/^Asia\/(Riyadh|Aden)$/.test(tz)) return "UmmAlQura";
  if (/^Asia\/(Dubai|Muscat)$/.test(tz)) return "Dubai";
  if (tz === "Asia/Kuwait") return "Kuwait";
  if (/^Asia\/(Qatar|Bahrain)$/.test(tz)) return "Qatar";
  if (/^(Asia\/(Singapore|Kuala_Lumpur|Jakarta|Brunei)|Asia\/Pontianak)$/.test(tz)) return "Singapore";
  if (/^(Europe\/Istanbul|Asia\/Istanbul)$/.test(tz)) return "Turkey";
  if (tz === "Asia/Tehran") return "Tehran";
  if (tz === "Africa/Cairo") return "Egyptian";
  return "MuslimWorldLeague";
}

function subscribe(cb: () => void) {
  EVENTS.forEach((e) => window.addEventListener(e, cb));
  return () => EVENTS.forEach((e) => window.removeEventListener(e, cb));
}
const snapshot = () => read(PLACE_KEY) + "\u0001" + read(PREFS_KEY);

export function usePrayerState(): { place: Place | null; prefs: PrayerPrefs; ready: boolean } {
  const snap = useSyncExternalStore(subscribe, snapshot, () => "\u0001\u0002");
  return useMemo(() => {
    const [p, f] = snap.split("\u0001");
    const place = parse<Place | null>(p, null);
    const ok = place && Number.isFinite(place.lat) && Number.isFinite(place.lon) ? place : null;
    return { place: ok, prefs: { ...DEFAULTS, ...parse<Partial<PrayerPrefs>>(f, {}) }, ready: snap !== "\u0001\u0002" };
  }, [snap]);
}

export function setPrayerPrefs(patch: Partial<PrayerPrefs>) {
  const next = { ...DEFAULTS, ...parse<Partial<PrayerPrefs>>(read(PREFS_KEY), {}), ...patch };
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)); } catch {}
  window.dispatchEvent(new Event("rp-prayer"));
}
export function forgetPlace() {
  try { localStorage.removeItem(PLACE_KEY); } catch {}
  window.dispatchEvent(new Event("rp-prayer"));
}

export type LocateError = "denied" | "unavailable" | "timeout";
/** Asks the device where it is (the browser shows its own permission prompt) and keeps the answer, rounded, on this device. */
export function locate(): Promise<Place> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject("unavailable" satisfies LocateError);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const place: Place = { lat: Math.round(pos.coords.latitude * 100) / 100, lon: Math.round(pos.coords.longitude * 100) / 100, at: Date.now() };
        try { localStorage.setItem(PLACE_KEY, JSON.stringify(place)); } catch {}
        window.dispatchEvent(new Event("rp-prayer"));
        resolve(place);
      },
      (err) => reject((err.code === 1 ? "denied" : err.code === 3 ? "timeout" : "unavailable") satisfies LocateError),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 30 * 60 * 1000 },
    );
  });
}

/** If the reader already allowed location, quietly keep the saved place current when they have moved or it is a day old. */
export async function refreshPlaceQuietly(current: Place) {
  try {
    if (Date.now() - current.at < 6 * 3600 * 1000) return;
    const perm = await navigator.permissions?.query({ name: "geolocation" });
    if (perm?.state === "granted") await locate();
  } catch {}
}

export type PrayerName = "Fajr" | "Sunrise" | "Dhuhr" | "Asr" | "Maghrib" | "Isha";
export interface Moment { name: PrayerName; at: Date }
export interface Now { current: Moment; next: Moment; progress: number }

function day(place: Place, prefs: PrayerPrefs, date: Date): Moment[] {
  const coords = new Coordinates(place.lat, place.lon);
  const id = prefs.method === "auto" ? suggestedMethod() : prefs.method;
  const params = CalculationMethod[id]();
  params.madhab = prefs.asr === "hanafi" ? Madhab.Hanafi : Madhab.Shafi;
  params.highLatitudeRule = HighLatitudeRule.recommended(coords);
  const t = new PrayerTimes(coords, date, params);
  return [
    { name: "Fajr", at: t.fajr }, { name: "Sunrise", at: t.sunrise }, { name: "Dhuhr", at: t.dhuhr },
    { name: "Asr", at: t.asr }, { name: "Maghrib", at: t.maghrib }, { name: "Isha", at: t.isha },
  ];
}

/** Where the day stands: the last time that has passed, the next one to come, and how far through the gap we are. */
export function prayerNow(place: Place, prefs: PrayerPrefs, now = new Date()): Now | null {
  try {
    const d = (n: number) => { const x = new Date(now); x.setDate(x.getDate() + n); return x; };
    const all = [...day(place, prefs, d(-1)), ...day(place, prefs, now), ...day(place, prefs, d(1))].filter((m) => !Number.isNaN(m.at.getTime()));
    const i = all.findIndex((m) => m.at.getTime() > now.getTime());
    if (i < 1) return null;
    const current = all[i - 1], next = all[i];
    const span = next.at.getTime() - current.at.getTime();
    return { current, next, progress: span > 0 ? Math.min(1, Math.max(0, (now.getTime() - current.at.getTime()) / span)) : 0 };
  } catch {
    return null;
  }
}

export const clock = (d: Date) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

export function until(to: Date, now = new Date()): string {
  const mins = Math.max(0, Math.ceil((to.getTime() - now.getTime()) / 60000));
  if (mins < 1) return "less than a minute";
  const h = Math.floor(mins / 60), m = mins % 60;
  return h ? `${h} h${m ? ` ${m} min` : ""}` : `${m} min`;
}
