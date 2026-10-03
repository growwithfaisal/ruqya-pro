/**
 * Merging a reader's progress between devices. Pure: it reads and writes through a Storage-like object, so the same code runs
 * in the browser and in tests (scripts/check-account-merge.mts).
 *
 * Lists (days read, bookmarks, routine ticks) merge three ways against `base`, the copy both sides agreed on at the last sync:
 * something added on either device is kept, and something removed on either device stays removed. Without that, a bookmark
 * deleted on the phone would come back from the laptop at the next sync.
 */
export interface Store {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
  key(i: number): string | null;
  readonly length: number;
}

export interface Seen { date: string; keys: string[] }
export interface Last { surah: number; verse: number; at: number }
export interface Snapshot {
  v: 1;
  days: string[];
  marks: string[];
  seen: Seen | null;
  /** Al-Waqi'ah read tonight (Maghrib to Fajr), named by the evening's date. Optional: older copies do not have it. */
  night?: Seen | null;
  last: Last | null;
  /** Routine day (YYYY-MM-DD) -> "set:entry" ticks, recent days only. */
  done: Record<string, string[]>;
  /** Reading settings as stored (raw strings). Adopted by a device only when it first joins the account. */
  settings?: Record<string, string>;
}

export const KEYS = {
  days: "rp:v1:quran:days",
  marks: "rp:v1:quran:marks",
  seen: "rp:v1:quran:seen",
  night: "rp:v1:quran:night",
  last: "rp:v1:quran:last",
  donePrefix: "rp:v2:done:",
} as const;
/** Settings that follow a reader to a new device. Not the saved location, reminders or offline downloads. */
export const SETTING_KEYS = ["rp:v1:quran:prefs", "rp:arabic", "rp:translit", "rp:v1:prayer:prefs", "rp:v1:night"] as const;
export const DONE_KEEP_DAYS = 14;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const num = (v: unknown) => typeof v === "number" && Number.isFinite(v);

function json(store: Store, k: string): unknown {
  try { const s = store.getItem(k); return s ? JSON.parse(s) : null; } catch { return null; }
}

/** Routine days older than this (YYYY-MM-DD) are not kept or synced. */
export function cutoffFor(today: string, keepDays = DONE_KEEP_DAYS): string {
  const [y, m, d] = today.split("-").map(Number);
  const t = new Date(y, m - 1, d, 12);
  t.setDate(t.getDate() - keepDays);
  return t.toLocaleDateString("en-CA");
}

export function readSettings(store: Store): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of SETTING_KEYS) { const v = store.getItem(k); if (v !== null) out[k] = v; }
  return out;
}

export function readLocal(store: Store, cutoff: string): Snapshot {
  const seen = json(store, KEYS.seen) as Partial<Seen> | null;
  const night = json(store, KEYS.night) as Partial<Seen> | null;
  const last = json(store, KEYS.last) as Partial<Last> | null;
  const done: Record<string, string[]> = {};
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i);
    if (!k || !k.startsWith(KEYS.donePrefix)) continue;
    const date = k.slice(KEYS.donePrefix.length);
    if (!DATE.test(date) || date < cutoff) continue;
    let list: string[] = [];
    try { list = strs(JSON.parse(store.getItem(k) ?? "[]")); } catch {}
    if (list.length) done[date] = list;
  }
  return {
    v: 1,
    days: strs(json(store, KEYS.days)).filter((d) => DATE.test(d)),
    marks: strs(json(store, KEYS.marks)),
    seen: seen && typeof seen.date === "string" ? { date: seen.date, keys: strs(seen.keys) } : null,
    night: night && typeof night.date === "string" ? { date: night.date, keys: strs(night.keys) } : null,
    last: last && num(last.surah) && num(last.verse) && num(last.at) ? { surah: last.surah!, verse: last.verse!, at: last.at! } : null,
    done,
  };
}

/** Tolerant reading of what came from the server. */
export function parseSnapshot(text: string | null | undefined): Snapshot | null {
  if (!text) return null;
  try {
    const o = JSON.parse(text) as Partial<Snapshot>;
    if (!o || typeof o !== "object") return null;
    const done: Record<string, string[]> = {};
    for (const [d, list] of Object.entries(o.done ?? {})) if (DATE.test(d) && strs(list).length) done[d] = strs(list);
    const settings: Record<string, string> = {};
    for (const k of SETTING_KEYS) { const v = (o.settings as Record<string, unknown> | undefined)?.[k]; if (typeof v === "string") settings[k] = v; }
    return {
      v: 1,
      days: strs(o.days).filter((d) => DATE.test(d)),
      marks: strs(o.marks),
      seen: o.seen && typeof o.seen.date === "string" ? { date: o.seen.date, keys: strs(o.seen.keys) } : null,
      night: o.night && typeof o.night.date === "string" ? { date: o.night.date, keys: strs(o.night.keys) } : null,
      last: o.last && num(o.last.surah) && num(o.last.verse) && num(o.last.at) ? { surah: o.last.surah, verse: o.last.verse, at: o.last.at } : null,
      done,
      ...(Object.keys(settings).length ? { settings } : {}),
    };
  } catch { return null; }
}

/* ---------------- merging ---------------- */

