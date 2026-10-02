"use client";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { readInputs } from "./prayer";
import { DEFAULT_PREFS, buildSchedule, serverTimes, type Item, type ReminderPrefs, type ShortVerse } from "./reminder-schedule";

/**
 * Reminders, opt-in. The phone builds its own schedule (reminder-schedule.ts), keeps it here in IndexedDB, and tells the
 * reminder server only a push address and the minutes at which to poke it. At each minute the server sends an EMPTY push;
 * the service worker (public/sw.js, public/reminders-sw.js) reads this schedule and shows what is due.
 * Nothing about prayers, adhkar or verses ever leaves the phone.
 */
const SERVER = (process.env.NEXT_PUBLIC_REMINDERS_URL || "").replace(/\/+$/, "");
const PUSH_KEY = process.env.NEXT_PUBLIC_PUSH_KEY || "";
/** Without a server address and a key the feature stays out of sight. */
export const REMINDERS_CONFIGURED = !!SERVER && !!PUSH_KEY;

const PREFS_KEY = "rp:v1:reminders"; // choices (not in the progress backup: a subscription belongs to one phone)
const META_KEY = "rp:v1:reminders:sync"; // the server's secret for this phone, when it last synced, how far ahead it reaches
const EVENT = "rp-reminders";
const RESYNC_AFTER = 12 * 3600_000;
const RESYNC_BELOW = 14 * 86_400_000;

export interface Meta { token?: string; at?: number; until?: number; err?: string }
export type Support = "checking" | "unavailable" | "install" | "unsupported" | "denied" | "ready";

/* ---------- Stored choices ---------- */

const read = (k: string) => { try { return localStorage.getItem(k) ?? ""; } catch { return ""; } };
const parse = <T,>(s: string, fallback: T): T => { try { return s ? (JSON.parse(s) as T) : fallback; } catch { return fallback; } };

function merge(saved: Partial<ReminderPrefs>): ReminderPrefs {
  const d = DEFAULT_PREFS;
  const times = (v: unknown, fallback: [string, string]): [string, string] => (Array.isArray(v) && v.length === 2 && v.every((x) => typeof x === "string") ? [v[0], v[1]] : fallback);
  return {
    on: saved.on === true,
    prayers: { ...d.prayers, ...saved.prayers },
    lead: ([0, 5, 10, 15, 30] as const).includes(saved.lead as 0) ? (saved.lead as ReminderPrefs["lead"]) : 0,
    adhkar: {
      morning: { ...d.adhkar.morning, ...saved.adhkar?.morning },
      evening: { ...d.adhkar.evening, ...saved.adhkar?.evening },
      bedtime: { ...d.adhkar.bedtime, ...saved.adhkar?.bedtime },
    },
    friday: { ...d.friday, ...saved.friday },
    ayat: { on: saved.ayat?.on === true, times: times(saved.ayat?.times, d.ayat.times) },
  };
}
export const readPrefs = (): ReminderPrefs => merge(parse<Partial<ReminderPrefs>>(read(PREFS_KEY), {}));
const readMeta = (): Meta => parse<Meta>(read(META_KEY), {});

