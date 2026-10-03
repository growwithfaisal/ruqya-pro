"use client";
import { useSyncExternalStore } from "react";
import { THEME_COLOR, type Sky } from "./sky";
import { liveSky } from "./sky-live";

/**
 * Night mode holds the page in its night look until it is turned off. Off, the sky follows the sun as usual.
 * One flag on this device (`rp:v1:night` = "1"); the pre-paint script in layout.tsx reads the same key, so a phone
 * opened at noon in night mode never flashes day. A `?sky=` preview in the address bar still wins.
 */
const KEY = "rp:v1:night";
const EVENTS = ["rp-night", "storage"] as const;

export const readNight = () => {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
};

function subscribe(cb: () => void) {
  EVENTS.forEach((e) => window.addEventListener(e, cb));
  return () => EVENTS.forEach((e) => window.removeEventListener(e, cb));
}
export const useNight = () => useSyncExternalStore(subscribe, readNight, () => false);

/** Puts the right sky on the page: night while night mode is on, else the real sky for this moment. */
export function applySky(now = new Date()) {
  if (new URLSearchParams(location.search).get("sky")) return;
  const sky: Sky = readNight() ? "night" : liveSky(now).sky;
  const root = document.documentElement;
  if (root.dataset.sky === sky) return;
  root.dataset.sky = sky;
  document.querySelector("meta[name=theme-color]")?.setAttribute("content", THEME_COLOR[sky]);
}

export function setNight(on: boolean) {
  try { if (on) localStorage.setItem(KEY, "1"); else localStorage.removeItem(KEY); } catch {}
  const swap = () => {
    applySky();
    window.dispatchEvent(new Event("rp-night"));
  };
  // A soft crossfade of the whole page; reduced motion (and browsers without it) change at once.
  const doc = document as Document & { startViewTransition?: (cb: () => void) => Record<"ready" | "finished" | "updateCallbackDone", Promise<unknown>> };
  if (doc.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    // The page's root is normally left out of view transitions (globals.css) so the bars stay live; this crossfade is
    // of the whole page, so it puts the root back for its own duration.
    const root = document.documentElement;
    root.classList.add("vt-root");
    // A skipped transition (page hidden, or another one started) still runs `swap`; its promises just reject, which is not an error here.
    const t = doc.startViewTransition(swap);
    for (const p of [t.ready, t.updateCallbackDone]) p?.catch(() => {});
    t.finished?.catch(() => {}).finally(() => root.classList.remove("vt-root"));
  } else swap();
}
