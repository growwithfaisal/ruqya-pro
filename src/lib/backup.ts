"use client";
import { applySky } from "./night";

/**
 * Save and restore everything a reader keeps on this device (place, reading days, bookmarks, today's ticks, settings).
 * The file is made and read on the device; the reader decides where it is kept (Files, iCloud Drive, a message to themselves).
 * Nothing goes to a server. Offline downloads are not included: they are rebuilt from the Settings page.
 */
const FORMAT = 1;
const APP = "RuqyaPro";
const ALLOWED = /^rp:(v1:quran:(last|days|seen|marks|prefs)|done:\d{4}-\d{2}-\d{2}|v2:done:\d{4}-\d{2}-\d{2}|arabic|translit|v1:prayer:prefs|v1:night)$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_VALUE = 200_000;

interface BackupFile { app: string; format: number; savedAt: string; data: Record<string, string> }
export interface BackupSummary { days: number; marks: number; hasPlace: boolean }

const parse = <T,>(s: string | null | undefined, fallback: T): T => {
  try { return s ? (JSON.parse(s) as T) : fallback; } catch { return fallback; }
};
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const union = (a: string[], b: string[]) => [...new Set([...a, ...b])];

function summarise(get: (k: string) => string | null): BackupSummary {
  return {
    days: strings(parse(get("rp:v1:quran:days"), [])).length,
    marks: strings(parse(get("rp:v1:quran:marks"), [])).length,
    hasPlace: !!parse<{ surah?: number } | null>(get("rp:v1:quran:last"), null)?.surah,
  };
}

export function summaryNow(): BackupSummary {
  try { return summarise((k) => localStorage.getItem(k)); } catch { return { days: 0, marks: 0, hasPlace: false }; }
}

export function makeBackup(): { file: File; summary: BackupSummary } {
  const data: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    const v = k ? localStorage.getItem(k) : null;
    if (k && v !== null && ALLOWED.test(k)) data[k] = v;
  }
  const body: BackupFile = { app: APP, format: FORMAT, savedAt: new Date().toISOString(), data };
  const name = `ruqyapro-backup-${new Date().toLocaleDateString("en-CA")}.json`;
  return { file: new File([JSON.stringify(body)], name, { type: "application/json" }), summary: summarise((k) => data[k] ?? null) };
}

/** Share sheet where there is one (iPhone: "Save to Files"), otherwise an ordinary download. */
export async function saveBackup(): Promise<BackupSummary> {
  const { file, summary } = makeBackup();
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "RuqyaPro backup" });
      return summary;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") throw e; // reader closed the sheet
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return summary;
}

/** Merges a backup into this device: reading days, bookmarks and ticks are combined; the later place wins; settings come from the file. */
export async function restoreBackup(file: File): Promise<BackupSummary> {
  if (file.size > 2_000_000) throw new Error("That file is too large to be a RuqyaPro backup.");
  let body: BackupFile;
  try { body = JSON.parse(await file.text()); } catch { throw new Error("That file could not be read."); }
  if (!body || body.app !== APP || typeof body.data !== "object" || body.data === null) throw new Error("That is not a RuqyaPro backup file.");
  if (body.format > FORMAT) throw new Error("This backup was made by a newer version of the app. Update the app and try again.");

  const get = (k: string) => localStorage.getItem(k);
  const set = (k: string, v: unknown) => localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));

  for (const [k, raw] of Object.entries(body.data)) {
    if (!ALLOWED.test(k) || typeof raw !== "string" || raw.length > MAX_VALUE) continue;
    const incoming = parse<unknown>(raw, undefined);
    if (incoming === undefined) continue;

    if (k === "rp:v1:quran:days") {
      set(k, union(strings(parse(get(k), [])), strings(incoming)).filter((d) => DATE.test(d)).sort());
    } else if (k === "rp:v1:quran:marks" || k.startsWith("rp:done:") || k.startsWith("rp:v2:done:")) {
      set(k, union(strings(parse(get(k), [])), strings(incoming)));
    } else if (k === "rp:v1:quran:last") {
      const a = parse<{ at?: number } | null>(get(k), null);
      const b = incoming as { surah?: number; verse?: number; at?: number };
      if (typeof b?.surah === "number" && typeof b.verse === "number" && (!a || (a.at ?? 0) < (b.at ?? 0))) set(k, raw);
    } else if (k === "rp:v1:quran:seen") {
      const a = parse<{ date?: string; keys?: unknown } | null>(get(k), null);
      const b = incoming as { date?: string; keys?: unknown };
      if (typeof b?.date !== "string") continue;
      if (!a?.date || a.date < b.date) set(k, { date: b.date, keys: strings(b.keys) });
      else if (a.date === b.date) set(k, { date: b.date, keys: union(strings(a.keys), strings(b.keys)) });
    } else if (k === "rp:v1:night") {
      if (raw === "1") set(k, "1");
    } else if (k === "rp:v1:quran:prefs" || k === "rp:v1:prayer:prefs") {
      if (typeof incoming === "object" && incoming) set(k, raw);
    } else {
      const n = parseFloat(raw); // rp:arabic, rp:translit
      if (n >= 0.8 && n <= 1.8) set(k, String(n));
    }
  }
  for (const [key, prop] of [["rp:arabic", "--arabic-scale"], ["rp:translit", "--translit-scale"]]) {
    const n = parseFloat(get(key) ?? "");
    if (n >= 0.8 && n <= 1.8) document.documentElement.style.setProperty(prop, String(n));
  }
  applySky(); // a restored night mode takes hold at once
  window.dispatchEvent(new Event("rp-night"));
  window.dispatchEvent(new Event("rp-quran"));
  window.dispatchEvent(new Event("rp-progress"));
  return summarise(get);
}
