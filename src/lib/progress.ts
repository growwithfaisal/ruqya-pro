"use client";
import { useCallback, useSyncExternalStore } from "react";

const EVENT = "rp-progress";
const key = () => `rp:done:${new Date().toLocaleDateString("en-CA")}`;

function read(): string {
  try {
    return localStorage.getItem(key()) ?? "[]";
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

/** Today's completed recitations, kept only in this browser. */
export function useDone() {
  const snap = useSyncExternalStore(subscribe, read, () => "[]");
  const done = new Set<string>(JSON.parse(snap));
  const toggle = useCallback((id: string) => {
    const cur = new Set<string>(JSON.parse(read()));
    if (cur.has(id)) cur.delete(id);
    else {
      cur.add(id);
      try { navigator.vibrate?.(12); } catch {}
    }
    write([...cur]);
  }, []);
  const clear = useCallback((ids: string[]) => {
    const cur = new Set<string>(JSON.parse(read()));
    ids.forEach((i) => cur.delete(i));
    write([...cur]);
  }, []);
  return { done, toggle, clear };
}
