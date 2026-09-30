"use client";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { QURAN_CACHE, chapters } from "./quran";

/**
 * Everything a reader does stays in this browser. Keys are versioned so a future format can migrate them.
 * Nothing here is ever sent anywhere.
 */
const P = "rp:v1:quran:";
const KEYS = ["last", "days", "seen", "marks", "offline", "prefs"] as const;
const EVENTS = ["rp-quran", "rp-progress", "storage"] as const; // rp-progress is nudged at midnight by SkyClock

export const VERSES_PER_DAY = 10;
export const MONTH_GOAL = 30;

export interface LastRead { surah: number; verse: number; at: number }
export interface Seen { date: string; keys: string[] }
export interface Prefs { translit: boolean; translation: boolean }
export interface QuranState {
  last: LastRead | null;
  days: string[];
  seen: Seen;
  marks: string[];
  offline: number[];
  prefs: Prefs;
  today: string;
}

/** Local calendar date, YYYY-MM-DD, in the device's own time zone. */
export const localDate = (d = new Date()) => d.toLocaleDateString("en-CA");
const at = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12); // noon: immune to DST shifts
};
export const addDays = (iso: string, n: number) => {
  const d = at(iso);
  d.setDate(d.getDate() + n);
  return localDate(d);
};

const DEFAULT_PREFS: Prefs = { translit: true, translation: true };

function read(k: (typeof KEYS)[number]): string {
  try { return localStorage.getItem(P + k) ?? ""; } catch { return ""; }
}
function write(k: (typeof KEYS)[number], v: unknown) {
  try { localStorage.setItem(P + k, JSON.stringify(v)); } catch {}
  window.dispatchEvent(new Event("rp-quran"));
}
const parse = <T,>(s: string, fallback: T): T => {
  try { return s ? (JSON.parse(s) as T) : fallback; } catch { return fallback; }
};

const snapshot = () => KEYS.map(read).join("\u0001") + "\u0001" + localDate();
function subscribe(cb: () => void) {
  EVENTS.forEach((e) => window.addEventListener(e, cb));
  return () => EVENTS.forEach((e) => window.removeEventListener(e, cb));
}

export function useQuran(): QuranState {
  const snap = useSyncExternalStore(subscribe, snapshot, () => "");
  return useMemo(() => {
    const parts = snap.split("\u0001");
    const today = parts[6] || localDate();
    const seen = parse<Seen>(parts[2], { date: today, keys: [] });
    return {
      last: parse<LastRead | null>(parts[0], null),
      days: parse<string[]>(parts[1], []),
      seen: seen.date === today ? seen : { date: today, keys: [] },
      marks: parse<string[]>(parts[3], []),
      offline: parse<number[]>(parts[4], []),
      prefs: { ...DEFAULT_PREFS, ...parse<Partial<Prefs>>(parts[5], {}) },
      today,
    };
  }, [snap]);
}

/* ---------- derived numbers ---------- */

export function currentStreak(days: string[], today: string) {
  const set = new Set(days);
  // If today isn't read yet, the streak is still alive through yesterday.
  let cursor = set.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (set.has(cursor)) { n++; cursor = addDays(cursor, -1); }
  return n;
}
export function bestStreak(days: string[]) {
  const sorted = [...new Set(days)].sort();
  let best = 0, run = 0, prev = "";
  for (const d of sorted) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}
export const daysInMonth = (days: string[], ym: string) => new Set(days.filter((d) => d.startsWith(ym))).size;
/** Monday first, matching the reference design. */
export function weekOf(today: string) {
  const dow = (at(today).getDay() + 6) % 7; // Mon = 0
  const monday = addDays(today, -dow);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/* ---------- writes ---------- */

const state = () => ({
  days: parse<string[]>(read("days"), []),
  seen: parse<Seen>(read("seen"), { date: "", keys: [] }),
  marks: parse<string[]>(read("marks"), []),
  offline: parse<number[]>(read("offline"), []),
  prefs: { ...DEFAULT_PREFS, ...parse<Partial<Prefs>>(read("prefs"), {}) },
});

export function setLast(surah: number, verse: number) {
  write("last", { surah, verse, at: Date.now() } satisfies LastRead);
}

/** Returns true when this verse is what tipped today over the goal. */
export function markSeen(surah: number, verse: number): boolean {
  const today = localDate();
  const s = state();
  const seen = s.seen.date === today ? s.seen : { date: today, keys: [] as string[] };
  const key = `${surah}:${verse}`;
  if (seen.keys.includes(key)) return false;
  seen.keys.push(key);
  write("seen", seen);
  if (seen.keys.length >= VERSES_PER_DAY && !s.days.includes(today)) {
    write("days", [...s.days, today].sort());
    try { navigator.vibrate?.(14); } catch {}
    return true;
  }
  return false;
}

export function toggleMark(surah: number, verse: number) {
  const key = `${surah}:${verse}`;
  const marks = state().marks;
  write("marks", marks.includes(key) ? marks.filter((k) => k !== key) : [...marks, key]);
}

export function setPrefs(p: Partial<Prefs>) {
  write("prefs", { ...state().prefs, ...p });
}

/* ---------- offline saving (Cache Storage, shared with the service worker) ---------- */

export function useOffline() {
  const { offline } = useQuran();
  const save = useCallback(async (ids: number[], urlOf: (n: number) => string) => {
    if (!("caches" in window)) return false;
    try {
      const cache = await caches.open(QURAN_CACHE);
      await Promise.all(ids.map((n) => cache.add(urlOf(n))));
      write("offline", [...new Set([...state().offline, ...ids])].sort((a, b) => a - b));
      try { await navigator.storage?.persist?.(); } catch {}
      return true;
    } catch { return false; }
  }, []);
  const remove = useCallback(async (id: number, urlOf: (n: number) => string) => {
    try { const cache = await caches.open(QURAN_CACHE); await cache.delete(urlOf(id)); } catch {}
    write("offline", state().offline.filter((n) => n !== id));
  }, []);
  return { offline: new Set(offline), save, remove, total: chapters.length };
}