/** Three-way merge of two lists against the copy both agreed on. Order: this device's first, then what only the other had. */
export function mergeSet(L: string[], R: string[], B: string[] | null): string[] {
  const l = new Set(L), r = new Set(R), b = new Set(B ?? []);
  const out: string[] = [];
  const seen = new Set<string>();
  const take = (x: string) => { if (!seen.has(x)) { seen.add(x); out.push(x); } };
  for (const x of L) if (r.has(x) || !b.has(x)) take(x); // kept if the other still has it, or this device added it
  for (const x of R) if (l.has(x) || !b.has(x)) take(x); // kept if this device still has it, or the other added it
  return out;
}

function mergeSeen(L: Seen | null, R: Seen | null): Seen | null {
  if (!L || !R) return L ?? R;
  if (L.date !== R.date) return L.date > R.date ? L : R; // "seen today" (or tonight) belongs to its day: the newer one wins
  return { date: L.date, keys: mergeSet(L.keys, R.keys, null) };
}

export function merge(local: Snapshot, remote: Snapshot | null, base: Snapshot | null, cutoff: string): Snapshot {
  const R: Snapshot = remote ?? { v: 1, days: [], marks: [], seen: null, last: null, done: {} };
  const dates = new Set([...Object.keys(local.done), ...Object.keys(R.done)]);
  const done: Record<string, string[]> = {};
  for (const d of [...dates].sort()) {
    if (d < cutoff) continue;
    const m = mergeSet(local.done[d] ?? [], R.done[d] ?? [], base ? base.done[d] ?? [] : null);
    if (m.length) done[d] = m;
  }
  return {
    v: 1,
    days: mergeSet(local.days, R.days, base?.days ?? null).sort(),
    marks: mergeSet(local.marks, R.marks, base?.marks ?? null),
    seen: mergeSeen(local.seen, R.seen),
    night: mergeSeen(local.night ?? null, R.night ?? null),
    last: !local.last || !R.last ? local.last ?? R.last : R.last.at > local.last.at ? R.last : local.last,
    done,
  };
}

/** A stable string for "is this the same progress?", ignoring order and settings. */
export function canonical(s: Snapshot): string {
  const sorted = (a: string[]) => [...a].sort();
  return JSON.stringify({
    days: sorted(s.days),
    marks: sorted(s.marks),
    seen: s.seen ? { date: s.seen.date, keys: sorted(s.seen.keys) } : null,
    night: s.night ? { date: s.night.date, keys: sorted(s.night.keys) } : null,
    last: s.last,
    done: Object.fromEntries(Object.keys(s.done).sort().filter((d) => s.done[d].length).map((d) => [d, sorted(s.done[d])])),
  });
}

/** Writes merged progress into the device's storage. Returns true if anything changed. */
export function writeLocal(store: Store, merged: Snapshot, before: Snapshot): boolean {
  let changed = false;
  const put = (k: string, v: unknown) => { store.setItem(k, JSON.stringify(v)); changed = true; };
  const sorted = (a: string[]) => JSON.stringify([...a].sort());
  if (sorted(merged.days) !== sorted(before.days)) put(KEYS.days, merged.days);
  if (sorted(merged.marks) !== sorted(before.marks)) put(KEYS.marks, merged.marks);
  if (JSON.stringify(merged.seen) !== JSON.stringify(before.seen) && merged.seen) put(KEYS.seen, merged.seen);
  if (JSON.stringify(merged.night ?? null) !== JSON.stringify(before.night ?? null) && merged.night) put(KEYS.night, merged.night);
  if (JSON.stringify(merged.last) !== JSON.stringify(before.last) && merged.last) put(KEYS.last, merged.last);
  for (const d of new Set([...Object.keys(merged.done), ...Object.keys(before.done)])) {
    const now = merged.done[d] ?? [];
    if (sorted(now) !== sorted(before.done[d] ?? [])) put(KEYS.donePrefix + d, now);
  }
  return changed;
}

/** Applies another device's reading settings (only done once, when a device first joins the account). */
export function adoptSettings(store: Store, settings: Record<string, string> | undefined): boolean {
  let changed = false;
  for (const k of SETTING_KEYS) {
    const v = settings?.[k];
    if (typeof v === "string" && store.getItem(k) !== v) { store.setItem(k, v); changed = true; }
  }
  return changed;
}

/* ---------------- one round of syncing ---------------- */

export interface Round {
  /** What both sides now agree on (kept as `base` for the next round). */
  merged: Snapshot;
  /** True when this device's storage changed, so the app should refresh what it shows. */
  changedLocal: boolean;
  /** The text to send to the server, or null when the server already has exactly this. */
  upload: string | null;
}

/**
 * Pull-merge-push, minus the network: takes the server's copy (text, or null if it has none), merges it into this device's
 * storage, and says what (if anything) to send back. `join` is true the first time this device signs in to the account, when
 * the reading settings are adopted from the account instead of sent to it.
 */
export function reconcile(store: Store, remoteText: string | null, base: Snapshot | null, opts: { cutoff: string; join: boolean }): Round {
  const local = readLocal(store, opts.cutoff);
  const remote = parseSnapshot(remoteText);
  const merged = merge(local, remote, base, opts.cutoff);
  let changedLocal = writeLocal(store, merged, local);
  if (opts.join && remote?.settings && adoptSettings(store, remote.settings)) changedLocal = true;
  const settings = remote?.settings ?? readSettings(store);
  const out: Snapshot = { ...merged, ...(Object.keys(settings).length ? { settings } : {}) };
  const same = !!remote && canonical(merged) === canonical(remote) && (!!remote.settings || !out.settings);
  return { merged: out, changedLocal, upload: same ? null : JSON.stringify(out) };
}