function writePrefs(next: ReminderPrefs) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)); } catch {}
  window.dispatchEvent(new Event(EVENT));
}
function writeMeta(patch: Meta | null) {
  try {
    if (patch === null) localStorage.removeItem(META_KEY);
    else localStorage.setItem(META_KEY, JSON.stringify({ ...readMeta(), ...patch }));
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

/** The reader changed a choice. Saved at once; if reminders are on, the server hears about it a moment later. */
export function savePrefs(next: ReminderPrefs) {
  writePrefs(next);
  if (next.on) queueSync();
}

/* ---------- This phone's schedule (IndexedDB, also read by the service worker) ---------- */

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open("rp-reminders", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("kv");
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
}
async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const q = db.transaction("kv").objectStore("kv").get(key);
    q.onsuccess = () => resolve(q.result as T | undefined);
    q.onerror = () => reject(q.error);
  });
}
async function idbSet(key: string, value: unknown) {
  const db = await idb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("kv", "readwrite");
    tx.objectStore("kv").put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function idbClear() {
  const db = await idb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("kv", "readwrite");
    tx.objectStore("kv").clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/* ---------- Support and permission ---------- */

export function detect(): Support {
  if (!REMINDERS_CONFIGURED) return "unavailable";
  const nav = navigator as Navigator & { standalone?: boolean };
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const installed = nav.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
  if (ios && !installed) return "install"; // on iPhone, push exists only for an app added to the Home Screen
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  return "ready";
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  // The worker is only registered in the built app, so on a dev server this would wait forever.
  return Promise.race([navigator.serviceWorker.ready, new Promise<null>((r) => setTimeout(() => r(null), 6000))]);
}

function keyBytes(b64url: string): Uint8Array<ArrayBuffer> {
  const p = b64url.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (b64url.length % 4)) % 4);
  return Uint8Array.from(atob(p), (c) => c.charCodeAt(0));
}
const subscribeNow = (reg: ServiceWorkerRegistration) => reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(PUSH_KEY) });

/* ---------- Talking to the server ---------- */

async function api(path: string, body: unknown): Promise<{ status: number; body: Record<string, any> | null }> {
  const res = await fetch(SERVER + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json().catch(() => null) };
}

let shortCache: ShortVerse[] | null = null;
async function loadShort(): Promise<ShortVerse[]> {
  if (shortCache) return shortCache;
  const res = await fetch("/quran-data/v6/short.json");
  if (!res.ok) throw new Error("short verses unavailable");
  return (shortCache = (await res.json()) as ShortVerse[]);
}

export type SyncResult = "ok" | "network" | "full" | "rejected" | "busy" | "no-subscription" | "unsupported";

let running: Promise<SyncResult> | null = null;
/** Builds the schedule, keeps it on the phone, and tells the server the minutes. */
export function syncNow(extra: Item[] = []): Promise<SyncResult> {
  return (running ??= run(extra).finally(() => { running = null; }));
}

async function run(extra: Item[]): Promise<SyncResult> {
  const reg = await registration();
  if (!reg) return "unsupported";
  let sub = await reg.pushManager.getSubscription();
  if (!sub) return "no-subscription";

  const prefs = readPrefs();
  const { place, prefs: prayer } = readInputs();
  let short: ShortVerse[] = [];
  if (prefs.ayat.on) {
    try { short = await loadShort(); } catch { writeMeta({ err: "network" }); return "network"; }
  }
  const items = buildSchedule(prefs, { place, prayer, now: new Date(), short });
  // Written first: the server's very first poke (its check that this address is real) can arrive before the reply does.
  await idbSet("schedule", [...extra, ...items]);

  try {
    let meta = readMeta();
    let r = await api("/v1/sync", { endpoint: sub.endpoint, times: serverTimes(items), token: meta.token });
    if (r.status === 401) {
      // The server holds this address under a secret this phone no longer has (site data was cleared). Start over with a new address.
      await sub.unsubscribe();
      sub = await subscribeNow(reg);
      meta = {};
      r = await api("/v1/sync", { endpoint: sub.endpoint, times: serverTimes(items) });
    }
    if (r.status === 200) {
      const token = (r.body?.token as string | undefined) ?? meta.token;
      writeMeta({ token, at: Date.now(), until: typeof r.body?.until === "number" ? r.body.until * 1000 : undefined, err: undefined });
      if (extra.length && !r.body?.token) await idbSet("schedule", items); // no new sign-up, so no first poke: drop the one-off notice
      return "ok";
    }
    const code: SyncResult = r.status === 429 ? "busy" : r.status === 503 ? "full" : r.body?.error === "rejected" ? "rejected" : "network";
    if (code !== "busy") writeMeta({ err: code });
    return code;
  } catch {
    writeMeta({ err: "network" });
    return "network";
  }
}

let timer: ReturnType<typeof setTimeout> | undefined;
/** Several quick changes (a few switches) become one update. */
export function queueSync() {
  clearTimeout(timer);
  timer = setTimeout(() => { if (readPrefs().on) void syncNow(); }, 1500);
}

