"use client";
import { useMemo, useSyncExternalStore } from "react";
import { stretch } from "./account-crypto";
import { canonical, cutoffFor, parseSnapshot, readLocal, reconcile, type Snapshot } from "./account-merge";
import { applySky } from "./night";
import { routineDay } from "./progress";

/**
 * Optional accounts. A reader can sign in so their progress follows them from one device to another. The phone stays the main
 * copy and everything works without an account. The server address is the same Worker that sends reminders.
 * What is synced and how it merges: src/lib/account-merge.ts. Nothing about location or reminders is ever sent.
 */
const SERVER = (process.env.NEXT_PUBLIC_REMINDERS_URL || "").replace(/\/+$/, "");
export const ACCOUNTS_CONFIGURED = !!SERVER;

const KEY = "rp:v1:account"; // who is signed in on this device, and the session token
const BASE = "rp:v1:account:base"; // the copy this device and the server last agreed on
const EVENT = "rp-account";
const REFRESH_AFTER = 5 * 60_000;
const CHANGE_DELAY = 30_000;

export interface Account { username?: string; token?: string; rev?: number; at?: number; joined?: boolean; err?: string }

const read = (k: string) => { try { return localStorage.getItem(k) ?? ""; } catch { return ""; } };
const parse = <T,>(s: string, fallback: T): T => { try { return s ? (JSON.parse(s) as T) : fallback; } catch { return fallback; } };

export const readAccount = (): Account => parse<Account>(read(KEY), {});
function writeAccount(patch: Account | null) {
  try {
    if (patch === null) { localStorage.removeItem(KEY); localStorage.removeItem(BASE); }
    else localStorage.setItem(KEY, JSON.stringify({ ...readAccount(), ...patch }));
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}
const readBase = (): Snapshot | null => parseSnapshot(read(BASE));
const writeBase = (s: Snapshot) => { try { localStorage.setItem(BASE, JSON.stringify({ ...s, settings: undefined })); } catch {} };
const cutoff = () => cutoffFor(routineDay());

async function call(method: string, path: string, body?: unknown, token?: string): Promise<{ status: number; body: Record<string, any> | null }> {
  const res = await fetch(SERVER + path, {
    method,
    headers: { ...(body ? { "content-type": "application/json" } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

/* ---------- syncing ---------- */

let quietUntil = 0;
/** Writing what arrived makes the app announce changes; those announcements must not start another sync. */
function announceLocalChange() {
  quietUntil = Date.now() + 3000;
  const root = document.documentElement.style;
  for (const [key, prop] of [["rp:arabic", "--arabic-scale"], ["rp:translit", "--translit-scale"]]) {
    const n = parseFloat(read(key));
    if (n >= 0.8 && n <= 1.8) root.setProperty(prop, String(n));
  }
  applySky();
  for (const e of ["rp-quran", "rp-progress", "rp-night"]) window.dispatchEvent(new Event(e));
}

export type SyncResult = "ok" | "signed-out" | "expired" | "network" | "busy";
let running: Promise<SyncResult> | null = null;
export function syncNow(): Promise<SyncResult> {
  return (running ??= run().finally(() => { running = null; }));
}

async function run(): Promise<SyncResult> {
  const acct = readAccount();
  if (!acct.token) return "signed-out";
  try {
    for (let round = 0; round < 3; round++) {
      const got = await call("GET", "/v1/data", undefined, acct.token);
      if (got.status === 401) { writeAccount({ token: undefined, err: "expired" }); return "expired"; }
      if (got.status !== 200 || !got.body) throw new Error("server");
      const r = reconcile(localStorage, (got.body.data as string | null) ?? null, readBase(), { cutoff: cutoff(), join: readAccount().joined !== true });
      if (r.changedLocal) announceLocalChange();
      let rev = got.body.rev as number;
      if (r.upload) {
        const put = await call("PUT", "/v1/data", { baseRev: rev, data: r.upload }, acct.token);
        if (put.status === 409) continue; // another device saved a moment ago: merge again
        if (put.status !== 200 || !put.body) throw new Error("server");
        rev = put.body.rev as number;
      }
      writeBase(r.merged);
      writeAccount({ rev, at: Date.now(), joined: true, err: undefined });
      return "ok";
    }
    return "busy";
  } catch {
    writeAccount({ err: "network" });
    return "network";
  }
}

/** True when this device has progress the server has not seen. */
function dirty(): boolean {
  const base = readBase();
  const local = readLocal(localStorage, cutoff());
  return !base || canonical(local) !== canonical(base);
}

let timer: ReturnType<typeof setTimeout> | undefined;
/** A little after progress changes, send it. The app also announces progress every minute for its clocks, hence the check. */
export function syncSoon() {
  if (!ACCOUNTS_CONFIGURED || !readAccount().token || Date.now() < quietUntil) return;
  clearTimeout(timer);
  timer = setTimeout(() => { if (dirty()) void syncNow(); }, CHANGE_DELAY);
}

export async function syncIfNeeded() {
  const a = readAccount();
  if (!ACCOUNTS_CONFIGURED || !a.token) return;
  if (!a.at || Date.now() - a.at > REFRESH_AFTER || dirty()) await syncNow();
}

/* ---------- signing up, in and out ---------- */

export type AuthResult = "ok" | "weak" | "invalid" | "locked" | "code" | "taken" | "username" | "full" | "network";

async function enter(path: string, username: string, password: string, code?: string): Promise<AuthResult> {
  if (password.length < 8) return "weak";
  try {
    const auth = await stretch(username, password);
    const r = await call("POST", path, { username, auth, ...(code !== undefined ? { code } : {}) });
    if (r.status === 201 || r.status === 200) {
      writeAccount({ username: r.body?.username ?? username.trim().toLowerCase(), token: r.body?.token, rev: 0, at: undefined, joined: false, err: undefined });
      try { localStorage.removeItem(BASE); } catch {}
      void syncNow();
      return "ok";
    }
    const e = r.body?.error;
    if (r.status === 429) return "locked";
    if (r.status === 401) return "invalid";
    if (r.status === 403) return "code";
    if (r.status === 409) return "taken";
    if (r.status === 503) return "full";
    if (e === "username") return "username";
    return "network";
  } catch {
    return "network";
  }
}
export const signUp = (username: string, password: string, code: string) => enter("/v1/account/signup", username, password, code);
export const signIn = (username: string, password: string) => enter("/v1/account/login", username, password);

/** Signs out of this device. The progress stays here; only the link to the account is removed. */
export async function signOut() {
  const { token } = readAccount();
  if (token) await call("POST", "/v1/account/logout", undefined, token).catch(() => {});
  writeAccount(null);
}

export async function deleteAccount(): Promise<"ok" | "network"> {
  const { token } = readAccount();
  try {
    if (token) await call("DELETE", "/v1/account", undefined, token);
  } catch {
    return "network";
  }
  writeAccount(null);
  return "ok";
}

/* ---------- React ---------- */

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener("storage", cb); };
}
export function useAccount(): Account {
  const snap = useSyncExternalStore(subscribe, () => read(KEY), () => "");
  return useMemo(() => parse<Account>(snap, {}), [snap]);
}
