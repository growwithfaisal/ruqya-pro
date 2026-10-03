"use client";
import { useCallback, useSyncExternalStore } from "react";
import { haptic } from "./haptics";

const EVENT = "rp-progress";
const LEGACY = "rp:done:";
const PREFIX = "rp:v2:done:";

/**
 * The routine day starts at 04:00, when the morning set begins, not at midnight. Bedtime runs from 20:00 to 04:00, so a
 * bedtime read at 01:00 belongs to the night that began the evening before and must not count for tonight.
 */
export const routineDay = (d: Date = new Date()) => new Date(d.getTime() - 4 * 3600_000).toLocaleDateString("en-CA");
const key = () => PREFIX + routineDay();

/**
 * Ticks saved by earlier versions sat under the calendar date. Morning and evening ticks are unambiguous and carry over;
 * a bedtime tick may have been made after midnight for the night before, so those are not carried over.
 */
function fromLegacy(): string | null {
  const raw = localStorage.getItem(LEGACY + routineDay());
  if (raw === null) return null;
  try {
    const ids = JSON.parse(raw) as unknown;
    return JSON.stringify(Array.isArray(ids) ? ids.filter((x) => typeof x === "string" && !x.startsWith("bedtime:")) : []);
  } catch { return null; }
}

function read(): string {
  try {
    return localStorage.getItem(key()) ?? fromLegacy() ?? "[]";
  } catch {
    return "[]";
  }
}
function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
function write(ids: string[]) {
  try {
    localStorage.setItem(key(), JSON.stringify(ids));
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

/**
 * The routine day's completed cards, kept only in this browser.
 * Keys are "set:entry" (for example "bedtime:dua-004"), so morning, evening and bedtime never share progress,
 * and nothing here touches the Qur'an reader's record.
 */
export const doneKey = (set: string, id: string) => `${set}:${id}`;


export function useDone() {
  const snap = useSyncExternalStore(subscribe, read, () => "[]");
  const done = new Set<string>(JSON.parse(snap));
  const toggle = useCallback((id: string) => {
    const cur = new Set<string>(JSON.parse(read()));
    if (cur.has(id)) cur.delete(id);
    else {
      cur.add(id);
      haptic(12);
    }
    write([...cur]);
  }, []);
  /** Sets a card as recited today; never un-ticks one. */
  const markDone = useCallback((id: string) => {
    const cur = new Set<string>(JSON.parse(read()));
    if (cur.has(id)) return;
    cur.add(id);
    haptic(12);
    write([...cur]);
  }, []);
  const clear = useCallback((ids: string[]) => {
    const cur = new Set<string>(JSON.parse(read()));
    ids.forEach((i) => cur.delete(i));
    write([...cur]);
  }, []);
  return { done, toggle, markDone, clear };
}