/** On app open: refresh when the list is old or running low, and notice if the phone's permission was withdrawn. */
export async function syncIfNeeded() {
  if (!REMINDERS_CONFIGURED) return;
  const prefs = readPrefs();
  if (!prefs.on) return;
  if ("Notification" in window && Notification.permission !== "granted") {
    writePrefs({ ...prefs, on: false });
    writeMeta({ err: "permission" });
    return;
  }
  const meta = readMeta();
  const stale = !meta.at || Date.now() - meta.at > RESYNC_AFTER || (meta.until ?? 0) - Date.now() < RESYNC_BELOW;
  if (stale) await syncNow();
}

/* ---------- What the settings page does ---------- */

export type EnableResult = SyncResult | "denied" | "install" | "unsupported-browser" | "nothing";

export async function enable(): Promise<EnableResult> {
  const support = detect();
  if (support === "install") return "install";
  if (support === "unsupported" || support === "unavailable") return "unsupported-browser";
  if ((await Notification.requestPermission()) !== "granted") return "denied";
  const reg = await registration();
  if (!reg) return "unsupported";
  const sub = (await reg.pushManager.getSubscription()) ?? (await subscribeNow(reg));
  const prefs = { ...readPrefs(), on: true };
  writePrefs(prefs);
  const t = Date.now();
  const welcome: Item = { id: "welcome", at: t, until: t + 120_000, title: "Reminders are on", body: "You will get the reminders you chose. Turn them off any time in Settings.", url: "/settings#reminders-title" };
  const r = await syncNow([welcome]);
  if (r !== "ok") {
    writePrefs({ ...prefs, on: false });
    await sub.unsubscribe().catch(() => {});
    return r;
  }
  return "ok";
}

export async function disable() {
  try {
    const reg = await registration();
    const sub = await reg?.pushManager.getSubscription();
    const { token } = readMeta();
    if (sub && token) await api("/v1/forget", { endpoint: sub.endpoint, token }).catch(() => {}); // if offline, the server drops it at its next poke
    await sub?.unsubscribe();
  } catch {}
  try { await idbClear(); } catch {}
  writePrefs({ ...readPrefs(), on: false });
  writeMeta(null);
}

export type TestResult = "ok" | "wait" | "off" | "network";
export async function sendTest(): Promise<TestResult> {
  try {
    const reg = await registration();
    const sub = await reg?.pushManager.getSubscription();
    const { token } = readMeta();
    if (!sub || !token) return "off";
    const t = Date.now();
    const item: Item = { id: `test-${t}`, at: t, until: t + 120_000, title: "This is a test", body: "Reminders are working on this phone.", url: "/settings#reminders-title" };
    const current = (await idbGet<Item[]>("schedule")) ?? [];
    await idbSet("schedule", [item, ...current]);
    const r = await api("/v1/test", { endpoint: sub.endpoint, token });
    if (r.status === 200) return "ok";
    await idbSet("schedule", current).catch(() => {}); // nothing was sent, so do not leave the one-off waiting for a real poke
    if (r.status === 429) return "wait";
    if (r.status === 410) { await disable(); return "off"; }
    return "network";
  } catch {
    return "network";
  }
}

/* ---------- React ---------- */

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener("storage", cb); };
}

export function useReminders(): { prefs: ReminderPrefs; meta: Meta; support: Support } {
  const snap = useSyncExternalStore(subscribe, () => read(PREFS_KEY) + "\u0001" + read(META_KEY), () => "\u0001");
  const [support, setSupport] = useState<Support>("checking");
  useEffect(() => {
    const check = () => setSupport(detect());
    check();
    document.addEventListener("visibilitychange", check); // the reader may have changed the permission in the phone's settings
    return () => document.removeEventListener("visibilitychange", check);
  }, []);
  return useMemo(() => {
    const [p, m] = snap.split("\u0001");
    return { prefs: merge(parse<Partial<ReminderPrefs>>(p, {})), meta: parse<Meta>(m, {}), support };
  }, [snap, support]);
}
